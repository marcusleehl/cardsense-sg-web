import * as XLSX from 'xlsx'

export interface Transaction {
  id: string
  date: string
  account: string
  rawCategory: string
  merchant: string
  amount: number
  source: string
  ccCategory: string
}

// Strip leading emoji characters from a string
function stripEmoji(str: string): string {
  return str.replace(/^[\p{Emoji}\s]+/u, '').trim()
}

// Convert a SheetJS date serial or date string to YYYY-MM-DD
function toDateString(value: unknown): string {
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    const y = date.y
    const m = String(date.m).padStart(2, '0')
    const d = String(date.d).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'string') {
    // Expect formats like "2024/01/15 10:30" or "2024-01-15 10:30"
    const match = value.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
  }
  return String(value ?? '')
}

export async function parseExcelFile(file: File): Promise<Transaction[]> {
  const data = await file.arrayBuffer()
  const wb = XLSX.read(data)

  const sheetName = wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  if (rows.length === 0) {
    throw new Error(
      'This does not look like a Money Manager export. Please use More then Backup/Restore then Export to Excel in the app.'
    )
  }

  // Auto-detect column positions by matching header names case-insensitively
  const headerMap: Record<string, string> = {}
  const sampleRow = rows[0]
  for (const key of Object.keys(sampleRow)) {
    const lower = key.toLowerCase().trim()
    if (lower === 'period') headerMap['period'] = key
    else if (lower === 'accounts') headerMap['accounts'] = key
    else if (lower === 'category') headerMap['category'] = key
    else if (lower === 'subcategory') headerMap['subcategory'] = key
    else if (lower === 'note') headerMap['note'] = key
    else if (lower === 'sgd') headerMap['sgd'] = key
    else if (lower === 'income/expense') headerMap['income/expense'] = key
  }

  const required = ['period', 'accounts', 'category', 'note', 'sgd', 'income/expense']
  const missing = required.filter((k) => !headerMap[k])
  if (missing.length > 0) {
    throw new Error(
      'This does not look like a Money Manager export. Please use More then Backup/Restore then Export to Excel in the app.'
    )
  }

  const colPeriod = headerMap['period']
  const colAccounts = headerMap['accounts']
  const colCategory = headerMap['category']
  const colNote = headerMap['note']
  const colSgd = headerMap['sgd']
  const colIncExp = headerMap['income/expense']

  const transactions: Transaction[] = []

  for (const row of rows) {
    const incExp = String(row[colIncExp] ?? '').trim()
    if (!incExp.toLowerCase().includes('exp')) continue

    const dateStr = toDateString(row[colPeriod])
    const merchant = String(row[colNote] ?? '').trim()
    const amount = Number(row[colSgd] ?? 0)
    const account = String(row[colAccounts] ?? '').trim()
    const rawCategory = stripEmoji(String(row[colCategory] ?? ''))

    const id = `${dateStr}-${merchant}-${amount}`

    transactions.push({
      id,
      date: dateStr,
      account,
      rawCategory,
      merchant,
      amount,
      source: file.name,
      ccCategory: '',
    })
  }

  return transactions
}
