import type { Transaction } from './excelParser'

export type SpendCategory =
  | 'dining'
  | 'groceries'
  | 'transport'
  | 'petrol'
  | 'online'
  | 'travel'
  | 'entertainment'
  | 'utilities'
  | 'other'

const CATEGORY_KEYWORDS: Record<SpendCategory, string[]> = {
  dining: ['restaurant', 'cafe', 'food', 'mcdonald', 'kfc', 'grab food', 'foodpanda'],
  groceries: ['fairprice', 'ntuc', 'cold storage', 'giant', 'sheng siong', 'supermarket'],
  transport: ['mrt', 'bus', 'grab', 'gojek', 'taxi', 'ez-link', 'transit'],
  petrol: ['shell', 'esso', 'caltex', 'sinopec', 'petronas', 'petrol'],
  online: ['shopee', 'lazada', 'amazon', 'qoo10', 'zalora', 'online'],
  travel: ['airline', 'hotel', 'airbnb', 'booking.com', 'agoda', 'changi'],
  entertainment: ['cinema', 'netflix', 'spotify', 'cinema', 'shaw', 'golden village'],
  utilities: ['sp group', 'singtel', 'starhub', 'm1', 'electricity', 'internet'],
  other: [],
}

export function categorise(description: string): SpendCategory {
  const lower = description.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [SpendCategory, string[]][]) {
    if (category === 'other') continue
    if (keywords.some((kw) => lower.includes(kw))) return category
  }
  return 'other'
}

export interface SpendSummary {
  category: SpendCategory
  total: number
  count: number
}

export function summariseSpending(transactions: Transaction[]): SpendSummary[] {
  const map = new Map<SpendCategory, SpendSummary>()

  for (const tx of transactions) {
    const cat = tx.category as SpendCategory ?? categorise(tx.description)
    const existing = map.get(cat)
    if (existing) {
      existing.total += tx.amount
      existing.count++
    } else {
      map.set(cat, { category: cat, total: tx.amount, count: 1 })
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}
