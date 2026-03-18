import type { Transaction } from './excelParser'

export type { Transaction }

export const CATEGORIES = [
  'DINING',
  'TRAVEL',
  'TRANSPORT',
  'ONLINE SHOPPING',
  'RETAIL SHOPPING',
  'GROCERIES',
  'HEALTH AND BEAUTY',
  'ENTERTAINMENT',
  'STREAMING AND SUBSCRIPTIONS',
  'EDUCATION',
  'OTHERS',
] as const

export type Category = typeof CATEGORIES[number]

// ── keyword tables ────────────────────────────────────────────────────────────

const KEYWORD_MAP: Record<Category, string[]> = {
  DINING: [
    'grab food', 'grabfood', 'foodpanda', 'food panda', 'deliveroo',
    'mcdonald', 'mcdonalds', 'kfc', 'subway', 'toast box', 'yakun', 'ya kun',
    'koufu', 'ding tai fung', 'din tai fung', 'bengawan', 'old chang kee',
    'wingstop', 'poulet', 'sushi', 'ramen', 'prata', 'nasi', 'kopitiam',
    'hawker', 'restaurant', 'bistro', 'cafe', 'coffee bean', 'starbucks',
    'bengawan solo', 'stuffd', '6hands', 'foc restaurant', 'burger', 'pizza',
    'noodle', 'chicken rice',
  ],
  TRAVEL: [
    'singapore airlines', 'sia', 'scoot', 'tigerair', 'airasia',
    'cathay pacific', 'jal', 'japan airlines', 'qantas', 'emirates',
    'lufthansa', 'british airways', 'hotel', 'marriott', 'hilton',
    'shangri-la', 'hyatt', 'ihg', 'intercontinental', 'agoda',
    'booking.com', 'expedia', 'trip.com', 'klook', 'changi airport',
    'travel insurance', 'flight', 'air ticket', 'airticket',
    'hcm', 'vietnam', 'batam', 'bali', 'bangkok',
    'malaysia', 'kuala lumpur', 'kl ',
  ],
  TRANSPORT: [
    // NOTE: "grab" alone maps to TRANSPORT; "grab food" / "grabfood" must be
    // caught first by the DINING rule (keyword search runs DINING before TRANSPORT).
    'grab taxi', 'grabcar', 'grabshare', 'gojek', 'comfort', 'comfortdelgro',
    'ez-link', 'ezlink', 'simplygo', 'smrt', 'lta', 'transitlink', 'mrt',
    'petrol', 'shell', 'caltex', 'spc', 'esso',
    // plain "grab" is appended last so the longer DINING variants win
    'grab',
  ],
  'ONLINE SHOPPING': [
    'lazada', 'shopee', 'amazon', 'taobao', 'qoo10', 'zalora', 'asos',
    'love bonito', 'shein', 'aliexpress', 'carousell', 'esim',
  ],
  'RETAIL SHOPPING': [
    'uniqlo', 'zara', 'h&m', 'mango', 'charles keith', 'pedro', 'ikea',
    'courts', 'harvey norman', 'best denki', 'challenger', 'robinsons',
    'tangs', 'marks spencer', 'socks', 'airpods', 'clothes', 'shirt',
    'shoes', 'apple store', 'computer', 'laptop',
  ],
  GROCERIES: [
    'ntuc', 'fairprice', 'cold storage', 'sheng siong', 'giant', 'redmart',
    'jasons', 'the market place', 'marketplace',
  ],
  'HEALTH AND BEAUTY': [
    'clinic', 'polyclinic', 'hospital', 'dental', 'dentist', 'optical',
    'guardian', 'watsons', 'unity pharmacy', 'supplement', 'vitamin', 'gym',
    'fitness first', 'anytime fitness', 'yoga', 'pilates', 'spa', 'massage',
    'raffles medical', 'parkway', 'shampoo', 'venus', 'conditioner',
    'skincare', 'facial',
  ],
  ENTERTAINMENT: [
    'golden village', 'gv cinema', 'shaw', 'cathay cinemas', 'sistic',
    'concert', 'klook', 'toto', '4d', 'escape room', 'theme park', 'zoo',
    'river safari', 'gardens by the bay', 'karaoke', 'nsrcc', 'bowling',
  ],
  'STREAMING AND SUBSCRIPTIONS': [
    'netflix', 'disney', 'spotify', 'apple music', 'youtube premium', 'hbo',
    'amazon prime', 'singtel', 'starhub', 'm1', 'circle life', 'icloud',
    'microsoft', 'google one', 'adobe', 'dropbox', 'norton', 'mcafee',
  ],
  EDUCATION: [
    'tuition', 'skillsfuture', 'udemy', 'coursera', 'popular bookstore',
    'times bookstore', 'kinokuniya', 'school fees',
  ],
  // Explicit OTHERS: checked before rawCategory so a Money Manager tag like
  // "shopping" or "transfer" cannot accidentally promote these to another bucket.
  OTHERS: ['ibkr', 'revolut'],
}

