import type { Transaction } from './excelParser'

// ── types ─────────────────────────────────────────────────────────────────────

export type EarnKey =
  | 'dining' | 'travel' | 'transport' | 'onlineShopping' | 'retailShopping'
  | 'groceries' | 'healthBeauty' | 'entertainment' | 'subscriptions' | 'education' | 'others'

export interface Card {
  id: string
  name: string
  bank: string
  network: string
  rewardType: string
  categorySelectable: boolean
  selectableOptions: string[]
  earnRates: Record<EarnKey, number>
  cashbackEquivalent: Record<EarnKey, number>
  minIncomeSGD: number
  annualFee: number
  firstYearFeeWaived: boolean
  minMonthlySpend: number
  perks: string[]
  welcomeBonus: string
  welcomeBonusValue: number
  useCaseSummary: string
  applyUrl: string
}

export interface UserPreferences {
  rewardPriority: 'miles' | 'cashback' | 'both' | ''
  existingCards: Array<{ id: string; usageCategory: string }>
  perks: string[]
  annualIncome: string
  minMonthlySpend: string
}

export interface CategoryBreakdown {
  label: string
  monthlySpend: number
  monthlyEarnDisplay: string   // "1,180 miles" or "S$23.60"
}

export interface RecommendationResult {
  card: Card
  projectedAnnualValueSGD: number
  incrementalVsCurrentSGD: number
  isMilesCard: boolean
  totalAnnualMiles: number       // miles cards: annual miles from uncovered categories
  monthlyCashbackSGD: number     // cashback cards: monthly cashback from uncovered categories
  topCategories: string[]
  gapFilled: string[]
  minSpendFlag: boolean
  plainEnglishReason: string
  coveredNote: string | null           // e.g. "Your UOB Lady's Card already covers Dining."
  categoryBreakdown: CategoryBreakdown[] // uncovered categories with spend, sorted by value
}

// ── constants (exported for use in UI) ───────────────────────────────────────

export const EARN_KEYS: EarnKey[] = [
  'dining', 'travel', 'transport', 'onlineShopping', 'retailShopping',
  'groceries', 'healthBeauty', 'entertainment', 'subscriptions', 'education', 'others',
]

// ccCategory string (from categoriser) → EarnKey
export const CC_TO_EARN: Record<string, EarnKey> = {
  'DINING':                       'dining',
  'TRAVEL':                       'travel',
  'TRANSPORT':                    'transport',
  'ONLINE SHOPPING':              'onlineShopping',
  'RETAIL SHOPPING':              'retailShopping',
  'GROCERIES':                    'groceries',
  'HEALTH AND BEAUTY':            'healthBeauty',
  'ENTERTAINMENT':                'entertainment',
  'STREAMING AND SUBSCRIPTIONS':  'subscriptions',
  'EDUCATION':                    'education',
  'OTHERS':                       'others',
}

// Preferences dropdown display name → EarnKey (covers human labels + raw key passthrough)
export const DISPLAY_TO_EARN: Record<string, EarnKey> = {
  'Dining':           'dining',
  'Travel':           'travel',
  'Transport':        'transport',
  'Online Shopping':  'onlineShopping',
  'Retail Shopping':  'retailShopping',
  'Groceries':        'groceries',
  'Health & Beauty':  'healthBeauty',
  'Entertainment':    'entertainment',
  'Subscriptions':    'subscriptions',
  'Education':        'education',
  'Others':           'others',
  // raw key passthrough (for categorySelectable cards)
  'dining':           'dining',
  'travel':           'travel',
  'transport':        'transport',
  'onlineShopping':   'onlineShopping',
  'retailShopping':   'retailShopping',
  'groceries':        'groceries',
  'healthBeauty':     'healthBeauty',
  'entertainment':    'entertainment',
  'subscriptions':    'subscriptions',
  'education':        'education',
  'others':           'others',
  // common selectableOptions variants
  'shopping':         'retailShopping',
  'online':           'onlineShopping',
}

