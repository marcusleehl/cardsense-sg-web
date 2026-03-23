import { useParams, useNavigate, useLocation } from 'react-router-dom'
import cardsData from '../data/cards.json'
import { EARN_KEYS, EARN_LABELS, CC_TO_EARN, DISPLAY_TO_EARN } from '../utils/engine'
import type { Card, EarnKey, UserPreferences } from '../utils/engine'
import type { SpendProfile } from './Analysis'
import Footer from '../components/Footer'
import PromotionAdvisor from '../components/PromotionAdvisor'

// ── constants (mirrors engine.ts, not exported there) ─────────────────────────

const INCOME_MAP: Record<string, number> = {
  'Below SGD 30,000':       29_000,
  'SGD 30,000 to 50,000':   40_000,
  'SGD 50,000 to 80,000':   65_000,
  'SGD 80,000 to 120,000': 100_000,
  'Above SGD 120,000':     150_000,
}

const SPEND_COMFORT_MAP: Record<string, number> = {
  'No preference':            Infinity,
  'Up to SGD 500 per month':     500,
  'Up to SGD 1,000 per month': 1_000,
  'Up to SGD 2,000 per month': 2_000,
}

const PERK_KEYWORDS: Record<string, string[]> = {
  'Airport lounge access': ['lounge'],
  'Travel insurance':      ['travel insurance', 'insurance'],
  'Dining privileges':     ['dining'],
  'Concierge':             ['concierge'],
}

const STORAGE_KEY = 'cardSensePrefs'

// ── helpers ───────────────────────────────────────────────────────────────────

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

// ── small UI primitives ───────────────────────────────────────────────────────

function Tick() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#DCFCE7" />
      <path d="M6 10l3 3 5-5" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Cross() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#FEE2E2" />
      <path d="M7 7l6 6M13 7l-6 6" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
      <h2 className="text-base font-bold text-gray-800 mb-4">{title}</h2>
      {children}
    </div>
  )
}

function RewardBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    miles:    { bg: '#EFF6FF', color: '#1D4ED8' },
    cashback: { bg: '#F0FDF4', color: '#15803D' },
    points:   { bg: '#FFF7ED', color: '#C2410C' },
  }
  const s = styles[type] ?? styles.points
  return (
    <span
      className="px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {type}
    </span>
  )
}

// ── component ─────────────────────────────────────────────────────────────────

