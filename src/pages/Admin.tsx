import { useState, useRef } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import rawCards from '../data/cards.json'
import rawPromotions from '../data/promotions.json'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CardRecord {
  id: string
  name: string
  bank: string
  rewardType: string
  earnRates: Record<string, number>
  annualFee: number
  firstYearFeeWaived: boolean
  minIncomeSGD: number
  minMonthlySpend: number
  perks: string[]
  welcomeBonus: string
  welcomeBonusValue: number
  useCaseSummary: string
  applyUrl: string
  lastVerified?: string
  [key: string]: unknown
}

interface PromotionRecord {
  cardId: string
  badge: string
  description: string
}

type VerificationStatus = 'verified' | 'discrepancy' | 'needs_manual_check'
type Confidence = 'high' | 'medium' | 'low'

interface VerificationResult {
  cardId: string
  cardName: string
  bank: string
  status: VerificationStatus
  confidence: Confidence
  issues: string[]
  suggestions: string[]
  corrections: Record<string, unknown>
  promotionsFound: string[]
  sources: string[]
  error?: string
}

interface FoundPromotion extends PromotionRecord {
  cardName: string
  added: boolean
}

interface PerspectiveCritique {
  strengths: string[]
  criticalIssues: string[]
  recommendedActions: string[]
}

