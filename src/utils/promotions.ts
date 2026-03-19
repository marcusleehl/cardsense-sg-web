import promotionsData from '../data/promotions.json'

export interface Promotion {
  id: string
  cardId: string
  source: 'bank' | 'milelion' | 'singsaver' | 'moneysmart'
  sourceLabel: string
  applyUrl: string
  type: 'welcome_bonus' | 'elevated_earn' | 'merchant_promo' | 'application_offer' | 'fee_waiver' | 'gift'
  targetUser: 'new_to_bank' | 'existing' | 'both'
  title: string
  description: string
  bonusType: 'miles' | 'cashback' | 'gift' | 'fee_waiver' | 'points'
  bonusValue: number
  bonusDescription: string
  minSpendAmount: number
  minSpendMonths: number
  conditions: string
  exclusiveChannel: boolean
  startDate: string
  endDate: string | null
  sourceUrl: string
  lastVerified: string
}

export interface PromotionUserContext {
  isNewToBank: boolean | null    // null = not sure
  canMeetMinSpend: boolean | null // null = not sure
  preferredBonusType: 'miles' | 'cashback' | 'gift' | 'any'
  monthlySpend: number
}

const { promotions: allPromotions } = promotionsData as unknown as { promotions: Promotion[] }

function isActive(p: Promotion): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (p.endDate === null) return true
  return new Date(p.endDate) >= today
}

export function getActivePromotions(cardId: string): Promotion[] {
  return allPromotions
    .filter((p) => p.cardId === cardId && isActive(p))
    .sort((a, b) => b.bonusValue - a.bonusValue)
}

export function getPromotionsBySource(cardId: string): Record<string, Promotion[]> {
  const active = getActivePromotions(cardId)
  const grouped: Record<string, Promotion[]> = {}
  for (const p of active) {
    if (!grouped[p.sourceLabel]) grouped[p.sourceLabel] = []
    grouped[p.sourceLabel].push(p)
  }
  return grouped
}

export function getBestPromotion(
  cardId: string,
  userContext: PromotionUserContext,
): Promotion | null {
  let candidates = getActivePromotions(cardId)

  // Filter by targetUser eligibility
  candidates = candidates.filter((p) => {
    if (p.targetUser === 'both') return true
    if (p.targetUser === 'new_to_bank' && userContext.isNewToBank !== false) return true
    if (p.targetUser === 'existing' && userContext.isNewToBank !== true) return true
    return false
  })

  // If user cannot meet min spend, filter to affordable ones
  if (userContext.canMeetMinSpend === false) {
    const affordable = candidates.filter(
      (p) => p.minSpendAmount === 0 || p.minSpendAmount <= userContext.monthlySpend,
    )
    if (affordable.length > 0) candidates = affordable
  }

  // Prefer matching bonus type, but don't hard-filter (fall back to all)
  if (userContext.preferredBonusType !== 'any') {
    const preferred = candidates.filter((p) => p.bonusType === userContext.preferredBonusType)
    if (preferred.length > 0) candidates = preferred
  }

  return candidates.length > 0 ? candidates[0] : null
}

export function hasActivePromotion(cardId: string): boolean {
  return getActivePromotions(cardId).length > 0
}
