import { useMemo, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import cardsData from '../data/cards.json'
import { getActivePromotions } from '../utils/promotions'
import { EARN_KEYS, EARN_LABELS, CC_TO_EARN, recommendFromProfile } from '../utils/engine'
import type { Card, EarnKey, UserPreferences, RecommendationResult } from '../utils/engine'
import type { SpendProfile } from './Analysis'
import Footer from '../components/Footer'

// ── constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cardSensePrefs'

const COMPARE_PERKS: { label: string; keywords: string[] }[] = [
  { label: 'Airport lounge access', keywords: ['lounge'] },
  { label: 'Travel insurance',      keywords: ['travel insurance', 'insurance'] },
  { label: 'Dining privileges',     keywords: ['dining'] },
  { label: 'Concierge',             keywords: ['concierge'] },
]

const PERK_KEYWORDS: Record<string, string[]> = {
  'Airport lounge access': ['lounge'],
  'Travel insurance':      ['travel insurance', 'insurance'],
  'Dining privileges':     ['dining'],
  'Concierge':             ['concierge'],
}

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

function cardHasPerk(card: Card, keywords: string[]): boolean {
  const lower = card.perks.map((p) => p.toLowerCase())
  return keywords.some((kw) => lower.some((p) => p.includes(kw)))
}

// ── sub-components ────────────────────────────────────────────────────────────

function RewardBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    miles:    { bg: '#EFF6FF', color: '#1D4ED8' },
    cashback: { bg: '#F0FDF4', color: '#15803D' },
    points:   { bg: '#FFF7ED', color: '#C2410C' },
  }
  const s = styles[type] ?? styles.points
  return (
    <span
      className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wide rounded-full"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {type}
    </span>
  )
}

function SectionHeader({ label, numCards }: { label: string; numCards: number }) {
  return (
    <tr>
      <td
        className="sticky left-0 px-4 py-2 text-xs font-bold uppercase tracking-widest"
        style={{
          backgroundColor: '#F1F5F9',
          color: '#64748B',
          minWidth: 160,
          borderRight: '1px solid #CBD5E1',
        }}
      >
        {label}
      </td>
      {Array.from({ length: numCards }, (_, i) => (
        <td key={i} style={{ backgroundColor: '#F1F5F9', borderLeft: '1px solid #E8EEF4' }} />
      ))}
    </tr>
  )
}

