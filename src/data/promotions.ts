import promotionsData from './promotions.json'

export interface Promotion {
  cardId: string
  title: string
  badge: string
  description: string
  value: string
  conditions?: string
  endDate: string | null   // ISO date string or null for ongoing
  lastVerified: string     // ISO date string
}

const allPromotions = promotionsData as Promotion[]

export function getActivePromotions(cardId: string): Promotion[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return allPromotions.filter((p) => {
    if (p.cardId !== cardId) return false
    if (p.endDate === null) return true
    return new Date(p.endDate) >= today
  })
}
