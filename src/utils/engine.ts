import type { SpendSummary } from './categoriser'

export interface CardRecommendation {
  cardId: string
  score: number
  estimatedAnnualRewards: number
  topReasons: string[]
}

export interface UserPreferences {
  preferCashback: boolean
  preferMiles: boolean
  annualFeeOk: boolean
  preferredBanks: string[]
}

// Placeholder scoring engine — will be populated once cards.json is defined
export function scoreCards(
  _spending: SpendSummary[],
  _preferences: UserPreferences
): CardRecommendation[] {
  return []
}
