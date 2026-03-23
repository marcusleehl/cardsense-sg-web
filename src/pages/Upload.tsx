import React, { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import { parseExcelFile } from '../utils/excelParser'
import { parsePdfFile } from '../utils/pdfParser'
import { categorise } from '../utils/categoriser'
import { SAMPLE_TRANSACTIONS } from '../utils/sampleData'
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
    const lower = file.name.toLowerCase()

    if (file.size > 20 * 1024 * 1024) {
      setEntries((prev) => [
        ...prev,
        {
          id, file, status: 'error', transactions: [], txCount: 0,
          error: 'File is too large. Please check you are uploading a bank statement and not another document type.',
        },
      ])
      return
    }

    if (!lower.endsWith('.xlsx') && !lower.endsWith('.csv') && !lower.endsWith('.pdf')) {
      setEntries((prev) => [
        ...prev,
        {
          id, file, status: 'error', transactions: [], txCount: 0,
          error: 'Please upload a Money Manager .xlsx export or a bank statement PDF.',
        },
      ])
      return
    }

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

    const rawCatCounts: Record<string, number> = {}
    for (const t of allTransactions) {
      const key = t.rawCategory || '(empty)'
      rawCatCounts[key] = (rawCatCounts[key] ?? 0) + 1
    }
    const sorted = Object.entries(rawCatCounts).sort((a, b) => b[1] - a[1])
    console.log(`[rawCategory audit] ${allTransactions.length} transactions, ${sorted.length} unique rawCategory values:`)
    sorted.forEach(([cat, count]) => console.log(`  ${String(count).padStart(4)}x  "${cat}"`))

    const spendProfile = buildSpendProfile(allTransactions)
    navigate('/analysis', { state: { transactions: allTransactions, spendProfile } })
  }

  function handleSampleData() {
    // ccCategory is already set on every sample transaction — skip categorise()
    const spendProfile = buildSpendProfile(SAMPLE_TRANSACTIONS)
    navigate('/analysis', { state: { transactions: SAMPLE_TRANSACTIONS, spendProfile, isSampleData: true } })
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col section-bg">
      <main className="flex-1 flex flex-col items-center px-4 pt-12 pb-16">
        <div className="w-full max-w-2xl">

          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <div className="text-center mb-12">
            <h1
              className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3"
              style={{ color: '#1F4E79' }}
            >
              CardSense SG
            </h1>
            <p className="text-xl font-medium text-gray-800 mb-2">
              Find the credit card that best suits your needs
            </p>
            <p className="text-base" style={{ color: '#6B7280' }}>
              Based on how you actually spend — not generic profiles
            </p>
          </div>

          {/* ── How it works ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 16V8M12 8L9 11M12 8L15 11" stroke="#1F4E79" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20 16.5V17C20 18.6569 18.6569 20 17 20H7C5.34315 20 4 18.6569 4 17V16.5" stroke="#1F4E79" strokeWidth="1.75" strokeLinecap="round"/>
                    <rect x="3" y="4" width="18" height="13" rx="2" stroke="#1F4E79" strokeWidth="1.75"/>
                  </svg>
                ),
                step: '1',
                title: 'Upload your spending data',
                sub: 'Bank statement PDF or Money Manager export',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="#1F4E79" strokeWidth="1.75"/>
                    <path d="M7 14L10 10L13 13L16 9" stroke="#1F4E79" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ),
                step: '2',
                title: 'We analyse your spending',
                sub: 'Automatic categorisation across 11 categories',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="6" width="20" height="14" rx="2.5" stroke="#1F4E79" strokeWidth="1.75"/>
                    <path d="M2 10H22" stroke="#1F4E79" strokeWidth="1.75"/>
                    <circle cx="6" cy="15" r="1.25" fill="#1F4E79"/>
                  </svg>
                ),
                step: '3',
                title: 'Get matched to your best card',
                sub: 'Personalised to your actual spending pattern',
              },
            ].map(({ icon, step, title, sub }) => (
              <div key={step} className="card-surface p-5 flex flex-col items-start gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#EFF6FF' }}
                >
                  {icon}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#6B7280' }}>
                    Step {step}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{title}</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#6B7280' }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Privacy badge ─────────────────────────────────────────────── */}
          <div
            className="flex items-start gap-3 rounded-xl px-4 py-3.5 mb-8 text-sm"
            style={{
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              color: '#15803D',
            }}
          >
            <svg
              className="flex-shrink-0 mt-0.5"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9 1.5L3 4V9C3 12.315 5.535 15.405 9 16.5C12.465 15.405 15 12.315 15 9V4L9 1.5Z"
                stroke="#16A34A"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M6.5 9L8 10.5L11.5 7"
                stroke="#16A34A"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              <strong>Your files never leave your browser.</strong> No data is uploaded to any server. Processing happens entirely on your device.
            </span>
          </div>

          {/* ── Data handling notice ─────────────────────────────────────── */}
          <div
            className="rounded-xl px-4 py-4 mb-8 text-sm leading-relaxed"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
          >
            <p className="font-semibold text-gray-800 mb-1">How we handle your data</p>
            <p style={{ color: '#6B7280' }}>
              Your spending data is processed entirely in your browser. Raw transactions are held in
              memory only for your current session and are permanently deleted when you close or
              refresh this tab. We never see, store or transmit your financial data.
            </p>
          </div>

          {/* ── Upload area ───────────────────────────────────────────────── */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="card-surface p-8 text-center mb-4 transition-colors"
            style={{
              border: dragOver
                ? '2px dashed #1F4E79'
                : '2px dashed #BFDBFE',
              backgroundColor: dragOver ? '#EFF6FF' : '#FFFFFF',
              borderRadius: 'var(--radius-card)',
            }}
          >
            {/* Upload icon */}
            <div className="flex justify-center mb-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: '#EFF6FF' }}
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 18V10M14 10L10.5 13.5M14 10L17.5 13.5" stroke="#1F4E79" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 20V22C4 23.1046 4.89543 24 6 24H22C23.1046 24 24 23.1046 24 22V20" stroke="#1F4E79" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            <p className="text-sm font-medium text-gray-700 mb-1">
              {dragOver ? 'Drop to import…' : 'Drag and drop your file here'}
            </p>
            <p className="text-xs mb-6" style={{ color: '#6B7280' }}>
              Supports PDF bank statements and Money Manager .xlsx exports
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              <button
                onClick={() => pdfInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 min-h-[44px]"
                style={{ backgroundColor: '#1F4E79' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 2H10L13 5V14H3V2Z" stroke="white" strokeWidth="1.25" strokeLinejoin="round"/>
                  <path d="M10 2V5H13" stroke="white" strokeWidth="1.25" strokeLinejoin="round"/>
                </svg>
                Upload Bank Statement PDF
              </button>
              <button
                onClick={() => xlsxInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 text-sm font-semibold transition-colors hover:bg-blue-50 min-h-[44px]"
                style={{ borderColor: '#1F4E79', color: '#1F4E79' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="14" height="14" rx="2" stroke="#1F4E79" strokeWidth="1.25"/>
                  <path d="M1 5H15" stroke="#1F4E79" strokeWidth="1.25"/>
                  <path d="M1 9H15" stroke="#1F4E79" strokeWidth="1.25"/>
                  <path d="M6 5V15" stroke="#1F4E79" strokeWidth="1.25"/>
                </svg>
                Upload Money Manager Export (.xlsx)
              </button>
            </div>

            <p className="text-xs" style={{ color: '#9CA3AF' }}>
              Also accepts credit card statements and personal Excel spending trackers
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

          {/* Sample data link */}
          <div className="text-center mb-2">
            <button
              className="text-sm font-medium underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: '#1F4E79' }}
              onClick={handleSampleData}
            >
              Or try with sample data →
            </button>
          </div>

          {/* ── File list ─────────────────────────────────────────────────── */}
          {entries.length > 0 && (
            <ul className="mt-5 space-y-2">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start justify-between bg-white rounded-xl px-4 py-3 gap-2"
                  style={{ border: '1px solid #E5E7EB', boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: '#F3F4F6' }}
                    >
                      {entry.file.name.endsWith('.pdf') ? (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M3 2H10L13 5V14H3V2Z" stroke="#6B7280" strokeWidth="1.25" strokeLinejoin="round"/>
                          <path d="M10 2V5H13" stroke="#6B7280" strokeWidth="1.25" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <rect x="1" y="1" width="14" height="14" rx="2" stroke="#6B7280" strokeWidth="1.25"/>
                          <path d="M1 5H15M1 9H15M6 5V15" stroke="#6B7280" strokeWidth="1.25"/>
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{entry.file.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{formatSize(entry.file.size)}</p>

                      {entry.status === 'parsing' && (
                        <span className="inline-flex items-center gap-1.5 text-xs mt-1.5" style={{ color: '#6B7280' }}>
                          <Spinner />
                          Reading your transactions…
                        </span>
                      )}
                      {entry.status === 'success' && (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1.5"
                          style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5L4 7L8 3" stroke="#15803D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {entry.txCount} transaction{entry.txCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {entry.status === 'error' && (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full mt-1.5 max-w-full"
                          style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
                          title={entry.error}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M3 3L7 7M7 3L3 7" stroke="#991B1B" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          <span className="truncate">{entry.error}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-red-50 -mr-1 mt-0.5"
                    aria-label="Remove file"
                    style={{ color: '#9CA3AF' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* ── Analyse button ─────────────────────────────────────────────── */}
          <button
            disabled={!hasSuccess || anyParsing}
            onClick={handleAnalyse}
            className="mt-6 w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all"
            style={
              hasSuccess && !anyParsing
                ? { backgroundColor: '#1F4E79' }
                : { backgroundColor: '#D1D5DB', cursor: 'not-allowed', color: '#9CA3AF' }
            }
          >
            {anyParsing
              ? 'Reading your transactions…'
              : hasSuccess
              ? 'Analyse My Spending →'
              : 'Upload a file to get started'}
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
      className="animate-spin h-3.5 w-3.5"
      style={{ color: '#6B7280' }}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