interface ExecCritique {
  ceo: PerspectiveCritique
  cto: PerspectiveCritique
  coo: PerspectiveCritique
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function parseJsonFromText(text: string): unknown {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const jsonText = fenceMatch ? fenceMatch[1] : text.trim()
  return JSON.parse(jsonText)
}

function buildVerificationPrompt(card: CardRecord): string {
  const isCashback = card.rewardType === 'cashback'
  const rateUnit = isCashback ? 'decimal (e.g. 0.05 = 5% cashback)' : 'mpd (miles per dollar)'
  const rateLines = ['dining', 'travel', 'transport', 'onlineShopping', 'groceries']
    .map((k) => `  - ${k}: ${(card.earnRates[k] ?? 0)}`)
    .join('\n')

  return `You are verifying credit card data for Singapore.

IMPORTANT SCHEMA CONSTRAINTS — read carefully before responding:
1. We store ONE earn rate per spending category — the LOCAL (Singapore) rate only. Do NOT suggest separate overseas rates; our schema cannot store them.
2. ${isCashback
    ? 'This is a CASHBACK card. Earn rates are stored as decimals: 0.05 means 5% cashback, 0.03 means 3%, etc.'
    : 'This is a MILES card. Earn rates are stored as miles per dollar (mpd): 1.4 means 1.4 mpd, 4.0 means 4 mpd, etc.'}
3. Only flag a genuine rate discrepancy if the stored value is actually wrong — not just formatted differently or missing an overseas split.

Card to verify: ${card.name} from ${card.bank}.
Our current data (earn rates as ${rateUnit}):
- Reward type: ${card.rewardType}
- Annual fee: SGD ${card.annualFee}${card.firstYearFeeWaived ? ' (first year waived)' : ''}
- Min income: SGD ${card.minIncomeSGD}
- Earn rates (local Singapore rates):
${rateLines}
- Perks: ${card.perks.join(', ') || 'none listed'}
- Welcome bonus: ${card.welcomeBonus || 'none listed'}

Based on your knowledge about this card, identify:
1. Any LOCAL earn rates that are genuinely incorrect or outdated (ignore overseas rates — we don't store them)
2. Any missing perks or features
3. Any active welcome bonuses or promotions
4. Confidence level: HIGH (confident), MEDIUM (somewhat confident), or LOW (uncertain)

If you have structured corrections (specific field → new value pairs), include them in "corrections". For earn rate corrections use the same decimal/mpd format as our stored values.

Respond in this exact JSON format with no other text:
{
  "cardId": "${card.id}",
  "status": "verified",
  "confidence": "high",
  "issues": [],
  "suggestions": [],
  "corrections": {},
  "promotionsFound": [],
  "sources": []
}

Where status is one of: verified, discrepancy, needs_manual_check`
}

function buildPromotionsPrompt(cards: CardRecord[], existingPromos: PromotionRecord[]): string {
  const existingIds = new Set(existingPromos.map((p) => p.cardId))
  const cardList = cards.map((c) => `- ${c.id}: ${c.name} (${c.bank})`).join('\n')

  return `You are scanning for current credit card welcome bonuses and promotions in Singapore.

Cards in our database:
${cardList}

We already have promotions for these card IDs: ${Array.from(existingIds).join(', ') || 'none'}

Based on your knowledge of Singapore credit card promotions, identify any active welcome bonuses or sign-up offers for the cards NOT already covered. Focus on significant offers: welcome miles, cashback bonuses, annual fee waivers, gift vouchers, etc.

Respond with only a JSON array, no other text:
[
  {
    "cardId": "the card id from the list above",
    "cardName": "card name",
    "badge": "short label e.g. '20,000 miles' or 'S$150 cashback'",
    "description": "Full offer description e.g. 'Earn 20,000 bonus miles when you spend S$2,000 in the first 3 months'"
  }
]

If no promotions are found, return: []`
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function Admin() {
  const [cardsState, setCardsState]         = useState<CardRecord[]>(rawCards as unknown as CardRecord[])
  const [cardsModified, setCardsModified]   = useState(false)
  const [promoState, setPromoState]         = useState<PromotionRecord[]>((rawPromotions as unknown as { promotions: PromotionRecord[] }).promotions ?? [])
  const [promoModified, setPromoModified]   = useState(false)

  const [verifying, setVerifying]               = useState(false)
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([])
  const [progress, setProgress]                 = useState({ current: 0, total: 0 })
  const [log, setLog]                           = useState<string[]>([])
  const [checkedCards, setCheckedCards]         = useState<Set<string>>(new Set())

  const [scanning, setScanning]         = useState(false)
  const [foundPromos, setFoundPromos]   = useState<FoundPromotion[]>([])

  const [critiquing, setCritiquing]         = useState(false)
  const [critiqueData, setCritiqueData]     = useState<ExecCritique | null>(null)
  const [critiqueError, setCritiqueError]   = useState<string | null>(null)
  const [critiqueOpen, setCritiqueOpen]     = useState<Record<string, boolean>>({ ceo: true, cto: false, coo: false })

  const cancelRef = useRef(false)
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

  function makeClient(): Anthropic {
    if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set')
    return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  }

  // ── Verification ─────────────────────────────────────────────────────────────

  async function runVerification() {
    if (!apiKey) { alert('VITE_ANTHROPIC_API_KEY is not set in .env.local'); return }
    const client = makeClient()
    cancelRef.current = false
    setVerifying(true)
    setVerificationResults([])
    setLog([])
    setProgress({ current: 0, total: cardsState.length })

    const results: VerificationResult[] = []

    for (let i = 0; i < cardsState.length; i++) {
      if (cancelRef.current) break
      const card = cardsState[i]
      setProgress({ current: i + 1, total: cardsState.length })
      appendLog(`[${i + 1}/${cardsState.length}] Verifying ${card.name}...`)

      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{ role: 'user', content: buildVerificationPrompt(card) }],
        })

        const text = response.content.find((b) => b.type === 'text')
        const raw  = text?.type === 'text' ? text.text : '{}'

        let parsed: Partial<VerificationResult> = {}
        try {
          parsed = parseJsonFromText(raw) as Partial<VerificationResult>
        } catch {
          parsed = { status: 'needs_manual_check', confidence: 'low', issues: ['Could not parse API response'], suggestions: [] }
        }

        const result: VerificationResult = {
          cardId:         card.id,
          cardName:       card.name,
          bank:           card.bank,
          status:         parsed.status ?? 'needs_manual_check',
          confidence:     parsed.confidence ?? 'low',
          issues:         parsed.issues ?? [],
          suggestions:    parsed.suggestions ?? [],
          corrections:    (parsed as Record<string, unknown>).corrections as Record<string, unknown> ?? {},
          promotionsFound: parsed.promotionsFound ?? [],
          sources:        parsed.sources ?? [],
        }
        results.push(result)
        appendLog(`  ✓ ${card.name}: ${result.status} (${result.confidence} confidence)`)

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        results.push({
          cardId: card.id, cardName: card.name, bank: card.bank,
          status: 'needs_manual_check', confidence: 'low',
          issues: [`API error: ${msg}`], suggestions: [], corrections: {},
          promotionsFound: [], sources: [], error: msg,
        })
        appendLog(`  ✗ ${card.name}: error — ${msg}`)
      }

