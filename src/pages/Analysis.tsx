import { useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import Footer from '../components/Footer'
import { overrideCategory, CATEGORIES } from '../utils/categoriser'
import { categorise } from '../utils/categoriser'
import type { Transaction } from '../utils/excelParser'
import type { Category } from '../utils/categoriser'

// ── colours ───────────────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  DINING: '#D85A30',
  TRAVEL: '#185FA5',
  TRANSPORT: '#0F6E56',
  'ONLINE SHOPPING': '#534AB7',
  'RETAIL SHOPPING': '#3B6D11',
  GROCERIES: '#854F0B',
  'HEALTH AND BEAUTY': '#993556',
  ENTERTAINMENT: '#5F5E5A',
  'STREAMING AND SUBSCRIPTIONS': '#2E75B6',
  EDUCATION: '#375623',
  OTHERS: '#888780',
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtSGD(n: number) {
  return n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function applyCategories(txs: Transaction[]): Transaction[] {
  return txs.map((t) => ({ ...t, ccCategory: categorise(t) }))
}

// ── types ─────────────────────────────────────────────────────────────────────

export interface SpendProfile {
  categoryTotals: Record<string, number>
  avgMonthlyByCategory: Record<string, number>
  totalSpend: number
  transactionCount: number
  dateRange: { from: string; to: string }
  months: number
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Analysis() {
  const location = useLocation()
  const navigate = useNavigate()

  const incoming: Transaction[] = location.state?.transactions ?? []
  if (incoming.length === 0) {
    navigate('/', { replace: true })
    return null
  }

  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    applyCategories(incoming)
  )
  const [activeFilter, setActiveFilter] = useState<Category | 'All'>('All')
  const [openTxId, setOpenTxId] = useState<string | null>(null)

  // ── re-categorise handler ────────────────────────────────────────────────

  const handleOverride = useCallback((merchant: string, category: string) => {
    overrideCategory(merchant, category)
    setTransactions((prev) => applyCategories(prev))
    setOpenTxId(null)
  }, [])

  // ── derived data ─────────────────────────────────────────────────────────

  const totalSpend = transactions.reduce((s, t) => s + t.amount, 0)

  const categoryTotals = transactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.ccCategory] = (acc[t.ccCategory] ?? 0) + t.amount
    return acc
  }, {})

  const sortedCategories = CATEGORIES.filter((c) => categoryTotals[c] > 0).sort(
    (a, b) => (categoryTotals[b] ?? 0) - (categoryTotals[a] ?? 0)
  )

  const topCategory = sortedCategories[0] ?? '—'

  const dates = transactions.map((t) => t.date).sort()
  const dateFrom = dates[0] ?? '—'
  const dateTo = dates[dates.length - 1] ?? '—'

  const donutData = sortedCategories.map((cat) => ({
    name: cat,
    value: categoryTotals[cat] ?? 0,
  }))

  const maxCategorySpend =
    sortedCategories.length > 0 ? (categoryTotals[sortedCategories[0]] ?? 0) : 1

  const filtered =
    activeFilter === 'All'
      ? transactions
      : transactions.filter((t) => t.ccCategory === activeFilter)

  const categoriesWithTx: (Category | 'All')[] = ['All', ...sortedCategories]

  const spendProfile: SpendProfile = location.state?.spendProfile ?? {
    categoryTotals,
    avgMonthlyByCategory: categoryTotals,
    totalSpend,
    transactionCount: transactions.length,
    dateRange: { from: dateFrom, to: dateTo },
    months: 1,
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <main className="flex-1 px-4 py-10 max-w-4xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-8" style={{ color: '#1F4E79' }}>
          Your Spending Analysis
        </h1>

        {/* ── Summary row ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total Spend" value={`S$${fmtSGD(totalSpend)}`} />
          <MetricCard label="Transactions" value={String(transactions.length)} />
          <MetricCard
            label="Date Range"
            value={dateFrom === '—' ? '—' : `${dateFrom}\n${dateTo}`}
            small
          />
          <MetricCard
            label="Top Category"
            value={topCategory}
            color={CATEGORY_COLORS[topCategory]}
            small
          />
        </div>

        {/* ── Continue button (top) ─────────────────────────────────── */}
        <button
          onClick={() => navigate('/preferences', { state: { spendProfile } })}
          className="w-full py-3 rounded-xl text-white font-semibold text-base transition-opacity mb-8"
          style={{ backgroundColor: '#1F4E79' }}
        >
          Continue to Preferences →
        </button>

        {/* ── Data quality warnings ──────────────────────────────────── */}
        {spendProfile.months < 2 && (
          <div
            className="flex gap-2.5 p-4 rounded-xl mb-6 text-sm leading-relaxed"
            style={{ backgroundColor: '#FEF9C3', color: '#713F12', border: '1px solid #FDE68A' }}
          >
            <span className="flex-shrink-0">⚠️</span>
            <span>
              For more accurate recommendations upload at least 3 months of spending history.
              Your current results may not fully reflect your spending patterns.
            </span>
          </div>
        )}

        {totalSpend > 0 && (categoryTotals['OTHERS'] ?? 0) / totalSpend > 0.8 && (
          <div
            className="flex gap-2.5 p-4 rounded-xl mb-6 text-sm leading-relaxed"
            style={{ backgroundColor: '#FEF9C3', color: '#713F12', border: '1px solid #FDE68A' }}
          >
            <span className="flex-shrink-0">⚠️</span>
            <span>
              Most of your transactions were not automatically categorised.{' '}
              <button
                onClick={() => setActiveFilter('OTHERS' as Category)}
                className="underline font-semibold"
                style={{ color: '#92400E' }}
              >
                Click here to manually categorise them
              </button>{' '}
              for a more accurate recommendation.
            </span>
          </div>
        )}

        {/* ── Donut chart / mobile list ──────────────────────────────── */}
        {donutData.length > 0 && (
          <>
            {/* Mobile: sorted list view (hidden on sm+) */}
            <div className="sm:hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
              <h2 className="text-base font-semibold text-gray-700 mb-4">Spend by Category</h2>
              <div className="space-y-3">
                {donutData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[entry.name] ?? '#888780' }}
                    />
                    <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{entry.name}</span>
                    <span className="text-sm font-medium text-gray-800 flex-shrink-0">
                      S${fmtSGD(entry.value)}
                    </span>
                    <span className="text-xs text-gray-400 w-10 text-right flex-shrink-0">
                      {totalSpend > 0 ? `${((entry.value / totalSpend) * 100).toFixed(1)}%` : '0%'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: donut chart (hidden on mobile) */}
            <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
              <h2 className="text-base font-semibold text-gray-700 mb-4">Spend by Category</h2>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div style={{ width: 220, height: 220, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={100}
                        dataKey="value"
                        strokeWidth={2}
                      >
                        {donutData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={CATEGORY_COLORS[entry.name] ?? '#888780'}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* HTML legend */}
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {donutData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <span
                        className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[entry.name] ?? '#888780' }}
                      />
                      <span className="text-gray-700">{entry.name}</span>
                      <span className="text-gray-400">
                        {totalSpend > 0
                          ? `${((entry.value / totalSpend) * 100).toFixed(1)}%`
                          : '0%'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Category bars ─────────────────────────────────────────── */}
        {sortedCategories.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
            <h2 className="text-base font-semibold text-gray-700 mb-4">Category Breakdown</h2>
            <div className="space-y-3">
              {sortedCategories.map((cat) => {
                const spend = categoryTotals[cat] ?? 0
                const count = transactions.filter((t) => t.ccCategory === cat).length
                const pct = maxCategorySpend > 0 ? (spend / maxCategorySpend) * 100 : 0
                return (
                  <div key={cat} className="flex items-center gap-2 sm:gap-3">
                    <span className="w-24 sm:w-40 text-sm text-gray-600 flex-shrink-0 truncate">{cat}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden min-w-0">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: CATEGORY_COLORS[cat] ?? '#888780',
                        }}
                      />
                    </div>
                    <span className="w-20 sm:w-24 text-right text-sm font-medium text-gray-800 flex-shrink-0">
                      S${fmtSGD(spend)}
                    </span>
                    <span className="hidden sm:inline-block w-14 text-right text-xs text-gray-400 flex-shrink-0">
                      {count} txn{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Transaction list ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Transactions</h2>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {categoriesWithTx.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                style={
                  activeFilter === cat
                    ? {
                        backgroundColor:
                          cat === 'All' ? '#1F4E79' : (CATEGORY_COLORS[cat] ?? '#888780'),
                        color: '#fff',
                      }
                    : { backgroundColor: '#F3F4F6', color: '#374151' }
                }
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">No transactions</p>
            )}
            {filtered.map((tx) => (
              <div key={tx.id}>
                <button
                  className="w-full text-left px-2 py-3 hover:bg-gray-50 rounded-lg transition-colors"
                  onClick={() => setOpenTxId(openTxId === tx.id ? null : tx.id)}
                >
                  {/* Line 1: merchant name (+ amount on sm+) */}
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-800 truncate min-w-0 flex-1">
                      {tx.merchant || '—'}
                    </p>
                    <span className="hidden sm:inline text-sm font-semibold text-gray-800 flex-shrink-0">
                      S${fmtSGD(tx.amount)}
                    </span>
                  </div>
                  {/* Line 2: date + category + source (+ amount on mobile) */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-400">{tx.date}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                      style={{
                        backgroundColor: CATEGORY_COLORS[tx.ccCategory] ?? '#888780',
                      }}
                    >
                      {tx.ccCategory}
                    </span>
                    {tx.source && (
                      <span className="text-xs text-gray-300">{tx.source}</span>
                    )}
                    <span className="sm:hidden text-sm font-semibold text-gray-800 ml-auto flex-shrink-0">
                      S${fmtSGD(tx.amount)}
                    </span>
                  </div>
                </button>

                {/* Inline category picker */}
                {openTxId === tx.id && (
                  <div className="mx-2 mb-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-500 mb-2 font-medium">
                      Recategorise "{tx.merchant}"
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => handleOverride(tx.merchant, cat)}
                          className="px-2.5 py-1 rounded-full text-xs font-medium text-white transition-opacity hover:opacity-80"
                          style={{
                            backgroundColor: CATEGORY_COLORS[cat] ?? '#888780',
                            outline: tx.ccCategory === cat ? '2px solid #1F4E79' : 'none',
                            outlineOffset: '2px',
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer note ───────────────────────────────────────────── */}
        <p className="text-xs text-gray-400 text-center mb-6">
          Your files were processed locally in your browser. No data was uploaded.
        </p>

        {/* ── Continue button ───────────────────────────────────────── */}
        <button
          onClick={() => navigate('/preferences', { state: { spendProfile } })}
          className="w-full py-3 rounded-xl text-white font-semibold text-base transition-opacity"
          style={{ backgroundColor: '#1F4E79' }}
        >
          Continue to Preferences
        </button>
      </main>
      <Footer />
    </div>
  )
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  color,
  small,
}: {
  label: string
  value: string
  color?: string
  small?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">{label}</p>
      <p
        className={`font-bold leading-tight whitespace-pre-line ${small ? 'text-sm' : 'text-xl'}`}
        style={color ? { color } : { color: '#1F4E79' }}
      >
        {value}
      </p>
    </div>
  )
}