export const EARN_LABELS: Record<EarnKey, string> = {
  dining:          'Dining',
  travel:          'Travel',
  transport:       'Transport',
  onlineShopping:  'Online Shopping',
  retailShopping:  'Retail Shopping',
  groceries:       'Groceries',
  healthBeauty:    'Health & Beauty',
  entertainment:   'Entertainment',
  subscriptions:   'Subscriptions',
  education:       'Education',
  others:          'Others',
}

const INCOME_MAP: Record<string, number> = {
  'Below SGD 30,000':         29_000,
  'SGD 30,000 to 50,000':     40_000,
  'SGD 50,000 to 80,000':     65_000,
  'SGD 80,000 to 120,000':   100_000,
  'Above SGD 120,000':        150_000,
}

const SPEND_COMFORT_MAP: Record<string, number> = {
  'No preference':              Infinity,
  'Up to SGD 500 per month':       500,
  'Up to SGD 1,000 per month':   1_000,
  'Up to SGD 2,000 per month':   2_000,
}

const PERK_KEYWORDS: Record<string, string[]> = {
  'Airport lounge access': ['lounge'],
  'Travel insurance':      ['travel insurance', 'insurance'],
  'Dining privileges':     ['dining'],
  'Concierge':             ['concierge'],
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtSGD(n: number): string {
  return n.toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function zeroEarnMap(): Record<EarnKey, number> {
  return Object.fromEntries(EARN_KEYS.map((k) => [k, 0])) as Record<EarnKey, number>
}

// ── internal core: steps 2–5 ─────────────────────────────────────────────────

function _score(
  avgMonthlySpend: Record<EarnKey, number>,
  prefs: UserPreferences,
  cards: Card[],
): RecommendationResult[] {

  // STEP 2: Gap analysis — covered rate per category from existing held cards
  const coveredCategories = zeroEarnMap()
  const coveredByCard: Partial<Record<EarnKey, string>> = {}  // earnKey → card name
  for (const { id, usageCategory } of prefs.existingCards) {
    if (!usageCategory) continue
    const heldCard = cards.find((c) => c.id === id)
    if (!heldCard) continue
    const earnKey = DISPLAY_TO_EARN[usageCategory]
    if (!earnKey) continue
    const rate = heldCard.cashbackEquivalent[earnKey] ?? 0
    if (rate > coveredCategories[earnKey]) {
      coveredCategories[earnKey] = rate
      coveredByCard[earnKey] = heldCard.name
    }
  }

  // Build coveredNote string once — reused across all results
  const coveredByCardGrouped: Record<string, string[]> = {}
  for (const [key, cardName] of Object.entries(coveredByCard)) {
    if ((coveredCategories[key as EarnKey] ?? 0) > 0) {
      if (!coveredByCardGrouped[cardName]) coveredByCardGrouped[cardName] = []
      coveredByCardGrouped[cardName].push(EARN_LABELS[key as EarnKey])
    }
  }
  const coveredNote = Object.keys(coveredByCardGrouped).length > 0
    ? Object.entries(coveredByCardGrouped)
        .map(([cardName, cats]) => {
          const catStr = cats.length === 1
            ? cats[0]
            : cats.slice(0, -1).join(', ') + ' and ' + cats[cats.length - 1]
          return `Your ${cardName} already covers ${catStr}.`
        })
        .join(' ')
    : null

  // STEP 3: Filter candidates
  const heldIds        = new Set(prefs.existingCards.map((c) => c.id))
  const userIncome     = INCOME_MAP[prefs.annualIncome] ?? 0
  const userSpendComfort = SPEND_COMFORT_MAP[prefs.minMonthlySpend] ?? Infinity

  const candidates = cards.filter((c) => {
    if (heldIds.has(c.id)) return false
    if (c.minIncomeSGD > userIncome) return false
    return true
  })

  // STEP 4: Score each candidate
  type Scored = {
    card: Card
    annualValue: number
    incrementalCategoryValue: number
    incrementalByKey: Record<EarnKey, number>
    minSpendFlag: boolean
  }

  const scored: Scored[] = candidates.map((card) => {
    const incrementalByKey = zeroEarnMap()
    let totalIncrementalMonthly = 0

    for (const key of EARN_KEYS) {
      // Exclude 'others' — contains PayNow transfers and non-merchant transactions
      // that earn no rewards on any card; including it artificially inflates scores.
      if (key === 'others') {
        incrementalByKey[key] = 0
        continue
      }
      const existingRate = coveredCategories[key]
      const newRate      = card.cashbackEquivalent[key] ?? 0
      const delta        = Math.max(0, newRate - existingRate)
      const incremental  = avgMonthlySpend[key] * delta
      incrementalByKey[key] = incremental
      totalIncrementalMonthly += incremental
    }

    const incrementalCategoryValue = totalIncrementalMonthly * 12
    let annualValue = incrementalCategoryValue

    if (!card.firstYearFeeWaived) annualValue -= card.annualFee

    annualValue += card.welcomeBonusValue * 0.02 / 2

    for (const userPerk of prefs.perks) {
      if (userPerk === 'No preference') continue
      const keywords       = PERK_KEYWORDS[userPerk] ?? []
      const cardPerksLower = card.perks.map((p) => p.toLowerCase())
      if (keywords.some((kw) => cardPerksLower.some((cp) => cp.includes(kw)))) {
        annualValue += 50
      }
    }

    const minSpendFlag = card.minMonthlySpend > 0 && card.minMonthlySpend > userSpendComfort

    return { card, annualValue, incrementalCategoryValue, incrementalByKey, minSpendFlag }
  })

  // STEP 5: Build top-5 results
  return scored
    .sort((a, b) => b.annualValue - a.annualValue)
    .slice(0, 5)
    .map(({ card, annualValue, incrementalCategoryValue, incrementalByKey, minSpendFlag }) => {

      const keysByValue = (Object.entries(incrementalByKey) as [EarnKey, number][])
        .sort((a, b) => b[1] - a[1])

      const topCategories = keysByValue
        .filter(([, v]) => v > 0)
        .slice(0, 2)
        .map(([k]) => EARN_LABELS[k])

      const gapFilled = EARN_KEYS
        .filter((key) =>
          (coveredCategories[key] ?? 0) === 0 &&
          (card.cashbackEquivalent[key] ?? 0) > 0 &&
          avgMonthlySpend[key] > 0,
        )
        .map((key) => EARN_LABELS[key])

      const [, topMonthlyIncremental] = keysByValue[0] ?? ['others', 0]

      // Breakdown: uncovered categories with spend, sorted by incremental value
      const isMilesCard = card.rewardType === 'miles' || card.rewardType === 'points'

      // Top 2 uncovered categories by incremental monthly value (for the reason sentence)
      const topUncovered = keysByValue
        .filter(([k, v]) => (coveredCategories[k as EarnKey] ?? 0) === 0 && v > 0)
        .slice(0, 2)
        .map(([k]) =>
          `SGD ${fmtSGD(avgMonthlySpend[k as EarnKey])}/month ${EARN_LABELS[k as EarnKey].toLowerCase()}`
        )

      let plainEnglishReason: string
      if (topMonthlyIncremental > 0) {
        let earnPart: string
        if (isMilesCard) {
          earnPart = topUncovered.length > 0
            ? `This card earns strong miles on your ${topUncovered.join(' and ')} spend.`
            : `This card earns strong miles across your uncovered spending categories.`
        } else {
          earnPart = topUncovered.length > 0
            ? `Based on your ${topUncovered.join(' and ')} spend across your remaining ` +
              `uncovered categories, this card earns you SGD ${fmtSGD(incrementalCategoryValue)} more per year.`
            : `This card earns you SGD ${fmtSGD(incrementalCategoryValue)} more per year than your current setup.`
        }
        plainEnglishReason = coveredNote ? `${coveredNote} ${earnPart}` : earnPart
      } else {
        plainEnglishReason = coveredNote
          ? `${coveredNote} ${card.useCaseSummary}`
          : card.useCaseSummary
      }
      const breakdownKeys = EARN_KEYS
        .filter((key) =>
          key !== 'others' &&
          avgMonthlySpend[key] > 0 &&
          (coveredCategories[key] ?? 0) === 0 &&
          (card.earnRates[key] ?? 0) > 0,
        )
        .sort((a, b) => incrementalByKey[b] - incrementalByKey[a])

      const categoryBreakdown: CategoryBreakdown[] = breakdownKeys.map((key) => {
        const monthlySpend = avgMonthlySpend[key]
        const earnRate     = card.earnRates[key] ?? 0
        const monthlyEarnDisplay = isMilesCard
          ? `${Math.round(monthlySpend * earnRate).toLocaleString('en-SG')} miles`
          : `S$${(monthlySpend * earnRate).toFixed(2)}`
        return { label: EARN_LABELS[key], monthlySpend, monthlyEarnDisplay }
      })

      let totalAnnualMiles = 0
      let monthlyCashbackSGD = 0
      for (const key of breakdownKeys) {
        const monthlyEarn = avgMonthlySpend[key] * (card.earnRates[key] ?? 0)
        if (isMilesCard) totalAnnualMiles += Math.round(monthlyEarn)
        else monthlyCashbackSGD += monthlyEarn
      }
      if (isMilesCard) totalAnnualMiles *= 12

      return {
        card,
        projectedAnnualValueSGD:   Math.round(annualValue            * 100) / 100,
        incrementalVsCurrentSGD:   Math.round(incrementalCategoryValue * 100) / 100,
        isMilesCard,
        totalAnnualMiles,
        monthlyCashbackSGD,
        topCategories,
        gapFilled,
        minSpendFlag,
        plainEnglishReason,
        coveredNote,
        categoryBreakdown,
      }
    })
}

// ── public exports ────────────────────────────────────────────────────────────

/** Score cards from raw transaction history. */
export function recommendCards(
  transactions: Transaction[],
  prefs: UserPreferences,
  cards: Card[],
): RecommendationResult[] {
  const categoryTotals = zeroEarnMap()
  for (const tx of transactions) {
    const key = CC_TO_EARN[tx.ccCategory]
    if (key) categoryTotals[key] += tx.amount
  }

  const dates = transactions.map((t) => t.date).sort()
  const monthsOfData = (() => {
    if (dates.length < 2) return 1
    const from = new Date(dates[0])
    const to   = new Date(dates[dates.length - 1])
    return Math.max(
      1,
      (to.getFullYear() - from.getFullYear()) * 12 +
      (to.getMonth()   - from.getMonth())       + 1,
    )
  })()

  const avgMonthlySpend = zeroEarnMap()
  for (const key of EARN_KEYS) {
    avgMonthlySpend[key] = categoryTotals[key] / monthsOfData
  }

  return _score(avgMonthlySpend, prefs, cards)
}

/**
 * Score cards from a pre-computed SpendProfile.
 * avgMonthlyByCategory keys are ccCategory strings (e.g. "DINING", "TRAVEL").
 */
export function recommendFromProfile(
  avgMonthlyByCategory: Record<string, number>,
  prefs: UserPreferences,
  cards: Card[],
): RecommendationResult[] {
  const avgMonthlySpend = zeroEarnMap()
  for (const [cat, amount] of Object.entries(avgMonthlyByCategory)) {
    const key = CC_TO_EARN[cat]
    if (key) avgMonthlySpend[key] = (avgMonthlySpend[key] ?? 0) + amount
  }
  return _score(avgMonthlySpend, prefs, cards)
}

/** Compute each category's best covered cashback-equivalent rate from held cards. */
export function computeCoveredRates(
  existingCards: UserPreferences['existingCards'],
  cards: Card[],
): Record<EarnKey, number> {
  const covered = zeroEarnMap()
  for (const { id, usageCategory } of existingCards) {
    if (!usageCategory) continue
    const heldCard = cards.find((c) => c.id === id)
    if (!heldCard) continue
    const earnKey = DISPLAY_TO_EARN[usageCategory]
    if (!earnKey) continue
    const rate = heldCard.cashbackEquivalent[earnKey] ?? 0
    covered[earnKey] = Math.max(covered[earnKey], rate)
  }
  return covered
}
