#!/usr/bin/env node
/**
 * extractAllCards.mjs
 *
 * Processes every PDF in "Credit Card Knowledge Base - 20032026/", extracts
 * card data via the Anthropic API, verifies earn rates against MileLion.com
 * using the web_search server-side tool, and writes results to
 * scripts/cards-extracted.json for manual review before replacing
 * src/data/cards.json.
 *
 * Run:
 *   node --env-file=.env.local scripts/extractAllCards.mjs
 *
 * Resume after interruption: re-run the same command — progress.json tracks
 * which PDFs were already processed successfully and they are skipped.
 */

import Anthropic from '@anthropic-ai/sdk';
import fs        from 'fs/promises';
import path      from 'path';
import { fileURLToPath } from 'url';

// ── Paths ────────────────────────────────────────────────────────────────────

const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const ROOT          = path.resolve(__dirname, '..');
const PDF_DIR       = path.join(ROOT, 'Credit Card Knowledge Base - 20032026');
const OUTPUT_FILE   = path.join(__dirname, 'cards-extracted.json');
const PROGRESS_FILE = path.join(__dirname, 'progress.json');
const SCHEMA_FILE   = path.join(ROOT, 'src', 'data', 'cards.json');

// ── Config ───────────────────────────────────────────────────────────────────

const MODEL             = 'claude-sonnet-4-20250514';
const DELAY_MS          = 2000;   // delay between PDF API calls
const MAX_LOOP          = 20;     // max pause_turn continuations per PDF
const TODAY             = '2026-03-23';

// ── Init client ──────────────────────────────────────────────────────────────

const apiKey = process.env.VITE_ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ERROR: VITE_ANTHROPIC_API_KEY not set.');
  console.error('Run: node --env-file=.env.local scripts/extractAllCards.mjs');
  process.exit(1);
}

const client = new Anthropic({ apiKey });

// ── Schema reference ─────────────────────────────────────────────────────────

const schemaCards  = JSON.parse(await fs.readFile(SCHEMA_FILE, 'utf-8'));
const schemaExample = JSON.stringify(schemaCards[0], null, 2);

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a Singapore credit card data extraction specialist. Your task:

1. Read the provided PDF and identify every credit card described in it.
2. For each card, search MileLion.com for its dedicated review page
   (search query: site:milelion.com "[card name]") to verify earn rates.
3. If MileLion's earn rates differ from the PDF, prefer MileLion — it is
   more accurate and up-to-date.
4. Return ONLY valid JSON — no markdown fences, no commentary.
   • One card  → return a single JSON object  { ... }
   • Many cards → return a JSON array          [ { ... }, { ... } ]

Use this exact card schema (example below — match every field name):

${schemaExample}

════════════════════════════════════════════════════════
FIELD RULES
════════════════════════════════════════════════════════

id              kebab-case slug, e.g. "dbs-altitude-visa", "citi-premiermiles",
                "ocbc-90n-visa", "trust-cashback"

bank            Full bank name: "DBS", "POSB", "Citibank", "OCBC", "UOB",
                "Standard Chartered", "HSBC", "Maybank", "CIMB", "Amex",
                "BOC", "ICBC", "Trust Bank", "MariBank", "DCS"

network         "Visa" | "Mastercard" | "Amex" | "UnionPay"

rewardType      "cashback" | "miles" | "points"

earnRates       • Miles cards  → miles-per-dollar NUMBER (e.g. 1.4 for 1.4 mpd,
                                 4.0 for 4 mpd). Use the BASE / local earn rate.
                • Cashback cards → decimal fraction (e.g. 0.06 for 6%,
                                   0.015 for 1.5%).
                • All 11 keys required: dining, travel, transport,
                  onlineShopping, retailShopping, groceries, healthBeauty,
                  entertainment, subscriptions, education, others.
                • Categories with no special bonus → use the card's base rate.

cashbackEquivalent
                Always a cashback decimal fraction (value per SGD spent).
                • Cashback cards → same as earnRates.
                • Miles cards    → earnRate × 0.015  (assuming 1.5 ¢/mile).
                  e.g. 1.4 mpd  → cashbackEquivalent = 0.021

