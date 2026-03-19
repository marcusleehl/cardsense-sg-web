import { useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import cardsData from '../data/cards.json'
import { getActivePromotions } from '../utils/promotions'
import type { Promotion } from '../utils/promotions'
import {
  recommendFromProfile,
  computeCoveredRates,
  EARN_KEYS,
  EARN_LABELS,
} from '../utils/engine'
import type { Card, RecommendationResult, UserPreferences } from '../utils/engine'
import type { SpendProfile } from './Analysis'

// ── helpers ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cardSensePrefs'

function loadPrefs(): UserPreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function fmtSGD(n: number): string {
  return n.toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function krisFlyerContext(miles: number): string {
  if (miles < 7_500)  return 'Building towards SIN-KUL Economy (7,500 miles)'
  if (miles < 15_000) return 'Enough for SIN-KUL Economy one-way per year'
  if (miles < 35_500) return 'Enough for SIN-BKK Economy one-way per year'
  if (miles < 62_500) return 'Enough for SIN-TYO Business one-way per year'
  if (miles < 93_750) return 'Enough for SIN-LHR Economy one-way per year'
  return 'Enough for SIN-LHR Business one-way per year'
}

// ── gap analysis pill ─────────────────────────────────────────────────────────

type CoverageLevel = 'green' | 'amber' | 'red'

function coverageLevel(rate: number): CoverageLevel {
  if (rate > 0.02) return 'green'
  if (rate > 0)    return 'amber'
  return 'red'
}

const COVERAGE_STYLES: Record<CoverageLevel, { bg: string; text: string; ring: string }> = {
  green: { bg: '#DCFCE7', text: '#15803D', ring: '#BBF7D0' },
  amber: { bg: '#FEF9C3', text: '#854D0E', ring: '#FDE68A' },
  red:   { bg: '#FEE2E2', text: '#991B1B', ring: '#FECACA' },
}

const COVERAGE_DOTS: Record<CoverageLevel, string> = {
  green: '#22C55E',
  amber: '#F59E0B',
  red:   '#EF4444',
}

// ── reward badge ──────────────────────────────────────────────────────────────

function RewardBadge({ type, large }: { type: string; large?: boolean }) {
  const styles: Record<string, { bg: string; color: string }> = {
    miles:    { bg: '#EFF6FF', color: '#1D4ED8' },
    cashback: { bg: '#F0FDF4', color: '#15803D' },
    points:   { bg: '#FFF7ED', color: '#C2410C' },
  }
  const s = styles[type] ?? styles.points
  return (
    <span
      className={`font-semibold uppercase tracking-wide rounded-full ${large ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-xs'}`}
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {type}
    </span>
  )
}

// ── category chip ─────────────────────────────────────────────────────────────

function CategoryChip({ label }: { label: string }) {
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      {label}
    </span>
  )
}

// ── apply button ──────────────────────────────────────────────────────────────

function ApplyButton({ url, large }: { url: string; large?: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center font-semibold rounded-xl text-white transition-opacity hover:opacity-90 ${large ? 'w-full py-3 text-base' : 'px-4 py-2 text-sm'}`}
      style={{ backgroundColor: '#1F4E79' }}
    >
      Apply Now →
    </a>
  )
}

// ── component ─────────────────────────────────────────────────────────────────

type SortMode = 'best' | 'miles' | 'cashback'

export default function Recommendations() {
  const location  = useLocation()
  const navigate  = useNavigate()

  const spendProfile: SpendProfile | null = location.state?.spendProfile ?? null
  const statePrefs: UserPreferences | null = location.state?.prefs ?? null
  const prefs = statePrefs ?? loadPrefs()

  // Redirect if wizard wasn't completed
  if (!prefs || !prefs.rewardPriority) {
    navigate('/', { replace: true })
    return null
  }

  const cards = cardsData as unknown as Card[]

  // ── covered rates for gap analysis ─────────────────────────────────────────
  const coveredRates = useMemo(
    () => computeCoveredRates(prefs.existingCards, cards),
    [prefs.existingCards, cards],
  )

  // ── compute recommendation sets ────────────────────────────────────────────
  const avgMonthly: Record<string, number> = spendProfile?.avgMonthlyByCategory ?? {}

  // Best Value respects the user's reward priority preference
  const allResults = useMemo(() => {
    const bestCards =
      prefs.rewardPriority === 'miles'    ? cards.filter((c) => c.rewardType === 'miles' || c.rewardType === 'points')
      : prefs.rewardPriority === 'cashback' ? cards.filter((c) => c.rewardType === 'cashback')
      : cards
    return recommendFromProfile(avgMonthly, prefs, bestCards)
  }, [])
  const milesResults    = useMemo(() => recommendFromProfile(avgMonthly, prefs, cards.filter((c) => c.rewardType === 'miles' || c.rewardType === 'points')), [])
  const cashbackResults = useMemo(() => recommendFromProfile(avgMonthly, prefs, cards.filter((c) => c.rewardType === 'cashback')), [])

  const defaultTab: SortMode =
    prefs.rewardPriority === 'miles'    ? 'miles'
    : prefs.rewardPriority === 'cashback' ? 'cashback'
    : 'best'

  const [sortMode, setSortMode] = useState<SortMode>(defaultTab)
  const [compareIds, setCompareIds]   = useState<Set<string>>(new Set())

  const results: RecommendationResult[] =
    sortMode === 'miles'    ? milesResults
    : sortMode === 'cashback' ? cashbackResults
    : allResults

  const [hero, ...alternatives] = results

  function toggleCompare(cardId: string) {
    setCompareIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  function promoFor(cardId: string): Promotion | undefined {
    const promos = getActivePromotions(cardId)
    return promos.length > 0 ? promos[0] : undefined
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <main className="flex-1 px-4 py-10 max-w-4xl mx-auto w-full pb-24">

        {/* ── Progress ──────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Step 3 of 3 — Your Recommendations</span>
            <span className="text-sm font-semibold" style={{ color: '#1F4E79' }}>100%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full w-full" style={{ backgroundColor: '#1F4E79' }} />
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-8" style={{ color: '#1F4E79' }}>
          Your Recommendations
        </h1>

        {/* ── Sort control ──────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-gray-200 rounded-xl mb-6 w-full sm:w-fit">
          {(
            [
              { id: 'best',     label: 'Best Value' },
              { id: 'miles',    label: 'Miles' },
              { id: 'cashback', label: 'Cashback' },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSortMode(id)}
              className="flex-1 sm:flex-none px-4 py-2 sm:py-1.5 rounded-lg text-sm font-medium transition-all min-h-[44px] sm:min-h-0"
              style={
                sortMode === id
                  ? { backgroundColor: '#1F4E79', color: '#FFFFFF' }
                  : { backgroundColor: 'transparent', color: '#6B7280' }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Off-priority comparison note ──────────────────────────────────── */}
        {((prefs.rewardPriority === 'miles' && sortMode === 'cashback') ||
          (prefs.rewardPriority === 'cashback' && sortMode === 'miles')) && (
          <div
            className="flex gap-2.5 p-3 rounded-xl mb-4 text-xs leading-relaxed"
            style={{ backgroundColor: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}
          >
            <span className="flex-shrink-0">ℹ️</span>
            <span>
              {prefs.rewardPriority === 'miles'
                ? 'You selected Miles as your priority. Shown for comparison.'
                : 'You selected Cashback as your priority. Shown for comparison.'}
            </span>
          </div>
        )}

        {/* ── Gap analysis banner ───────────────────────────────────────────── */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Coverage by category
          </p>
          <div className="flex flex-wrap gap-2">
            {EARN_KEYS.map((key) => {
              const rate  = coveredRates[key] ?? 0
              const level = coverageLevel(rate)
              const s     = COVERAGE_STYLES[level]
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                  style={{ backgroundColor: s.bg, color: s.text, borderColor: s.ring }}
                  title={
                    level === 'green'
                      ? `Well covered — ${(rate * 100).toFixed(1)}% equiv.`
                      : level === 'amber'
                      ? `Base rate only — ${(rate * 100).toFixed(1)}% equiv.`
                      : 'Not covered by any held card'
                  }
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COVERAGE_DOTS[level] }}
                  />
                  {EARN_LABELS[key]}
                </span>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-2.5 flex-wrap">
            {(['green', 'amber', 'red'] as CoverageLevel[]).map((level) => {
              const labels = { green: 'Well covered (>2%)', amber: 'Base rate only', red: 'Not covered' }
              return (
                <span key={level} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COVERAGE_DOTS[level] }} />
                  {labels[level]}
                </span>
              )
            })}
          </div>
        </div>

        {/* ── Affiliate notice ──────────────────────────────────────────────── */}
        <div
          className="flex gap-2.5 p-3 rounded-xl mb-8 text-xs leading-relaxed"
          style={{ backgroundColor: '#FEFCE8', color: '#713F12', border: '1px solid #FDE68A' }}
        >
          <span className="text-base flex-shrink-0">⚠️</span>
          <span>
            CardSense SG is for informational purposes only and does not constitute financial advice.
            We may earn a referral commission if you are approved for a card through our links.
            Always verify terms directly with the issuing bank.
          </span>
        </div>

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {results.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <p className="text-gray-500 mb-4">
              No cards match your current criteria. Try adjusting your income selection or your minimum spend preference.
            </p>
            <button
              onClick={() => navigate('/preferences')}
              className="text-sm font-medium underline"
              style={{ color: '#1F4E79' }}
            >
              Adjust your preferences
            </button>
          </div>
        )}

        {/* ── Top recommendation (hero) ─────────────────────────────────────── */}
        {hero && (
          <HeroCard
            result={hero}
            promo={promoFor(hero.card.id)}
            checked={compareIds.has(hero.card.id)}
            onCompare={() => toggleCompare(hero.card.id)}
            onNavigate={() => navigate(`/card/${hero.card.id}`, { state: { spendProfile, prefs } })}
          />
        )}

        {/* ── Alternative cards (2×2 grid) ─────────────────────────────────── */}
        {alternatives.length > 0 && (
          <>
            <h2 className="text-base font-semibold text-gray-700 mt-8 mb-4">Also consider</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {alternatives.map((result) => (
                <AltCard
                  key={result.card.id}
                  result={result}
                  promo={promoFor(result.card.id)}
                  checked={compareIds.has(result.card.id)}
                  onCompare={() => toggleCompare(result.card.id)}
                  onNavigate={() => navigate(`/card/${result.card.id}`, { state: { spendProfile, prefs } })}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* ── Compare sticky bar ────────────────────────────────────────────────── */}
      {compareIds.size >= 2 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 shadow-lg"
          style={{ backgroundColor: '#1F4E79' }}
        >
          <span className="text-white text-sm font-medium">
            Comparing {compareIds.size} card{compareIds.size !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => navigate('/compare', { state: { cardIds: [...compareIds], spendProfile, prefs } })}
            className="bg-white text-sm font-semibold px-5 py-2 rounded-xl transition-opacity hover:opacity-90"
            style={{ color: '#1F4E79' }}
          >
            Compare Now →
          </button>
        </div>
      )}

      <Footer />
    </div>
  )
}

// ── HeroCard ──────────────────────────────────────────────────────────────────

function HeroCard({
  result,
  promo,
  checked,
  onCompare,
  onNavigate,
}: {
  result: RecommendationResult
  promo: Promotion | undefined
  checked: boolean
  onCompare: () => void
  onNavigate: () => void
}) {
  const { card } = result
  return (
    <div
      className="bg-white rounded-2xl shadow-md overflow-hidden cursor-pointer"
      style={{ border: '2px solid #1F4E79' }}
      onClick={onNavigate}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: '#1F4E79' }} />

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <RewardBadge type={card.rewardType} large />
              {promo && (
                <div className="flex flex-col gap-0.5">
                  <span
                    className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}
                  >
                    🎁 {promo.bonusDescription}
                  </span>
                  <span className="text-xs text-gray-400 pl-1">{promo.sourceLabel}</span>
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 mt-1 leading-tight">{card.name}</h2>
            <p className="text-sm text-gray-500">{card.bank}</p>
          </div>

          {/* Compare checkbox */}
          <label
            className="flex items-center gap-1.5 cursor-pointer flex-shrink-0 mt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={onCompare}
              className="w-4 h-4 rounded"
              style={{ accentColor: '#1F4E79' }}
            />
            <span className="text-xs text-gray-500 whitespace-nowrap">Compare</span>
          </label>
        </div>

        {/* Value display */}
        <div className="mb-4">
          {result.isMilesCard ? (
            <>
              <p className="text-4xl font-bold" style={{ color: '#1D4ED8' }}>
                {result.totalAnnualMiles.toLocaleString('en-SG')} miles
                <span className="text-base font-normal text-gray-400 ml-1">/ year</span>
              </p>
              <p className="text-sm text-gray-400 mt-0.5">from your uncovered spending categories</p>
              <p className="text-sm text-gray-500 mt-1">{krisFlyerContext(result.totalAnnualMiles)}</p>
            </>
          ) : (
            <>
              <p className="text-4xl font-bold" style={{ color: '#16A34A' }}>
                SGD {fmtSGD(result.monthlyCashbackSGD)}
                <span className="text-base font-normal text-gray-400 ml-1">/ month</span>
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                SGD {fmtSGD(result.monthlyCashbackSGD * 12)} / year
              </p>
            </>
          )}
        </div>

        {/* Plain English reason */}
        <p className="text-sm text-gray-600 mb-4 leading-relaxed italic">
          {result.plainEnglishReason}
        </p>

        {/* Category breakdown table */}
        {result.categoryBreakdown.length > 0 && (
          <div
            className="rounded-xl p-4 mb-4"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
          >
            {result.coveredNote && (
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                {result.coveredNote} These are the additional categories this card optimises.
              </p>
            )}
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <th className="text-left pb-2 font-semibold text-gray-400 uppercase tracking-wide">Category</th>
                  <th className="text-right pb-2 font-semibold text-gray-400 uppercase tracking-wide">Monthly spend</th>
                  <th className="text-right pb-2 font-semibold text-gray-400 uppercase tracking-wide">Monthly earn</th>
                </tr>
              </thead>
              <tbody>
                {result.categoryBreakdown.map((row) => (
                  <tr key={row.label} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td className="py-2 text-gray-700 font-medium">{row.label}</td>
                    <td className="py-2 text-right text-gray-500">S${fmtSGD(row.monthlySpend)}</td>
                    <td className="py-2 text-right font-semibold" style={{ color: '#1F4E79' }}>
                      {row.monthlyEarnDisplay}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Top categories */}
        {result.topCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-gray-400 self-center">Best for:</span>
            {result.topCategories.map((cat) => (
              <CategoryChip key={cat} label={cat} />
            ))}
          </div>
        )}

        {/* Gap filled */}
        {result.gapFilled.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-gray-400 self-center">New coverage:</span>
            {result.gapFilled.map((cat) => (
              <span
                key={cat}
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}
              >
                ✓ {cat}
              </span>
            ))}
          </div>
        )}

        {/* Promo description */}
        {promo && (
          <div
            className="text-xs rounded-xl px-3 py-2 mb-4"
            style={{ backgroundColor: '#FFF7ED', color: '#92400E' }}
          >
            {promo.description}
          </div>
        )}

        {/* Min spend warning */}
        {result.minSpendFlag && (
          <div
            className="flex gap-2 text-xs rounded-xl px-3 py-2 mb-4"
            style={{ backgroundColor: '#FEFCE8', color: '#713F12', border: '1px solid #FDE68A' }}
          >
            <span>⚠️</span>
            <span>
              This card requires a minimum monthly spend of S${fmtSGD(card.minMonthlySpend)}, which
              may exceed your stated comfort level.
            </span>
          </div>
        )}

        {/* Apply button */}
        <div onClick={(e) => e.stopPropagation()}>
          <ApplyButton url={promo ? promo.applyUrl : card.applyUrl} large />
        </div>
      </div>
    </div>
  )
}

// ── AltCard ───────────────────────────────────────────────────────────────────

function AltCard({
  result,
  promo,
  checked,
  onCompare,
  onNavigate,
}: {
  result: RecommendationResult
  promo: Promotion | undefined
  checked: boolean
  onCompare: () => void
  onNavigate: () => void
}) {
  const { card } = result
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 cursor-pointer"
      onClick={onNavigate}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <RewardBadge type={card.rewardType} />
            {promo && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}
              >
                🎁 {promo.bonusDescription}
              </span>
            )}
          </div>
          <p className="text-base font-bold text-gray-900 leading-tight">{card.name}</p>
          <p className="text-xs text-gray-400">
            {card.bank}
            {promo && (
              <span className="ml-1.5 text-orange-600 font-medium">{promo.sourceLabel}</span>
            )}
          </p>
        </div>
        <label
          className="flex items-center gap-1.5 cursor-pointer flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={onCompare}
            className="w-4 h-4 rounded"
            style={{ accentColor: '#1F4E79' }}
          />
          <span className="text-xs text-gray-500">Compare</span>
        </label>
      </div>

      {/* Value display */}
      <div>
        {result.isMilesCard ? (
          <>
            <p className="text-2xl font-bold" style={{ color: '#1D4ED8' }}>
              {result.totalAnnualMiles.toLocaleString('en-SG')} miles / year
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{krisFlyerContext(result.totalAnnualMiles)}</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold" style={{ color: '#16A34A' }}>
              SGD {fmtSGD(result.monthlyCashbackSGD)} / month
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              SGD {fmtSGD(result.monthlyCashbackSGD * 12)} / year
            </p>
          </>
        )}
      </div>

      {/* Top category */}
      {result.topCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.topCategories.map((cat) => (
            <CategoryChip key={cat} label={cat} />
          ))}
        </div>
      )}

      {/* Plain English reason */}
      <p className="text-xs text-gray-500 leading-relaxed italic flex-1">
        {result.plainEnglishReason}
      </p>

      {/* Min spend warning */}
      {result.minSpendFlag && (
        <p className="text-xs" style={{ color: '#92400E' }}>
          ⚠️ Requires S${fmtSGD(card.minMonthlySpend)}/month minimum spend
        </p>
      )}

      {/* Apply button */}
      <div onClick={(e) => e.stopPropagation()}>
        <ApplyButton url={promo ? promo.applyUrl : card.applyUrl} />
      </div>
    </div>
  )
}
