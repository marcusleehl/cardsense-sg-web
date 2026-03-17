import * as XLSX from 'xlsx'

export interface Transaction {
  date: string
  description: string
  amount: number
  category?: string
}

export async function parseExcelFile(file: File): Promise<Transaction[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
        // TODO: map rows to Transaction shape based on Money Manager export format
        const transactions: Transaction[] = rows.map((row) => ({
          date: String(row['Date'] ?? ''),
          description: String(row['Description'] ?? row['Memo'] ?? ''),
          amount: Number(row['Amount'] ?? 0),
        }))
        resolve(transactions)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