export default function CardDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const cards = cardsData as unknown as Card[]
  const card = cards.find((c) => c.id === id)

  const prefs: UserPreferences | null =
    (location.state?.prefs as UserPreferences | null) ?? loadPrefs()
  const spendProfile: SpendProfile | null = location.state?.spendProfile ?? null

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Card not found.</p>
          <button
            onClick={() => navigate('/recommendations')}
            className="text-sm font-medium underline"
            style={{ color: '#1F4E79' }}
          >
            Back to Recommendations
          </button>
        </div>
      </div>
    )
  }

  // ── build avgMonthly keyed by EarnKey ──────────────────────────────────────
  const avgMonthly: Partial<Record<EarnKey, number>> = {}
  if (spendProfile?.avgMonthlyByCategory) {
    for (const [cat, amount] of Object.entries(spendProfile.avgMonthlyByCategory)) {
      const key = CC_TO_EARN[cat]
      if (key) avgMonthly[key] = (avgMonthly[key] ?? 0) + amount
    }
  }
  const hasSpendData = Object.values(avgMonthly).some((v) => (v ?? 0) > 0)
  const isMilesCard = card.rewardType === 'miles' || card.rewardType === 'points'

  // ── best for: top 2 categories by monthly earn value (or top earn rates) ───
  const bestForCategories: string[] = (() => {
    const keys = EARN_KEYS.filter((k) => k !== 'others')
    if (hasSpendData) {
      return keys
        .map((k) => ({ k, v: (avgMonthly[k] ?? 0) * (card.earnRates[k] ?? 0) }))
        .filter(({ v }) => v > 0)
        .sort((a, b) => b.v - a.v)
        .slice(0, 2)
        .map(({ k }) => EARN_LABELS[k])
    }
    return keys
      .map((k) => ({ k, r: card.earnRates[k] ?? 0 }))
      .filter(({ r }) => r > 0)
      .sort((a, b) => b.r - a.r)
      .slice(0, 2)
      .map(({ k }) => EARN_LABELS[k])
  })()

  // ── covered categories note ───────────────────────────────────────────────
  // Replicate engine.ts gap-analysis logic to show which held cards already
  // cover which categories, so the user understands the table is full spend.
  const coveredByCard: Partial<Record<EarnKey, string>> = {}
  const coveredRateByKey: Partial<Record<EarnKey, number>> = {}
  if (prefs) {
    for (const { id: heldId, usageCategory } of prefs.existingCards) {
      if (!usageCategory) continue
      const heldCard = cards.find((c) => c.id === heldId)
      if (!heldCard) continue
      const earnKey = DISPLAY_TO_EARN[usageCategory]
      if (!earnKey) continue
      const rate = heldCard.cashbackEquivalent[earnKey] ?? 0
      if (rate > (coveredRateByKey[earnKey] ?? 0)) {
        coveredRateByKey[earnKey] = rate
        coveredByCard[earnKey] = heldCard.name
      }
    }
  }

  // Only mention categories where user actually spends
  const coveredNoteByCard: Record<string, string[]> = {}
  for (const [key, cardName] of Object.entries(coveredByCard)) {
    const earnKey = key as EarnKey
    if ((avgMonthly[earnKey] ?? 0) === 0) continue
    if (!coveredNoteByCard[cardName]) coveredNoteByCard[cardName] = []
    coveredNoteByCard[cardName].push(EARN_LABELS[earnKey])
  }

  const coveredNote: string | null = Object.keys(coveredNoteByCard).length > 0
    ? 'Note: ' +
      Object.entries(coveredNoteByCard)
        .map(([cardName, cats]) => {
          const catStr = cats.length === 1
            ? cats[0]
            : cats.slice(0, -1).join(', ') + ' and ' + cats[cats.length - 1]
          return `${catStr} ${cats.length === 1 ? 'is' : 'are'} already covered by your ${cardName}`
        })
        .join('. ') +
      '. The table below shows your full spending for reference — the recommendation engine calculates incremental value on uncovered categories only.'
    : null

  // ── projected value table rows ────────────────────────────────────────────
  // Others is excluded — it contains personal transfers and non-merchant
  // transactions that earn no meaningful rewards on any card.
  const tableKeys: EarnKey[] = hasSpendData
    ? EARN_KEYS.filter((k) => k !== 'others' && (avgMonthly[k] ?? 0) > 0)
    : EARN_KEYS.filter((k) => k !== 'others' && (card.earnRates[k] ?? 0) > 0)

  interface TableRow {
    label: string
    monthlySpend: number
    earnRate: number
    monthlyRawValue: number   // SGD for cashback; miles for miles cards
    displayValue: string
  }

  const tableRows: TableRow[] = tableKeys.map((k) => {
    const monthlySpend = avgMonthly[k] ?? 0
    const earnRate = card.earnRates[k] ?? 0
    let monthlyRawValue: number
    let displayValue: string

    if (isMilesCard) {
      const miles = Math.round(monthlySpend * earnRate)
      const sgdEquiv = miles * 0.02
      monthlyRawValue = miles
      displayValue = monthlySpend > 0
        ? `${miles.toLocaleString('en-SG')} miles (S$${sgdEquiv.toFixed(2)})`
        : '—'
    } else {
      const sgd = monthlySpend * earnRate
      monthlyRawValue = sgd
      displayValue = monthlySpend > 0 ? `S$${sgd.toFixed(2)}` : '—'
    }

    return { label: EARN_LABELS[k], monthlySpend, earnRate, monthlyRawValue, displayValue }
  })

  // Total annual value
  const totalAnnualMiles = isMilesCard
    ? tableRows.reduce((s, r) => s + r.monthlyRawValue, 0) * 12
    : 0
  const totalAnnualSGD = isMilesCard
    ? totalAnnualMiles * 0.02
    : tableRows.reduce((s, r) => s + r.monthlyRawValue, 0) * 12

  // ── eligibility ───────────────────────────────────────────────────────────
  const userIncome = prefs ? (INCOME_MAP[prefs.annualIncome] ?? 0) : 0
  const userSpendComfort = prefs ? (SPEND_COMFORT_MAP[prefs.minMonthlySpend] ?? Infinity) : Infinity
  const incomeQualifies = prefs ? userIncome >= card.minIncomeSGD : null
  const spendWithinComfort = card.minMonthlySpend === 0 || card.minMonthlySpend <= userSpendComfort

  // ── perk priority matching ────────────────────────────────────────────────
  function isPerkPriority(perk: string): boolean {
    if (!prefs || prefs.perks.length === 0) return false
    const lower = perk.toLowerCase()
    return prefs.perks.some((userPerk) => {
      if (userPerk === 'No preference') return false
      return (PERK_KEYWORDS[userPerk] ?? []).some((kw) => lower.includes(kw))
    })
  }

  // ── total monthly spend ───────────────────────────────────────────────────
  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <main className="flex-1 px-4 py-10 max-w-3xl mx-auto w-full">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-medium mb-8 transition-opacity hover:opacity-70"
          style={{ color: '#1F4E79' }}
        >
          ← Back to Recommendations
        </button>

        {/* ── HEADER CARD ───────────────────────────────────────────────────── */}
        <div
          className="bg-white rounded-2xl shadow-md overflow-hidden mb-6"
          style={{ border: '2px solid #1F4E79' }}
        >
          <div className="h-1 w-full" style={{ backgroundColor: '#1F4E79' }} />
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <RewardBadge type={card.rewardType} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">{card.name}</h1>
                <p className="text-base text-gray-500 mt-0.5">{card.bank}</p>
              </div>

              {/* Apply Now button */}
              <a
                href={card.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center font-semibold rounded-xl text-white px-5 py-2.5 text-sm transition-opacity hover:opacity-90 flex-shrink-0"
                style={{ backgroundColor: '#1F4E79' }}
              >
                Apply Now →
              </a>
            </div>

            {/* Best for tags */}
            {bestForCategories.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-4">
                <span className="text-xs text-gray-400">Best for:</span>
                {bestForCategories.map((cat) => (
                  <span
                    key={cat}
                    className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── PROJECTED VALUE TABLE ──────────────────────────────────────────── */}
        <Section title="Projected Value">
          {!hasSpendData && (
            <p className="text-xs text-gray-400 mb-4 italic">
              No spend data available. Upload a bank statement to see personalised projections.
            </p>
          )}
          {coveredNote && (
            <div
              className="flex gap-2.5 p-3 rounded-xl mb-4 text-xs leading-relaxed"
              style={{ backgroundColor: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}
            >
              <span className="flex-shrink-0">ℹ️</span>
              <span>{coveredNote}</span>
            </div>
          )}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm" style={{ minWidth: '480px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <th className="text-left pb-3 font-semibold text-gray-400 uppercase tracking-wide text-xs">Category</th>
                  <th className="text-right pb-3 font-semibold text-gray-400 uppercase tracking-wide text-xs">Monthly spend</th>
                  <th className="text-right pb-3 font-semibold text-gray-400 uppercase tracking-wide text-xs">Earn rate</th>
                  <th className="text-right pb-3 font-semibold text-gray-400 uppercase tracking-wide text-xs">Monthly value</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.label} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td className="py-2.5 text-gray-700 font-medium">{row.label}</td>
                    <td className="py-2.5 text-right text-gray-500">
                      {row.monthlySpend > 0 ? `S$${fmtSGD(row.monthlySpend)}` : '—'}
                    </td>
                    <td className="py-2.5 text-right text-gray-500">
                      {isMilesCard
                        ? `${row.earnRate % 1 === 0 ? row.earnRate.toFixed(0) : row.earnRate} mpd`
                        : `${(row.earnRate * 100).toFixed(row.earnRate * 100 % 1 === 0 ? 0 : 2)}%`
                      }
                    </td>
                    <td className="py-2.5 text-right font-semibold" style={{ color: '#1F4E79' }}>
                      {row.displayValue}
                    </td>
                  </tr>
                ))}

                {/* Total row */}
                {hasSpendData && tableRows.length > 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="pt-4 pb-1 font-bold text-gray-900"
                      style={{ borderTop: '2px solid #E2E8F0' }}
                    >
                      Projected annual value
                    </td>
                    <td
                      className="pt-4 pb-1 text-right font-bold"
                      style={{ borderTop: '2px solid #E2E8F0', color: '#1F4E79' }}
                    >
                      {isMilesCard
                        ? `${totalAnnualMiles.toLocaleString('en-SG')} miles (S$${fmtSGD(totalAnnualSGD)})`
                        : `S$${fmtSGD(totalAnnualSGD)} / year`
                      }
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {isMilesCard && hasSpendData && (
            <p className="text-xs text-gray-400 mt-3">
              * SGD equivalent calculated at S$0.02 per mile (approximate KrisFlyer redemption value).
            </p>
          )}
        </Section>

        {/* ── ELIGIBILITY CHECKLIST ─────────────────────────────────────────── */}
        <Section title="Eligibility">
          <div className="space-y-3">

            {/* Minimum income */}
            <div className="flex items-start gap-3">
              {incomeQualifies === null ? (
                <span className="text-gray-300 mt-0.5 flex-shrink-0">○</span>
              ) : incomeQualifies ? (
                <Tick />
              ) : (
                <Cross />
              )}
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Minimum income:{' '}
                  <span className="font-normal text-gray-600">
                    SGD {card.minIncomeSGD.toLocaleString('en-SG')} / year
                  </span>
                </p>
                {incomeQualifies === false && (
                  <p className="text-xs text-red-500 mt-0.5">
                    Your stated income bracket may not meet this requirement.
                  </p>
                )}
              </div>
            </div>

            {/* Annual fee */}
            <div className="flex items-start gap-3">
              <Tick />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Annual fee:{' '}
                  <span className="font-normal text-gray-600">
                    {card.annualFee === 0 ? 'No annual fee' : `S$${card.annualFee.toFixed(2)}`}
                  </span>
                </p>
                {card.firstYearFeeWaived && card.annualFee > 0 && (
                  <p className="text-xs text-green-600 mt-0.5">Fee waived in year 1</p>
                )}
              </div>
            </div>

            {/* Minimum monthly spend */}
            <div className="flex items-start gap-3">
              {card.minMonthlySpend === 0 ? <Tick /> : spendWithinComfort ? <Tick /> : <Cross />}
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Minimum monthly spend:{' '}
                  <span className="font-normal text-gray-600">
                    {card.minMonthlySpend === 0
                      ? 'None required'
                      : `S$${fmtSGD(card.minMonthlySpend)} / month`}
                  </span>
                </p>
                {card.minMonthlySpend > 0 && !spendWithinComfort && prefs?.minMonthlySpend && prefs.minMonthlySpend !== 'No preference' && (
                  <p className="text-xs text-red-500 mt-0.5">
                    This exceeds your stated spend comfort level.
                  </p>
                )}
              </div>
            </div>

            {/* Card network */}
            <div className="flex items-start gap-3">
              <Tick />
              <p className="text-sm font-medium text-gray-800">
                Card network:{' '}
                <span className="font-normal text-gray-600">{card.network}</span>
              </p>
            </div>

          </div>
        </Section>

        {/* ── PERKS ─────────────────────────────────────────────────────────── */}
        <Section title="Perks">
          {card.perks.length === 0 ? (
            <p className="text-sm text-gray-400">This card does not offer additional perks.</p>
          ) : (
            <ul className="space-y-2">
              {card.perks.map((perk, i) => {
                const isPriority = isPerkPriority(perk)
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    {isPriority ? (
                      <span className="text-yellow-400 mt-0.5 flex-shrink-0 text-base leading-5">★</span>
                    ) : (
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: '#9CA3AF' }}
                      />
                    )}
                    <p className={`text-sm leading-relaxed ${isPriority ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                      {perk}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        {/* ── PROMOTIONS ────────────────────────────────────────────────────── */}
        <Section title="Promotions">
          <PromotionAdvisor
            cardId={card.id}
            cardName={card.name}
            bankName={card.bank}
            userPrefs={prefs}
          />
        </Section>

        {/* ── AFFILIATE DISCLOSURE ──────────────────────────────────────────── */}
        <div
          className="flex gap-2.5 p-3 rounded-xl mb-4 text-xs leading-relaxed"
          style={{ backgroundColor: '#FEFCE8', color: '#713F12', border: '1px solid #FDE68A' }}
        >
          <span className="flex-shrink-0">ℹ️</span>
          <span>
            CardSense SG may earn a referral commission if you are approved for this card.
          </span>
        </div>

        {/* Apply Now button (bottom) */}
        <a
          href={card.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-full font-semibold rounded-xl text-white py-3 text-base transition-opacity hover:opacity-90 mb-4"
          style={{ backgroundColor: '#1F4E79' }}
        >
          Apply Now →
        </a>

        {/* ── DISCLAIMER ────────────────────────────────────────────────────── */}
        <p className="text-xs text-center text-gray-400 leading-relaxed">
          Reward rates and terms are subject to change. Verify all details with the issuing bank before applying.
        </p>

      </main>
      <Footer />
    </div>
  )
}