// ── rawCategory → Category mapping ───────────────────────────────────────────

// Keys are lowercased rawCategory values from Money Manager.
const RAW_CATEGORY_MAP: Record<string, Category> = {
  food: 'DINING',
  dining: 'DINING',
  drinks: 'DINING',
  beverages: 'DINING',
  transport: 'TRANSPORT',
  car: 'TRANSPORT',
  shopping: 'RETAIL SHOPPING', // refined further by keyword if needed
  groceries: 'GROCERIES',
  supermarket: 'GROCERIES',
  health: 'HEALTH AND BEAUTY',
  medical: 'HEALTH AND BEAUTY',
  beauty: 'HEALTH AND BEAUTY',
  entertainment: 'ENTERTAINMENT',
  culture: 'ENTERTAINMENT',
  subscriptions: 'STREAMING AND SUBSCRIPTIONS',
  telco: 'STREAMING AND SUBSCRIPTIONS',
  education: 'EDUCATION',
  books: 'EDUCATION',
  travel: 'TRAVEL',
}

// ── in-memory override cache ──────────────────────────────────────────────────

const STORAGE_KEY = 'categoryOverrides'

function loadOverrides(): Map<string, Category> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    const obj = JSON.parse(raw) as Record<string, Category>
    return new Map(Object.entries(obj))
  } catch {
    return new Map()
  }
}

const overrideCache: Map<string, Category> = loadOverrides()

// ── DEBUG: log cache on module load ──────────────────────────────────────────
{
  const entries = [...overrideCache.entries()]
  if (entries.length === 0) {
    console.log('[categoriser] overrideCache loaded — EMPTY (no saved overrides in localStorage)')
  } else {
    console.log(`[categoriser] overrideCache loaded — ${entries.length} override(s):`)
    entries.forEach(([k, v]) => console.log(`  "${k}" → ${v}`))
  }
}

// ── exported functions ────────────────────────────────────────────────────────

export function overrideCategory(merchant: string, category: string): void {
  const key = merchant.toLowerCase().trim()
  overrideCache.set(key, category as Category)
  try {
    const obj: Record<string, string> = {}
    overrideCache.forEach((v, k) => { obj[k] = v })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch {
    // localStorage unavailable (e.g. SSR / private browsing)
  }
}

export function categorise(transaction: Transaction): Category {
  const merchantRaw = transaction.merchant
  const merchantLower = merchantRaw.toLowerCase().trim()
  const rawLower = transaction.rawCategory.toLowerCase().trim()

  // 1. User override — key is always lowercased + trimmed merchant name
  const override = overrideCache.get(merchantLower)

  let result: Category

  if (override) {
    result = override
  } else if (KEYWORD_MAP.OTHERS.some((kw) => merchantLower.includes(kw))) {
    // 2. Explicit OTHERS list — checked before rawCategory so Money Manager tags
    //    like "shopping" cannot misclassify investment/transfer merchants.
    result = 'OTHERS'
  } else if (rawLower && rawLower !== 'shopping' && RAW_CATEGORY_MAP[rawLower]) {
    // 3. rawCategory direct match — but for Shopping, fall through to keyword
    //    check so we can distinguish Online vs Retail.
    result = RAW_CATEGORY_MAP[rawLower]
  } else {
    // 4. Keyword substring search on merchant name.
    //    Iterate categories in declaration order (DINING before TRANSPORT)
    //    so that "grab food" / "grabfood" is caught before the plain "grab" entry.
    result = 'OTHERS'
    for (const cat of CATEGORIES) {
      if (cat === 'OTHERS') continue
      if (KEYWORD_MAP[cat].some((kw) => merchantLower.includes(kw))) {
        result = cat
        break
      }
    }

    // 5. rawCategory shopping fallback
    if (result === 'OTHERS' && rawLower === 'shopping') result = 'RETAIL SHOPPING'
  }

  // ── DEBUG ──────────────────────────────────────────────────────────────────
  console.log(
    `[categorise] "${merchantRaw}" → key="${merchantLower}" | ` +
    `rawCat="${rawLower}" | override=${override ?? 'none'} | result=${result}`
  )
  // ──────────────────────────────────────────────────────────────────────────

  return result
}