function LabelCell({ children }: { children: ReactNode }) {
  return (
    <td
      className="sticky left-0 bg-white px-4 py-3 text-sm font-medium text-gray-600 whitespace-nowrap"
      style={{ minWidth: 160, borderRight: '1px solid #CBD5E1' }}
    >
      {children}
    </td>
  )
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Compare() {
  const location = useLocation()
  const navigate = useNavigate()

  const cardIds: string[] = location.state?.cardIds ?? []
  const spendProfile: SpendProfile | null = location.state?.spendProfile ?? null
  const statePrefs: UserPreferences | null = location.state?.prefs ?? null
  const prefs = statePrefs ?? loadPrefs()

  const allCards = cardsData as unknown as Card[]
  const cards = cardIds
    .map((id) => allCards.find((c) => c.id === id))
    .filter((c): c is Card => !!c)

  // ── avg monthly spend by EarnKey (for best-category badge) ─────────────────
  const avgMonthly = useMemo<Partial<Record<EarnKey, number>>>(() => {
    const result: Partial<Record<EarnKey, number>> = {}
    if (spendProfile?.avgMonthlyByCategory) {
      for (const [cat, amount] of Object.entries(spendProfile.avgMonthlyByCategory)) {
        const key = CC_TO_EARN[cat]
        if (key) result[key] = (result[key] ?? 0) + amount
      }
    }
    return result
  }, [spendProfile])

  const hasSpendData = Object.values(avgMonthly).some((v) => (v ?? 0) > 0)

  // ── run the same engine as Recommendations to get identical values ───────────
  // Pass only the selected cards so all of them appear in results (not just top 5
  // of the full database), while gap analysis still uses prefs.existingCards.
  const engineResults = useMemo<RecommendationResult[]>(() => {
    if (!hasSpendData || !prefs || !spendProfile) return []
    return recommendFromProfile(spendProfile.avgMonthlyByCategory, prefs, cards)
  }, [cards, spendProfile, prefs, hasSpendData])

  const resultByCardId = useMemo(
    () => Object.fromEntries(engineResults.map((r) => [r.card.id, r])),
    [engineResults],
  )

  // ── best overall value column ───────────────────────────────────────────────
  const bestValueIdx = useMemo(() => {
    if (!hasSpendData) return -1
    let best = -1
    let bestVal = -Infinity
    cards.forEach((card, i) => {
      const val = resultByCardId[card.id]?.projectedAnnualValueSGD ?? -Infinity
      if (val > bestVal) { bestVal = val; best = i }
    })
    return best
  }, [cards, resultByCardId, hasSpendData])

  // ── top spending category ───────────────────────────────────────────────────
  const topSpendKey = useMemo<EarnKey | null>(() => {
    if (!hasSpendData) return null
    let best: EarnKey | null = null
    let bestAmt = 0
    for (const key of EARN_KEYS) {
      if (key === 'others') continue
      const amt = avgMonthly[key] ?? 0
      if (amt > bestAmt) { bestAmt = amt; best = key }
    }
    return best
  }, [avgMonthly, hasSpendData])

  // ── best card for top spending category ─────────────────────────────────────
  const bestForCatIdx = useMemo(() => {
    if (!topSpendKey) return -1
    let best = -1
    let bestRate = -Infinity
    cards.forEach((c, i) => {
      const rate = c.cashbackEquivalent[topSpendKey] ?? 0
      if (rate > bestRate) { bestRate = rate; best = i }
    })
    return best
  }, [cards, topSpendKey])

  // ── perk match count per card ───────────────────────────────────────────────
  const userPerkCounts = useMemo(() => {
    return cards.map((card) => {
      if (!prefs || prefs.perks.length === 0) return 0
      let count = 0
      for (const userPerk of prefs.perks) {
        if (userPerk === 'No preference') continue
        const keywords = PERK_KEYWORDS[userPerk] ?? []
        if (cardHasPerk(card, keywords)) count++
      }
      return count
    })
  }, [cards, prefs])

  const maxPerkMatchIdx = useMemo(() => {
    const max = Math.max(...userPerkCounts)
    return max === 0 ? -1 : userPerkCounts.indexOf(max)
  }, [userPerkCounts])

  // ── best earn rate indices per category (by cashbackEquivalent) ─────────────
  function getBestEarnIdxs(key: EarnKey): number[] {
    const rates = cards.map((c) => c.cashbackEquivalent[key] ?? 0)
    const max = Math.max(...rates)
    if (max <= 0) return []
    return rates.reduce<number[]>((acc, r, i) => {
      if (r === max) acc.push(i)
      return acc
    }, [])
  }

  // ── guards ──────────────────────────────────────────────────────────────────
  if (cards.length < 2) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <p className="text-gray-500">Please select at least 2 cards to compare.</p>
        <button
          onClick={() => navigate(-1)}
          className="text-sm font-medium underline"
          style={{ color: '#1F4E79' }}
        >
          ← Go back
        </button>
      </div>
    )
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <main className="flex-1 py-10 max-w-6xl mx-auto w-full px-4">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-medium mb-8 transition-opacity hover:opacity-70"
          style={{ color: '#1F4E79' }}
        >
          ← Back to Recommendations
        </button>

        <h1 className="text-2xl font-bold mb-6" style={{ color: '#1F4E79' }}>
          Compare Cards
        </h1>

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        <div
          className="overflow-x-auto rounded-2xl shadow-sm"
          style={{ border: '1px solid #E2E8F0' }}
        >
          <table
            className="bg-white w-full"
            style={{
              borderCollapse: 'separate',
              borderSpacing: 0,
              minWidth: cards.length * 220 + 160,
            }}
          >
            {/* ── Column headers with summary badges ──────────────────────── */}
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                {/* Empty sticky corner */}
                <th
                  className="sticky left-0 bg-white px-4 py-5"
                  style={{ minWidth: 160, borderRight: '1px solid #CBD5E1', zIndex: 2 }}
                />

                {cards.map((card, i) => (
                  <th
                    key={card.id}
                    className="px-4 py-5 text-left align-top"
                    style={{
                      minWidth: 220,
                      borderLeft: i > 0 ? '1px solid #E2E8F0' : undefined,
                    }}
                  >
                    {/* Summary badges */}
                    <div className="flex flex-col gap-1.5 mb-2.5">
                      {i === bestValueIdx && (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold w-fit"
                          style={{ backgroundColor: '#FEF9C3', color: '#713F12', border: '1px solid #FDE68A' }}
                        >
                          ★ Best overall value
                        </span>
                      )}
                      {topSpendKey && i === bestForCatIdx && (
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold w-fit"
                          style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}
                        >
                          Best for {EARN_LABELS[topSpendKey]}
                        </span>
                      )}
                    </div>

                    {/* Card name + bank */}
                    <p className="text-sm font-bold text-gray-900 leading-snug">{card.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{card.bank}</p>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* ── OVERALL VALUE ─────────────────────────────────────────── */}
              <SectionHeader label="Overall Value" numCards={cards.length} />

              {/* Projected annual value */}
              <tr style={{ borderTop: '1px solid #F1F5F9' }}>
                <LabelCell>Projected annual value</LabelCell>
                {cards.map((card, i) => {
                  const result = resultByCardId[card.id]
                  return (
                    <td
                      key={card.id}
                      className="px-4 py-3 text-sm"
                      style={{
                        borderLeft: '1px solid #F1F5F9',
                        backgroundColor: i === bestValueIdx ? '#F0FDF4' : undefined,
                      }}
                    >
                      {result
                        ? result.isMilesCard
                          ? (
                            <div>
                              <span className="font-bold" style={{ color: '#1D4ED8' }}>
                                {result.totalAnnualMiles.toLocaleString('en-SG')} miles
                              </span>
                              <p className="text-xs text-gray-400 mt-0.5">
                                ≈ S${fmtSGD(result.totalAnnualMiles * 0.02)} / yr
                              </p>
                            </div>
                          )
                          : (
                            <div>
                              <span className="font-bold" style={{ color: '#16A34A' }}>
                                S${fmtSGD(result.monthlyCashbackSGD)} / mo
                              </span>
                              <p className="text-xs text-gray-400 mt-0.5">
                                S${fmtSGD(result.monthlyCashbackSGD * 12)} / yr
                              </p>
                            </div>
                          )
                        : <span className="text-xs text-gray-400">Upload statement to see</span>
                      }
                    </td>
                  )
                })}
              </tr>

              {/* Reward type */}
              <tr style={{ borderTop: '1px solid #F1F5F9' }}>
                <LabelCell>Reward type</LabelCell>
                {cards.map((card) => (
                  <td key={card.id} className="px-4 py-3" style={{ borderLeft: '1px solid #F1F5F9' }}>
                    <RewardBadge type={card.rewardType} />
                  </td>
                ))}
              </tr>

              {/* Welcome bonus */}
              <tr style={{ borderTop: '1px solid #F1F5F9' }}>
                <LabelCell>Welcome bonus</LabelCell>
                {cards.map((card) => (
                  <td key={card.id} className="px-4 py-3 text-sm" style={{ borderLeft: '1px solid #F1F5F9' }}>
                    {card.welcomeBonus
                      ? <span className="text-gray-700">{card.welcomeBonus}</span>
                      : <span className="text-gray-400">None</span>
                    }
                  </td>
                ))}
              </tr>

              {/* ── EARN RATES ────────────────────────────────────────────── */}
              <SectionHeader label="Earn Rates" numCards={cards.length} />

              {EARN_KEYS.map((key) => {
                const bestIdxs = getBestEarnIdxs(key)
                return (
                  <tr key={key} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <LabelCell>{EARN_LABELS[key]}</LabelCell>
                    {cards.map((card, i) => {
                      const isMiles = card.rewardType === 'miles' || card.rewardType === 'points'
                      const rate    = card.earnRates[key] ?? 0
                      const isWinner = bestIdxs.includes(i)
                      let display = '—'
                      if (rate > 0) {
                        if (isMiles) {
                          display = `${rate % 1 === 0 ? rate.toFixed(0) : rate} mpd`
                        } else {
                          const pct = rate * 100
                          display = `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`
                        }
                      }
                      return (
                        <td
                          key={card.id}
                          className="px-4 py-3 text-sm font-medium"
                          style={{
                            borderLeft: '1px solid #F1F5F9',
                            backgroundColor: isWinner ? '#E2EFDA' : undefined,
                            color: rate > 0 ? '#1F4E79' : '#9CA3AF',
                          }}
                        >
                          {display}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

              {/* ── FEES & REQUIREMENTS ───────────────────────────────────── */}
              <SectionHeader label="Fees & Requirements" numCards={cards.length} />

              {/* Annual fee */}
              <tr style={{ borderTop: '1px solid #F1F5F9' }}>
                <LabelCell>Annual fee</LabelCell>
                {cards.map((card) => (
                  <td key={card.id} className="px-4 py-3 text-sm" style={{ borderLeft: '1px solid #F1F5F9' }}>
                    {card.annualFee === 0
                      ? <span className="font-medium text-green-600">None</span>
                      : (
                        <div>
                          <span className="text-gray-700">S${fmtSGD(card.annualFee)}</span>
                          {card.firstYearFeeWaived && (
                            <p className="text-xs text-green-600 mt-0.5">Waived Year 1</p>
                          )}
                        </div>
                      )
                    }
                  </td>
                ))}
              </tr>

              {/* Min monthly spend */}
              <tr style={{ borderTop: '1px solid #F1F5F9' }}>
                <LabelCell>Min monthly spend</LabelCell>
                {cards.map((card) => (
                  <td key={card.id} className="px-4 py-3 text-sm text-gray-700" style={{ borderLeft: '1px solid #F1F5F9' }}>
                    {card.minMonthlySpend === 0
                      ? <span className="text-gray-400">None</span>
                      : `S$${fmtSGD(card.minMonthlySpend)}`
                    }
                  </td>
                ))}
              </tr>

              {/* Min annual income */}
              <tr style={{ borderTop: '1px solid #F1F5F9' }}>
                <LabelCell>Min annual income</LabelCell>
                {cards.map((card) => (
                  <td key={card.id} className="px-4 py-3 text-sm text-gray-700" style={{ borderLeft: '1px solid #F1F5F9' }}>
                    S${fmtSGD(card.minIncomeSGD)}
                  </td>
                ))}
              </tr>

              {/* ── PERKS ─────────────────────────────────────────────────── */}
              <SectionHeader label="Perks" numCards={cards.length} />

              {COMPARE_PERKS.map((perk) => (
                <tr key={perk.label} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <LabelCell>{perk.label}</LabelCell>
                  {cards.map((card, i) => {
                    const has          = cardHasPerk(card, perk.keywords)
                    const isTopPerks   = i === maxPerkMatchIdx && maxPerkMatchIdx >= 0
                    return (
                      <td
                        key={card.id}
                        className="px-4 py-3 text-center text-lg"
                        style={{
                          borderLeft: '1px solid #F1F5F9',
                          backgroundColor: isTopPerks ? '#EFF6FF' : undefined,
                        }}
                      >
                        {has
                          ? <span style={{ color: '#1D4ED8' }}>●</span>
                          : <span className="text-gray-200">○</span>
                        }
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* ── ACTIVE PROMOTIONS ─────────────────────────────────────── */}
              <SectionHeader label="Active Promotions" numCards={cards.length} />

              <tr style={{ borderTop: '1px solid #F1F5F9' }}>
                <LabelCell>Current offer</LabelCell>
                {cards.map((card) => {
                  const promos = getActivePromotions(card.id)
                  const promo  = promos[0]
                  return (
                    <td key={card.id} className="px-4 py-3 text-sm" style={{ borderLeft: '1px solid #F1F5F9' }}>
                      {promo
                        ? (
                          <div>
                            <p className="font-medium text-gray-800 leading-snug">{promo.title}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#C2410C' }}>
                              {promo.bonusDescription}
                            </p>
                          </div>
                        )
                        : <span className="text-gray-400">None</span>
                      }
                    </td>
                  )
                })}
              </tr>

              {/* ── APPLY ─────────────────────────────────────────────────── */}
              <SectionHeader label="Apply" numCards={cards.length} />

              <tr style={{ borderTop: '1px solid #F1F5F9' }}>
                <td
                  className="sticky left-0 bg-white px-4 py-4"
                  style={{ borderRight: '1px solid #CBD5E1' }}
                />
                {cards.map((card) => {
                  const promos = getActivePromotions(card.id)
                  const url    = promos.length > 0 ? promos[0].applyUrl : card.applyUrl
                  return (
                    <td key={card.id} className="px-4 py-4" style={{ borderLeft: '1px solid #F1F5F9' }}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-full font-semibold rounded-xl text-white px-4 py-2.5 text-sm transition-opacity hover:opacity-90"
                        style={{ backgroundColor: '#1F4E79' }}
                      >
                        Apply Now →
                      </a>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-center text-gray-400 leading-relaxed mt-6">
          Reward rates and terms are subject to change. Verify all details with the issuing bank before applying.
          CardSense SG may earn a referral commission if you are approved for a card through our links.
        </p>

      </main>
      <Footer />
    </div>
  )
}