      setVerificationResults([...results])
      if (i < cardsState.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, 600))
      }
    }

    setVerifying(false)
  }

  function appendLog(msg: string) {
    setLog((prev) => [...prev, msg])
  }

  function applyFix(cardId: string, corrections: Record<string, unknown>) {
    if (Object.keys(corrections).length === 0) {
      alert('No structured corrections available for automatic apply.\nReview the suggestions and update cards.json manually.')
      return
    }
    setCardsState((prev) => prev.map((c) => c.id === cardId ? { ...c, ...corrections } : c))
    setCardsModified(true)
    alert(`Applied ${Object.keys(corrections).length} correction(s) to ${cardId}. Download updated cards.json when done.`)
  }

  function markAsChecked(cardId: string) {
    const today = todayISO()
    setCheckedCards((prev) => new Set([...prev, cardId]))
    setCardsState((prev) => prev.map((c) => c.id === cardId ? { ...c, lastVerified: today } : c))
    setCardsModified(true)
  }

  // ── Promotions scan ───────────────────────────────────────────────────────────

  async function runPromotionScan() {
    if (!apiKey) { alert('VITE_ANTHROPIC_API_KEY is not set in .env.local'); return }
    const client = makeClient()
    setScanning(true)
    setFoundPromos([])

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildPromotionsPrompt(cardsState, promoState) }],
      })

      const text = response.content.find((b) => b.type === 'text')
      const raw  = text?.type === 'text' ? text.text : '[]'

      let parsed: Array<{ cardId: string; cardName: string; badge: string; description: string }> = []
      try {
        parsed = parseJsonFromText(raw) as typeof parsed
        if (!Array.isArray(parsed)) parsed = []
      } catch {
        alert('Could not parse promotions response. Raw output logged to console.')
        console.log('Raw promotions response:', raw)
        parsed = []
      }

      setFoundPromos(parsed.map((p) => ({ ...p, added: false })))
    } catch (err) {
      alert(`Scan failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    setScanning(false)
  }

  // ── Product Critique ──────────────────────────────────────────────────────────

  async function runCritique() {
    if (!apiKey) { alert('VITE_ANTHROPIC_API_KEY is not set in .env.local'); return }
    const client = makeClient()
    setCritiquing(true)
    setCritiqueData(null)
    setCritiqueError(null)

    const prompt = `You are a panel of three senior executives reviewing CardSense SG — a Singapore credit card recommender web app. The app allows users to upload their spending data (Money Manager Excel exports or PDF bank statements), automatically categorises transactions into 11 HeyMax-aligned categories, collects user preferences (reward priority, existing cards, lifestyle perks, income, min spend), runs a gap analysis against their existing card portfolio, and recommends the top 5 Singapore credit cards ranked by projected annual value.

The app has 50 cards in its database across 11 banks. It shows a spending analysis dashboard with donut chart and category breakdown, a preferences page, a recommendations page with miles per year or monthly cashback, a card detail page with projected value breakdown, a side-by-side comparison page, and a promotions system with multi-source support and AI advisor.

Current known issues:
- Card database accuracy not fully verified
- Promotions data needs updating
- UI feels AI-generated and generic
- Some users unfamiliar with Money Manager format
- Privacy concerns about financial data handling
- Missing cards: Trust Bank, Maribank, GXS, Chocolate, UOB KrisFlyer

Please provide structured critique from three perspectives:

CEO: Focus on business model, market positioning, revenue potential, competitive differentiation, and what would make this a viable business vs a side project.

CTO: Focus on technical architecture, data accuracy challenges, scalability, security, what needs to be rebuilt vs refined, and technical debt.

COO: Focus on operations, data maintenance workflow, user trust, compliance risks (PDPA, MAS), and what processes need to exist before public launch.

For each perspective provide:
1. Top 3 strengths
2. Top 3 critical issues
3. Top 3 recommended actions in priority order

Be direct, specific to Singapore fintech context, and assume the founder is a solo non-technical founder building this as a potential business.

Respond ONLY with valid JSON in exactly this format, no other text:
{
  "ceo": {
    "strengths": ["...", "...", "..."],
    "criticalIssues": ["...", "...", "..."],
    "recommendedActions": ["...", "...", "..."]
  },
  "cto": {
    "strengths": ["...", "...", "..."],
    "criticalIssues": ["...", "...", "..."],
    "recommendedActions": ["...", "...", "..."]
  },
  "coo": {
    "strengths": ["...", "...", "..."],
    "criticalIssues": ["...", "...", "..."],
    "recommendedActions": ["...", "...", "..."]
  }
}`

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = response.content.find((b) => b.type === 'text')
      const raw  = text?.type === 'text' ? text.text : '{}'

      let parsed: ExecCritique
      try {
        parsed = parseJsonFromText(raw) as ExecCritique
      } catch {
        throw new Error('Could not parse critique response. Raw output: ' + raw.slice(0, 200))
      }

      setCritiqueData(parsed)
    } catch (err) {
      setCritiqueError(err instanceof Error ? err.message : String(err))
    }

    setCritiquing(false)
  }

  function addPromotion(promo: FoundPromotion) {
    setPromoState((prev) => [...prev, { cardId: promo.cardId, badge: promo.badge, description: promo.description }])
    setFoundPromos((prev) => prev.map((p) =>
      p.cardId === promo.cardId && p.badge === promo.badge ? { ...p, added: true } : p
    ))
    setPromoModified(true)
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const verified      = verificationResults.filter((r) => r.status === 'verified')
  const discrepancies = verificationResults.filter((r) => r.status === 'discrepancy')
  const needsCheck    = verificationResults.filter((r) => r.status === 'needs_manual_check')

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: 'monospace', maxWidth: 940, margin: '0 auto', padding: '28px 24px', lineHeight: 1.6, color: '#1E293B' }}>

      <h1 style={{ color: '#1F4E79', marginBottom: 4, fontSize: 22 }}>CardSense SG — Admin Panel</h1>

      <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', padding: '8px 14px', borderRadius: 6, fontSize: 13, marginBottom: 28, color: '#713F12' }}>
        ⚠️ This page is for admin use only. Do not share this URL with users.
      </div>

      {!apiKey && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 24, color: '#991B1B' }}>
          <strong>API key missing.</strong> Add <code>VITE_ANTHROPIC_API_KEY=sk-ant-...</code> to your <code>.env.local</code> file and restart the dev server.
        </div>
      )}

      {/* ── Card Verification ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 16, borderBottom: '2px solid #CBD5E1', paddingBottom: 6, marginBottom: 10 }}>
          Card Database Verification
        </h2>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 0, marginBottom: 16 }}>
          Sends each of the {cardsState.length} cards to Claude for verification. Processes sequentially with a short delay to avoid rate limits.
        </p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <Btn onClick={runVerification} disabled={verifying || !apiKey} color="#1F4E79">
            {verifying
              ? `Verifying… (${progress.current} / ${progress.total})`
              : 'Run Verification'}
          </Btn>
          {verifying && (
            <Btn onClick={() => { cancelRef.current = true }} color="#DC2626">Cancel</Btn>
          )}
          {verificationResults.length > 0 && (
            <Btn onClick={() => downloadJson(cardsState, 'cards.json')} color="#16A34A">
              Download cards.json{cardsModified ? ' *' : ''}
            </Btn>
          )}
        </div>

        {log.length > 0 && (
          <pre style={{ background: '#0F172A', color: '#94A3B8', fontSize: 11, padding: '10px 14px', borderRadius: 6, maxHeight: 150, overflowY: 'auto', marginBottom: 16, lineHeight: 1.4 }}>
            {log.slice(-40).join('\n')}
          </pre>
        )}

        {verificationResults.length > 0 && (
          <>
            {/* Summary pills */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              <Pill bg="#DCFCE7" color="#15803D">{verified.length} verified</Pill>
              <Pill bg="#FEF9C3" color="#854D0E">{discrepancies.length} discrepanc{discrepancies.length === 1 ? 'y' : 'ies'}</Pill>
              <Pill bg="#FEE2E2" color="#991B1B">{needsCheck.length} need manual check</Pill>
            </div>

            {/* Verified */}
            {verified.length > 0 && (
              <ResultSection title={`✓  Verified (${verified.length})`} borderColor="#86EFAC" headBg="#DCFCE7" headColor="#15803D">
                {verified.map((r) => (
                  <VerifiedRow key={r.cardId} result={r} checked={checkedCards.has(r.cardId)} onMarkChecked={() => markAsChecked(r.cardId)} />
                ))}
              </ResultSection>
            )}

            {/* Discrepancies */}
            {discrepancies.length > 0 && (
              <ResultSection title={`⚠  Discrepancies (${discrepancies.length})`} borderColor="#FDE68A" headBg="#FEF9C3" headColor="#854D0E">
                {discrepancies.map((r) => (
                  <DiscrepancyRow
                    key={r.cardId}
                    result={r}
                    checked={checkedCards.has(r.cardId)}
                    onApplyFix={() => applyFix(r.cardId, r.corrections)}
                    onMarkChecked={() => markAsChecked(r.cardId)}
                  />
                ))}
              </ResultSection>
            )}

            {/* Needs manual check */}
            {needsCheck.length > 0 && (
              <ResultSection title={`✗  Manual Check Needed (${needsCheck.length})`} borderColor="#FECACA" headBg="#FEE2E2" headColor="#991B1B">
                {needsCheck.map((r) => (
                  <ManualCheckRow
                    key={r.cardId}
                    result={r}
                    checked={checkedCards.has(r.cardId)}
                    onMarkChecked={() => markAsChecked(r.cardId)}
                  />
                ))}
              </ResultSection>
            )}

            {cardsModified && (
              <p style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                * Unsaved in-memory changes. Click "Download cards.json" then replace <code>src/data/cards.json</code>.
              </p>
            )}
          </>
        )}
      </section>

      <hr style={{ borderColor: '#E2E8F0', marginBottom: 40 }} />

      {/* ── Product Critique ──────────────────────────────────────────────── */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 16, borderBottom: '2px solid #CBD5E1', paddingBottom: 6, marginBottom: 10 }}>
          Product Critique
        </h2>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 0, marginBottom: 16 }}>
          Simulates a CEO, CTO, and COO review of CardSense SG. Provides strengths, critical issues, and recommended actions from each perspective.
        </p>

        <div style={{ marginBottom: 20 }}>
          <Btn onClick={runCritique} disabled={critiquing || !apiKey} color="#7C3AED">
            {critiquing ? 'Consulting the executive team…' : 'Run CEO / CTO / COO Critique'}
          </Btn>
        </div>

        {critiquing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#7C3AED', marginBottom: 16 }}>
            <Spinner />
            Consulting the executive team...
          </div>
        )}

        {critiqueError && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', padding: '10px 14px', borderRadius: 6, fontSize: 13, color: '#991B1B', marginBottom: 16 }}>
            <strong>Error:</strong> {critiqueError}
          </div>
        )}

        {critiqueData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(['ceo', 'cto', 'coo'] as const).map((role) => {
              const labels: Record<string, { title: string; bg: string; border: string; head: string; headText: string }> = {
                ceo: { title: 'CEO — Business & Market', bg: '#F0F9FF', border: '#BAE6FD', head: '#0369A1', headText: '#FFFFFF' },
                cto: { title: 'CTO — Technical Architecture', bg: '#F5F3FF', border: '#C4B5FD', head: '#6D28D9', headText: '#FFFFFF' },
                coo: { title: 'COO — Operations & Compliance', bg: '#F0FDF4', border: '#86EFAC', head: '#15803D', headText: '#FFFFFF' },
              }
              const { title, bg, border, head, headText } = labels[role]
              const data = critiqueData[role]
              const isOpen = critiqueOpen[role]

              return (
                <div key={role} style={{ border: `1px solid ${border}`, borderRadius: 6, overflow: 'hidden' }}>
                  <button
                    onClick={() => setCritiqueOpen((prev) => ({ ...prev, [role]: !prev[role] }))}
                    style={{
                      width: '100%', textAlign: 'left', background: head, color: headText,
                      border: 'none', padding: '10px 16px', fontSize: 14, fontWeight: 700,
                      fontFamily: 'monospace', cursor: 'pointer', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    {title}
                    <span style={{ fontSize: 12, fontWeight: 400 }}>{isOpen ? '▲ collapse' : '▼ expand'}</span>
                  </button>

                  {isOpen && (
                    <div style={{ background: bg, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <CritiqueGroup label="Strengths" items={data.strengths} color="#15803D" bullet="✓" />
                      <CritiqueGroup label="Critical Issues" items={data.criticalIssues} color="#B91C1C" bullet="✗" />
                      <CritiqueGroup label="Recommended Actions" items={data.recommendedActions} color="#1D4ED8" bullet="→" numbered />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <hr style={{ borderColor: '#E2E8F0', marginBottom: 40 }} />

      {/* ── Promotions Scanner ────────────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: 16, borderBottom: '2px solid #CBD5E1', paddingBottom: 6, marginBottom: 10 }}>
          Promotions Scanner
        </h2>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 0, marginBottom: 16 }}>
          Asks Claude to identify current welcome bonuses and sign-up promotions not yet in promotions.json ({promoState.length} entries currently).
        </p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <Btn onClick={runPromotionScan} disabled={scanning || !apiKey} color="#1F4E79">
            {scanning ? 'Scanning…' : 'Run Promotions Scan'}
          </Btn>
          {promoModified && (
            <Btn onClick={() => downloadJson(promoState, 'promotions.json')} color="#16A34A">
              Download promotions.json *
            </Btn>
          )}
        </div>

        {!scanning && foundPromos.length === 0 && (
          <p style={{ fontSize: 13, color: '#9CA3AF' }}>No results yet.</p>
        )}

        {foundPromos.length > 0 && (
          <>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 10 }}>
              Found {foundPromos.length} promotion{foundPromos.length !== 1 ? 's' : ''}:
            </p>
            {foundPromos.map((p, i) => (
              <div
                key={i}
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 6,
                  padding: '12px 16px',
                  marginBottom: 8,
                  background: p.added ? '#F0FDF4' : '#FFFFFF',
                  opacity: p.added ? 0.65 : 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{p.cardName}</strong>
                  <span style={{ fontSize: 11, color: '#64748B', marginLeft: 8 }}>{p.cardId}</span>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#C2410C', marginTop: 3 }}>{p.badge}</div>
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{p.description}</div>
                </div>
                <Btn onClick={() => addPromotion(p)} disabled={p.added} color={p.added ? '#94A3B8' : '#16A34A'} small>
                  {p.added ? 'Added ✓' : 'Add to Database'}
                </Btn>
              </div>
            ))}
            {promoModified && (
              <p style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                * Click "Download promotions.json" then replace <code>src/data/promotions.json</code>.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function Btn({
  onClick, disabled = false, color, small = false, children,
}: {
  onClick: () => void
  disabled?: boolean
  color: string
  small?: boolean
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? '#94A3B8' : color,
        color: '#fff',
        border: 'none',
        padding: small ? '4px 10px' : '7px 18px',
        borderRadius: 5,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: small ? 12 : 13,
        fontFamily: 'monospace',
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

function Pill({ bg, color, children }: { bg: string; color: string; children: ReactNode }) {
  return (
    <span style={{ background: bg, color, padding: '3px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
      {children}
    </span>
  )
}

function ResultSection({
  title, borderColor, headBg, headColor, children,
}: {
  title: string
  borderColor: string
  headBg: string
  headColor: string
  children: ReactNode
}) {
  return (
    <div style={{ marginBottom: 22, border: `1px solid ${borderColor}`, borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ background: headBg, color: headColor, padding: '6px 14px', fontSize: 13, fontWeight: 700 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

const rowBase: CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid #F1F5F9',
  fontSize: 13,
}

function VerifiedRow({
  result, checked, onMarkChecked,
}: {
  result: VerificationResult
  checked: boolean
  onMarkChecked: () => void
}) {
  return (
    <div style={{ ...rowBase, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <div>
        <strong>{result.cardName}</strong>
        <span style={{ color: '#64748B', marginLeft: 8 }}>{result.bank}</span>
        {result.promotionsFound.length > 0 && (
          <div style={{ fontSize: 11, color: '#C2410C', marginTop: 2 }}>
            🎁 {result.promotionsFound.join(' · ')}
          </div>
        )}
        {result.sources.length > 0 && (
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>Sources: {result.sources.join(', ')}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>{result.confidence} confidence</span>
        <Btn onClick={onMarkChecked} disabled={checked} color={checked ? '#94A3B8' : '#475569'} small>
          {checked ? 'Checked ✓' : 'Mark as Checked'}
        </Btn>
      </div>
    </div>
  )
}

function DiscrepancyRow({
  result, checked, onApplyFix, onMarkChecked,
}: {
  result: VerificationResult
  checked: boolean
  onApplyFix: () => void
  onMarkChecked: () => void
}) {
  return (
    <div style={{ ...rowBase, borderColor: '#FEF08A' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div>
          <strong>{result.cardName}</strong>
          <span style={{ color: '#64748B', marginLeft: 8 }}>{result.bank}</span>
          <span style={{ fontSize: 11, color: '#854D0E', marginLeft: 8 }}>confidence: {result.confidence}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Btn onClick={onApplyFix} color="#1D4ED8" small>Apply Fix</Btn>
          <Btn onClick={onMarkChecked} disabled={checked} color={checked ? '#94A3B8' : '#475569'} small>
            {checked ? 'Checked ✓' : 'Mark as Checked'}
          </Btn>
        </div>
      </div>

      {result.issues.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: '#92400E' }}>Issues:</span>
          <ul style={{ margin: '2px 0 0', paddingLeft: 20, color: '#78350F' }}>
            {result.issues.map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
        </div>
      )}

      {result.suggestions.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontWeight: 700, color: '#1E40AF' }}>Suggestions:</span>
          <ul style={{ margin: '2px 0 0', paddingLeft: 20, color: '#1E40AF' }}>
            {result.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {Object.keys(result.corrections).length > 0 && (
        <div style={{ fontSize: 11, background: '#EFF6FF', padding: '4px 8px', borderRadius: 4, color: '#1D4ED8', marginTop: 4, wordBreak: 'break-all' }}>
          Structured corrections: {JSON.stringify(result.corrections)}
        </div>
      )}

      {result.promotionsFound.length > 0 && (
        <div style={{ fontSize: 12, color: '#C2410C', marginTop: 4 }}>
          🎁 Promotions found: {result.promotionsFound.join(' · ')}
        </div>
      )}

      {result.sources.length > 0 && (
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Sources: {result.sources.join(', ')}</div>
      )}
    </div>
  )
}

function ManualCheckRow({
  result, checked, onMarkChecked,
}: {
  result: VerificationResult
  checked: boolean
  onMarkChecked: () => void
}) {
  const q = encodeURIComponent(result.cardName)
  return (
    <div style={{ ...rowBase, borderColor: '#FECACA' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
        <div>
          <strong>{result.cardName}</strong>
          <span style={{ color: '#64748B', marginLeft: 8 }}>{result.bank}</span>
        </div>
        <Btn onClick={onMarkChecked} disabled={checked} color={checked ? '#94A3B8' : '#475569'} small>
          {checked ? 'Checked ✓' : 'Mark as Checked'}
        </Btn>
      </div>

      {result.issues.length > 0 && (
        <p style={{ fontSize: 12, color: '#991B1B', margin: '0 0 8px' }}>
          {result.issues[0]}
        </p>
      )}

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <ExternalLink href={`https://milelion.com/?s=${q}`}>MileLion →</ExternalLink>
        <ExternalLink href={`https://www.moneysmart.sg/search?q=${q}`}>MoneySmart →</ExternalLink>
        <ExternalLink href={`https://www.singsaver.com.sg/credit-cards?q=${q}`}>SingSaver →</ExternalLink>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 16, height: 16, border: '2px solid #C4B5FD',
      borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      flexShrink: 0,
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  )
}

function CritiqueGroup({
  label, items, color, bullet, numbered = false,
}: {
  label: string
  items: string[]
  color: string
  bullet: string
  numbered?: boolean
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 13, color: '#1E293B', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color, fontWeight: 700, flexShrink: 0, minWidth: 18 }}>
              {numbered ? `${i + 1}.` : bullet}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ fontSize: 12, color: '#1D4ED8', textDecoration: 'underline' }}>
      {children}
    </a>
  )
}
