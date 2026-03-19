import React, { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import { parseExcelFile } from '../utils/excelParser'
import { parsePdfFile } from '../utils/pdfParser'
import { categorise } from '../utils/categoriser'
import type { Transaction } from '../utils/excelParser'
import type { SpendProfile } from './Analysis'

// ── per-file state ────────────────────────────────────────────────────────────

type FileStatus = 'parsing' | 'success' | 'error'

interface UploadEntry {
  id: string
  file: File
  status: FileStatus
  transactions: Transaction[]
  txCount: number
  error: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function buildSpendProfile(transactions: Transaction[]): SpendProfile {
  const categoryTotals: Record<string, number> = {}
  for (const tx of transactions) {
    categoryTotals[tx.ccCategory] = (categoryTotals[tx.ccCategory] ?? 0) + tx.amount
  }

  const dates = transactions.map((t) => t.date).sort()
  const dateFrom = dates[0] ?? ''
  const dateTo = dates[dates.length - 1] ?? ''

  let months = 1
  if (dateFrom && dateTo) {
    const from = new Date(dateFrom)
    const to = new Date(dateTo)
    months = Math.max(
      1,
      (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
    )
  }

  const avgMonthlyByCategory: Record<string, number> = {}
  for (const [cat, total] of Object.entries(categoryTotals)) {
    avgMonthlyByCategory[cat] = total / months
  }

  return {
    categoryTotals,
    avgMonthlyByCategory,
    totalSpend: transactions.reduce((s, t) => s + t.amount, 0),
    transactionCount: transactions.length,
    dateRange: { from: dateFrom, to: dateTo },
    months,
  }
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Upload() {
  const navigate = useNavigate()
  const xlsxInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const [entries, setEntries] = useState<UploadEntry[]>([])
  const [dragOver, setDragOver] = useState(false)

  // ── parse a single file and update its entry ────────────────────────────

  async function parseAndAdd(file: File) {
    const id = `${file.name}-${Date.now()}-${Math.random()}`

    // Immediately add entry in 'parsing' state
    setEntries((prev) => [
      ...prev,
      { id, file, status: 'parsing', transactions: [], txCount: 0, error: '' },
    ])

    try {
      const parsed = file.name.endsWith('.pdf')
        ? await parsePdfFile(file)
        : await parseExcelFile(file)

      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, status: 'success', transactions: parsed, txCount: parsed.length }
            : e
        )
      )
    } catch (err) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, status: 'error', error: err instanceof Error ? err.message : String(err) }
            : e
        )
      )
    }
  }

  function handleFileList(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach((file) => parseAndAdd(file))
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  // ── drag and drop ───────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    handleFileList(e.dataTransfer.files)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── analyse ─────────────────────────────────────────────────────────────

  const successEntries = entries.filter((e) => e.status === 'success')
  const hasSuccess = successEntries.length > 0
  const anyParsing = entries.some((e) => e.status === 'parsing')

  function handleAnalyse() {
    const allTransactions = successEntries
      .flatMap((e) => e.transactions)
      .map((t) => ({ ...t, ccCategory: categorise(t) }))

    // ── DEBUG: rawCategory audit ──────────────────────────────────────────────
    const rawCatCounts: Record<string, number> = {}
    for (const t of allTransactions) {
      const key = t.rawCategory || '(empty)'
      rawCatCounts[key] = (rawCatCounts[key] ?? 0) + 1
    }
    const sorted = Object.entries(rawCatCounts).sort((a, b) => b[1] - a[1])
    console.log(`[rawCategory audit] ${allTransactions.length} transactions, ${sorted.length} unique rawCategory values:`)
    sorted.forEach(([cat, count]) => console.log(`  ${String(count).padStart(4)}x  "${cat}"`))
    // ── END DEBUG ─────────────────────────────────────────────────────────────

    const spendProfile = buildSpendProfile(allTransactions)
    navigate('/analysis', { state: { transactions: allTransactions, spendProfile } })
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          {/* Heading */}
          <h1 className="text-4xl font-bold text-center mb-2" style={{ color: '#1F4E79' }}>
            CardSense SG
          </h1>
          <p className="text-center text-gray-500 mb-10 text-lg">
            Find your perfect Singapore credit card
          </p>

          {/* Upload area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="rounded-2xl p-8 bg-white text-center transition-colors"
            style={{
              border: dragOver
                ? '2px dashed #1F4E79'
                : '2px dashed #BFDBFE',
              backgroundColor: dragOver ? '#EFF6FF' : '#FFFFFF',
            }}
          >
            <p className="text-gray-500 mb-6 text-sm">
              {dragOver
                ? 'Drop to import…'
                : 'Upload your spending data to get started'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              <button
                onClick={() => xlsxInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors hover:bg-blue-50"
                style={{ borderColor: '#1F4E79', color: '#1F4E79' }}
              >
                <span>📊</span> Import Money Manager Excel (.xlsx)
              </button>
              <button
                onClick={() => pdfInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors hover:bg-blue-50"
                style={{ borderColor: '#1F4E79', color: '#1F4E79' }}
              >
                <span>📄</span> Import Bank Statement PDF (.pdf)
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Or drag and drop files here · You can import multiple files
            </p>

            <input
              ref={xlsxInputRef}
              type="file"
              accept=".xlsx,.csv"
              multiple
              className="hidden"
              onChange={(e) => { handleFileList(e.target.files); e.target.value = '' }}
            />
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => { handleFileList(e.target.files); e.target.value = '' }}
            />
          </div>

          {/* File list */}
          {entries.length > 0 && (
            <ul className="mt-4 space-y-2">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-gray-100 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-lg flex-shrink-0">
                      {entry.file.name.endsWith('.pdf') ? '📄' : '📊'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {entry.file.name}
                      </p>
                      <p className="text-xs text-gray-400">{formatSize(entry.file.size)}</p>
                    </div>

                    {/* Status badge */}
                    {entry.status === 'parsing' && (
                      <span className="flex items-center gap-1.5 text-xs text-gray-400 flex-shrink-0">
                        <Spinner />
                        Reading your transactions
                      </span>
                    )}
                    {entry.status === 'success' && (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex-shrink-0">
                        ✓ {entry.txCount} transaction{entry.txCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {entry.status === 'error' && (
                      <span
                        className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex-shrink-0 max-w-[200px] truncate"
                        title={entry.error}
                      >
                        ✕ {entry.error}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="ml-3 text-gray-300 hover:text-red-400 transition-colors text-xl leading-none flex-shrink-0"
                    aria-label="Remove file"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Analyse button */}
          <button
            disabled={!hasSuccess || anyParsing}
            onClick={handleAnalyse}
            className="mt-6 w-full py-3 rounded-xl text-white font-semibold text-base transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#1F4E79' }}
          >
            {anyParsing ? 'Reading your transactions…' : 'Analyse My Spending'}
          </button>
        </div>
      </main>
      <Footer />
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-3.5 w-3.5 text-gray-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
