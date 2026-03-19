import * as pdfjsLib from 'pdfjs-dist'
import type { Transaction } from './excelParser'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.5.207/pdf.worker.min.mjs'

export type { Transaction }

// ── regex patterns ────────────────────────────────────────────────────────────

// Pattern A: DD MMM YYYY  <description>  <amount> [CR]
// e.g. "15 Jan 2024  GRAB FOOD  12.50"
const PATTERN_A =
  /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(CR)?$/i

// Pattern B: DD MMM  <description>  <amount> [CR]  (UOB — no year)
// e.g. "15 Jan  GRAB FOOD  12.50"
const PATTERN_B =
  /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(.+?)\s+([\d,]+\.\d{2})\s*(CR)?$/i

// Pattern C: DD/MM/YYYY  <description>  <amount> [CR]
// e.g. "15/01/2024  GRAB FOOD  12.50"
const PATTERN_C = /^(\d{2})\/(\d{2})\/(\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(CR)?$/i

// Pattern D: DD/MM  <description>  <amount> [CR]  (OCBC — no year)
// e.g. "15/01  GRAB FOOD  12.50"
const PATTERN_D = /^(\d{2})\/(\d{2})\s+(.+?)\s+([\d,]+\.\d{2})\s*(CR)?$/i

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

const SKIP_WORDS = [
  'balance', 'payment', 'minimum', 'credit limit', 'thank you',
  'total', 'sub-total', 'statement date', 'due date',
]

function shouldSkip(description: string): boolean {
  const lower = description.toLowerCase()
  return SKIP_WORDS.some((w) => lower.includes(w))
}

function pad2(s: string | number): string {
  return String(s).padStart(2, '0')
}

// Infer a plausible year for short-date formats (no year in PDF)
// Prefer the current year; if the resulting date is in the future, use prior year.
function inferYear(month: string, day: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const candidate = new Date(`${year}-${month}-${day}`)
  return candidate > now ? String(year - 1) : String(year)
}

// ── line reconstruction ───────────────────────────────────────────────────────

interface TextItem {
  str: string
  transform: number[] // [scaleX, skewX, skewY, scaleY, x, y]
}

// Group text items into lines by rounding their Y coordinate.
function extractLines(items: TextItem[]): string[] {
  const buckets = new Map<number, string[]>()

  for (const item of items) {
    if (!item.str.trim()) continue
    const y = Math.round(item.transform[5])
    if (!buckets.has(y)) buckets.set(y, [])
    buckets.get(y)!.push(item.str)
  }

  // Sort descending by Y (top of page first in PDF coordinate space)
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, parts]) => parts.join(' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
}

// ── main export ───────────────────────────────────────────────────────────────

export async function parsePdfFile(file: File): Promise<Transaction[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const allLines: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const items = content.items
      .filter((it) => 'str' in it && 'transform' in it)
      .map((it) => it as unknown as TextItem)
    allLines.push(...extractLines(items))
  }

  const transactions: Transaction[] = []

  for (const line of allLines) {
    let date = ''
    let description = ''
    let amountStr = ''
    let isCR = false

    let m: RegExpMatchArray | null

    if ((m = line.match(PATTERN_A))) {
      const [, day, mon, year, desc, amt, cr] = m
      date = `${year}-${MONTH_MAP[mon.toLowerCase()]}-${pad2(day)}`
      description = desc.trim()
      amountStr = amt
      isCR = !!cr
    } else if ((m = line.match(PATTERN_C))) {
      const [, day, month, year, desc, amt, cr] = m
      date = `${year}-${pad2(month)}-${pad2(day)}`
      description = desc.trim()
      amountStr = amt
      isCR = !!cr
    } else if ((m = line.match(PATTERN_B))) {
      const [, day, mon, desc, amt, cr] = m
      const month = MONTH_MAP[mon.toLowerCase()]
      date = `${inferYear(month, pad2(day))}-${month}-${pad2(day)}`
      description = desc.trim()
      amountStr = amt
      isCR = !!cr
    } else if ((m = line.match(PATTERN_D))) {
      const [, day, month, desc, amt, cr] = m
      date = `${inferYear(pad2(month), pad2(day))}-${pad2(month)}-${pad2(day)}`
      description = desc.trim()
      amountStr = amt
      isCR = !!cr
    } else {
      continue
    }

    if (isCR) continue
    if (shouldSkip(description)) continue

    const amount = parseFloat(amountStr.replace(/,/g, ''))
    if (amount > 50000) continue

    transactions.push({
      id: `${date}-${description}-${amount}`,
      date,
      account: '',
      rawCategory: '',
      merchant: description,
      amount,
      source: file.name,
      ccCategory: '',
    })
  }

  if (transactions.length === 0) {
    throw new Error(
      'No transactions found. This PDF may be a scanned image. Please download a digital statement directly from your bank app or internet banking portal.'
    )
  }

  return transactions
}