minIncomeSGD    Number, e.g. 30000 | 80000 | 120000. Use 30000 if not stated.

annualFee       Number in SGD (e.g. 196.20). Use 0 only if the card is
                permanently free — not just first-year waived.

firstYearFeeWaived   Boolean.

minMonthlySpend Number in SGD; 0 if there is no minimum spend requirement.

perks           Array of concise strings (max 6). Focus on unique benefits —
                lounge access, travel insurance, merchant-specific boosts, etc.

welcomeBonus    String description or "None".

welcomeBonusValue  Number (SGD cash value of the bonus). 0 if none.

useCaseSummary  1–2 sentences: who is this card ideal for?

applyUrl        Official bank application URL (NOT a SingSaver or comparison
                site URL). Use the bank's own credit card page if unsure.

sourceUrl       The MileLion.com URL you found for this card, or null.

lastVerified    Always "${TODAY}".

════════════════════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════════════════════
Return ONLY JSON. Start immediately with { or [.
Do NOT wrap in markdown code fences.
Do NOT add any text before or after the JSON.`;

// ── JSON parsing helpers ──────────────────────────────────────────────────────

/**
 * Strips markdown fences and extracts the outermost JSON value (object or array).
 * Throws if no valid JSON is found.
 */
function parseJsonFromResponse(text) {
  // Strip markdown fences if present
  let s = text.trim()
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/m,        '')
    .trim();

  // Direct parse
  try { return JSON.parse(s); } catch (_) {}

  // Find outermost array
  const ai = s.indexOf('['), ae = s.lastIndexOf(']');
  if (ai !== -1 && ae > ai) {
    try { return JSON.parse(s.slice(ai, ae + 1)); } catch (_) {}
  }

  // Find outermost object
  const oi = s.indexOf('{'), oe = s.lastIndexOf('}');
  if (oi !== -1 && oe > oi) {
    try { return JSON.parse(s.slice(oi, oe + 1)); } catch (_) {}
  }

  throw new Error(
    `Cannot find valid JSON in response (first 400 chars): ${text.slice(0, 400)}`
  );
}

/**
 * Normalises parsed JSON (object or array) into an array of card objects,
 * stamping lastVerified and sourceFile onto each.
 */
function normaliseCards(parsed, sourceFile) {
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr
    .filter(c => c && typeof c === 'object')
    .map(card => ({
      ...card,
      lastVerified: TODAY,
      sourceFile,
      sourceUrl: card.sourceUrl ?? null,
    }));
}

// ── Core API call ─────────────────────────────────────────────────────────────

/**
 * Calls the Anthropic API with a web_search server-side tool.
 * Handles the pause_turn continuation loop.
 * Falls back to a call without web_search if the tool is unsupported.
 *
 * @param {object[]} messages  Initial messages array
 * @param {boolean}  useWebSearch  Whether to include the web_search tool
 * @returns {{ response: Anthropic.Message, usedWebSearch: boolean }}
 */
async function callWithLoop(messages, useWebSearch) {
  const tools = useWebSearch
    ? [{ type: 'web_search_20260209', name: 'web_search' }]
    : [];

  let msgHistory = [...messages];

  for (let i = 0; i < MAX_LOOP; i++) {
    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: 8192,
      system:     SYSTEM_PROMPT,
      ...(tools.length > 0 ? { tools } : {}),
      messages:   msgHistory,
    });

    if (response.stop_reason === 'end_turn') {
      return { response, usedWebSearch: useWebSearch };
    }

    if (response.stop_reason === 'pause_turn') {
      // Server-side tool loop needs another iteration.
      // Append the assistant turn; the API will resume automatically
      // when it detects a trailing server_tool_use block.
      msgHistory = [...msgHistory, { role: 'assistant', content: response.content }];
      continue;
    }

    // Unexpected stop reason — treat as complete
    console.warn(`    ⚠ Unexpected stop_reason: "${response.stop_reason}"`);
    return { response, usedWebSearch: useWebSearch };
  }

  throw new Error(`Exceeded ${MAX_LOOP} loop iterations without end_turn`);
}

// ── Per-PDF extraction ────────────────────────────────────────────────────────

async function extractCard(pdfFile) {
  const pdfBytes  = await fs.readFile(path.join(PDF_DIR, pdfFile));
  const pdfBase64 = pdfBytes.toString('base64');

  const baseMessages = [
    {
      role: 'user',
      content: [
        {
          type:   'document',
          source: {
            type:       'base64',
            media_type: 'application/pdf',
            data:       pdfBase64,
          },
        },
        {
          type: 'text',
          text: 'Extract all credit card data from this PDF. '
              + 'Search MileLion.com for each card\'s review page to verify earn rates. '
              + 'Return valid JSON only (object or array).',
        },
      ],
    },
  ];

  let result;

  // Attempt 1: with web_search
  try {
    result = await callWithLoop(baseMessages, true);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isToolError =
      (err?.status === 400 && msg.toLowerCase().includes('tool')) ||
      msg.toLowerCase().includes('web_search');

    if (isToolError) {
      console.warn(`    ⚠ web_search unsupported for this model — retrying without`);
      result = await callWithLoop(baseMessages, false);
    } else {
      throw err;
    }
  }

  const { response, usedWebSearch } = result;

  // Extract text block from final response
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock?.text) {
    // Some responses may only have server_tool_use blocks with no text —
    // dump everything we have for diagnosis
    const types = response.content.map(b => b.type).join(', ');
    throw new Error(`No text block in final response (blocks: ${types})`);
  }

  const parsed = parseJsonFromResponse(textBlock.text);
  const cards  = normaliseCards(parsed, pdfFile);

  return { cards, usedWebSearch };
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function completenessScore(card) {
  let score = 0;
  if (card.id)            score += 2;
  if (card.name)          score += 2;
  if (card.bank)          score += 1;
  if (card.sourceUrl)     score += 3;  // reward MileLion-verified entries
  if (card.applyUrl)      score += 1;
  if (card.useCaseSummary) score += 1;
  if (card.welcomeBonusValue > 0) score += 1;
  const positiveRates = Object.values(card.earnRates ?? {})
    .filter(v => typeof v === 'number' && v > 0).length;
  score += positiveRates;
  score += Math.min(card.perks?.length ?? 0, 6);
  return score;
}

function deduplicateCards(cards) {
  const byName = new Map();

  for (const card of cards) {
    const key = (card.name ?? '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
    if (!key) continue;

    const existing = byName.get(key);
    if (!existing || completenessScore(card) > completenessScore(existing)) {
      byName.set(key, card);
    }
  }

  return [...byName.values()].sort((a, b) => {
    const bc = (a.bank ?? '').localeCompare(b.bank ?? '');
    return bc !== 0 ? bc : (a.name ?? '').localeCompare(b.name ?? '');
  });
}

// ── State persistence ─────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function loadProgress() {
  try { return JSON.parse(await fs.readFile(PROGRESS_FILE, 'utf-8')); }
  catch { return { processed: {}, failed: [] }; }
}

async function saveProgress(p) {
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

async function loadResults() {
  try { return JSON.parse(await fs.readFile(OUTPUT_FILE, 'utf-8')); }
  catch { return []; }
}

async function saveResults(cards) {
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(cards, null, 2));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const divider = '═'.repeat(54);

  console.log('');
  console.log(divider);
  console.log('  CardSense SG — Card Database Extraction Pipeline');
  console.log(divider);
  console.log(`  Model  : ${MODEL}`);
  console.log(`  PDFs   : ${PDF_DIR}`);
  console.log(`  Output : ${OUTPUT_FILE}`);
  console.log(divider);

  // Discover PDFs
  const allFiles = await fs.readdir(PDF_DIR);
  const pdfFiles = allFiles
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();

  console.log(`\n  Found ${pdfFiles.length} PDF files.\n`);

  // Load state
  const progress   = await loadProgress();
  const allResults = await loadResults();
  const processed  = progress.processed ?? {};
  const failed     = progress.failed    ?? [];

  // Track run-level stats
  let newSuccessCount   = 0;
  let skippedCount      = 0;
  let failCount         = 0;
  let webSearchCount    = 0;
  let totalCardsThisRun = 0;

  for (let i = 0; i < pdfFiles.length; i++) {
    const pdfFile = pdfFiles[i];
    const idx     = `[${String(i + 1).padStart(2, '0')}/${pdfFiles.length}]`;

    // ── Skip already-processed ──────────────────────────────────────────────
    if (processed[pdfFile]) {
      const names = processed[pdfFile].cards?.join(', ') ?? '';
      console.log(`${idx} ↩  SKIP  ${pdfFile}`);
      if (names) console.log(`          ${names}`);
      skippedCount++;
      continue;
    }

    console.log(`${idx} →  ${pdfFile}`);

    try {
      const { cards, usedWebSearch } = await extractCard(pdfFile);

      for (const card of cards) {
        const milelionTag = card.sourceUrl ? ' 🔗' : '';
        console.log(
          `         ✓  ${card.name ?? '(unnamed)'}  [${card.rewardType ?? '?'}]${milelionTag}`
        );
        if (card.sourceUrl) console.log(`              ${card.sourceUrl}`);
        allResults.push(card);
        totalCardsThisRun++;
      }

      if (usedWebSearch) webSearchCount++;

      // Save progress
      processed[pdfFile] = {
        cards:       cards.map(c => c.name ?? '(unnamed)'),
        extractedAt: new Date().toISOString(),
      };
      progress.processed = processed;
      progress.failed    = failed;
      await saveProgress(progress);
      await saveResults(allResults);   // intermediate save (raw, pre-dedup)

      newSuccessCount++;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`         ✗  FAILED: ${msg.slice(0, 200)}`);

      const record = {
        file:     pdfFile,
        error:    msg,
        failedAt: new Date().toISOString(),
      };
      // Replace any previous failure record for this file
      const existingIdx = failed.findIndex(f => f.file === pdfFile);
      if (existingIdx !== -1) failed.splice(existingIdx, 1, record);
      else failed.push(record);

      progress.failed = failed;
      await saveProgress(progress);
      failCount++;
    }

    // Rate-limit delay (skip after final PDF)
    if (i < pdfFiles.length - 1) await sleep(DELAY_MS);
  }

  // ── Deduplication ──────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(54));
  console.log('  Deduplicating by card name…');
  const rawCount = allResults.length;
  const deduped  = deduplicateCards(allResults);
  console.log(`  ${rawCount} raw entries → ${deduped.length} unique cards`);
  await saveResults(deduped);

  // ── Summary ────────────────────────────────────────────────────────────────
  const totalProcessed = newSuccessCount + skippedCount;
  console.log('\n' + divider);
  console.log('  PIPELINE COMPLETE');
  console.log(divider);
  console.log(`  PDFs total          : ${pdfFiles.length}`);
  console.log(`  PDFs processed      : ${totalProcessed}`);
  console.log(`    ↩ Skipped (resume): ${skippedCount}`);
  console.log(`    ✓ Extracted now   : ${newSuccessCount}`);
  console.log(`    ✗ Failed          : ${failCount}`);
  console.log(`  Cards extracted     : ${totalCardsThisRun}`);
  console.log(`  🔗 MileLion verified : ${webSearchCount} PDFs`);
  console.log(`  Unique cards output : ${deduped.length}`);
  console.log(`  Output file         : scripts/cards-extracted.json`);

  if (failed.length > 0) {
    console.log('\n  Failed files:');
    for (const f of failed) {
      console.log(`    ✗ ${f.file}`);
      console.log(`      ${f.error.slice(0, 120)}`);
    }
    console.log('');
    console.log('  To retry failed files: fix the issue and re-run the script.');
    console.log('  Successful files will be skipped automatically (progress.json).');
  }

  console.log('\n  ✅ Review scripts/cards-extracted.json before replacing src/data/cards.json');
  console.log(divider + '\n');
}

main().catch(err => {
  console.error('\nFATAL:', err?.message ?? err);
  process.exit(1);
});
