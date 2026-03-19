// Re-export everything from the canonical utility so any remaining
// imports from '../data/promotions' continue to work.
export type {
  Promotion,
  PromotionUserContext,
} from '../utils/promotions'

export {
  getActivePromotions,
  getPromotionsBySource,
  getBestPromotion,
  hasActivePromotion,
} from '../utils/promotions'
