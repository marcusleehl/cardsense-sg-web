/**
 * Realistic sample transactions for Singapore in January 2025.
 * Used by the "Try with sample data" flow so new users can see the full
 * product experience without uploading their own files.
 *
 * Merchant names are chosen to match the categoriser keyword map exactly,
 * so they would also categorise correctly through the normal flow.
 * ccCategory is pre-set to bypass the categorise() call.
 *
 * Approximate monthly spend breakdown:
 *   DINING                      ~$798
 *   TRAVEL                      ~$435
 *   TRANSPORT                   ~$299
 *   ONLINE SHOPPING             ~$206
 *   GROCERIES                   ~$160
 *   HEALTH AND BEAUTY           ~$126
 *   STREAMING AND SUBSCRIPTIONS  ~$73
 *   ENTERTAINMENT                ~$77
 *   RETAIL SHOPPING              ~$60
 *   EDUCATION                    ~$32
 */

import type { Transaction } from './excelParser'

export const SAMPLE_TRANSACTIONS: Transaction[] = [
  // ── STREAMING AND SUBSCRIPTIONS (monthly, top-of-month) ─────────────────────
  {
    id: 'smp-sub-01', date: '2025-01-01', account: 'DBS Multiplier',
    rawCategory: 'subscriptions', merchant: 'Netflix Singapore',
    amount: 17.98, source: 'Sample Data', ccCategory: 'STREAMING AND SUBSCRIPTIONS',
  },
  {
    id: 'smp-sub-02', date: '2025-01-01', account: 'DBS Multiplier',
    rawCategory: 'subscriptions', merchant: 'Spotify Premium',
    amount: 9.99, source: 'Sample Data', ccCategory: 'STREAMING AND SUBSCRIPTIONS',
  },
  {
    id: 'smp-sub-03', date: '2025-01-01', account: 'DBS Multiplier',
    rawCategory: 'subscriptions', merchant: 'Apple iCloud+ Storage',
    amount: 3.98, source: 'Sample Data', ccCategory: 'STREAMING AND SUBSCRIPTIONS',
  },
  {
    id: 'smp-sub-04', date: '2025-01-01', account: 'DBS Multiplier',
    rawCategory: 'subscriptions', merchant: 'Disney+ Hotstar',
    amount: 11.98, source: 'Sample Data', ccCategory: 'STREAMING AND SUBSCRIPTIONS',
  },
  {
    id: 'smp-sub-05', date: '2025-01-01', account: 'DBS Multiplier',
    rawCategory: 'subscriptions', merchant: 'Google One Storage',
    amount: 10.99, source: 'Sample Data', ccCategory: 'STREAMING AND SUBSCRIPTIONS',
  },
  {
    id: 'smp-sub-06', date: '2025-01-01', account: 'DBS Multiplier',
    rawCategory: 'subscriptions', merchant: 'Microsoft 365 Personal',
    amount: 18.00, source: 'Sample Data', ccCategory: 'STREAMING AND SUBSCRIPTIONS',
  },

  // ── TRANSPORT ────────────────────────────────────────────────────────────────
  {
    id: 'smp-trn-01', date: '2025-01-02', account: 'DBS Multiplier',
    rawCategory: 'transport', merchant: 'Grab Taxi',
    amount: 18.50, source: 'Sample Data', ccCategory: 'TRANSPORT',
  },
  {
    id: 'smp-trn-02', date: '2025-01-04', account: 'DBS Multiplier',
    rawCategory: 'transport', merchant: 'SMRT EZ-Link Top-up',
    amount: 30.00, source: 'Sample Data', ccCategory: 'TRANSPORT',
  },
  {
    id: 'smp-trn-03', date: '2025-01-08', account: 'DBS Multiplier',
    rawCategory: 'transport', merchant: 'Shell Petrol Woodlands',
    amount: 82.40, source: 'Sample Data', ccCategory: 'TRANSPORT',
  },
  {
    id: 'smp-trn-04', date: '2025-01-12', account: 'DBS Multiplier',
    rawCategory: 'transport', merchant: 'Grab Taxi',
    amount: 22.80, source: 'Sample Data', ccCategory: 'TRANSPORT',
  },
  {
    id: 'smp-trn-05', date: '2025-01-16', account: 'DBS Multiplier',
    rawCategory: 'transport', merchant: 'Gojek',
    amount: 15.60, source: 'Sample Data', ccCategory: 'TRANSPORT',
  },
  {
    id: 'smp-trn-06', date: '2025-01-20', account: 'DBS Multiplier',
    rawCategory: 'transport', merchant: 'SMRT EZ-Link Top-up',
    amount: 30.00, source: 'Sample Data', ccCategory: 'TRANSPORT',
  },
  {
    id: 'smp-trn-07', date: '2025-01-23', account: 'DBS Multiplier',
    rawCategory: 'transport', merchant: 'Grab Taxi',
    amount: 19.40, source: 'Sample Data', ccCategory: 'TRANSPORT',
  },
  {
    id: 'smp-trn-08', date: '2025-01-27', account: 'DBS Multiplier',
    rawCategory: 'transport', merchant: 'Caltex Petrol Ang Mo Kio',
    amount: 79.80, source: 'Sample Data', ccCategory: 'TRANSPORT',
  },

  // ── DINING ───────────────────────────────────────────────────────────────────
  {
    id: 'smp-din-01', date: '2025-01-03', account: 'OCBC 365',
    rawCategory: 'food', merchant: 'GrabFood Delivery',
    amount: 38.40, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-02', date: '2025-01-05', account: 'OCBC 365',
    rawCategory: 'food', merchant: 'Starbucks Coffee Raffles City',
    amount: 13.50, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-03', date: '2025-01-07', account: 'OCBC 365',
    rawCategory: 'food', merchant: 'Ya Kun Kaya Toast',
    amount: 9.80, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-04', date: '2025-01-09', account: 'OCBC 365',
    rawCategory: 'dining', merchant: 'Din Tai Fung Wisma Atria',
    amount: 112.60, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-05', date: '2025-01-11', account: 'OCBC 365',
    rawCategory: 'food', merchant: 'GrabFood Delivery',
    amount: 44.20, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-06', date: '2025-01-13', account: 'OCBC 365',
    rawCategory: 'food', merchant: 'Toast Box Compass One',
    amount: 12.40, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-07', date: '2025-01-14', account: 'OCBC 365',
    rawCategory: 'dining', merchant: 'Wingstop VivoCity',
    amount: 58.90, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-08', date: '2025-01-16', account: 'OCBC 365',
    rawCategory: 'food', merchant: "McDonald's Singapore",
    amount: 22.80, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-09', date: '2025-01-17', account: 'OCBC 365',
    rawCategory: 'food', merchant: 'Starbucks Coffee Orchard ION',
    amount: 14.20, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-10', date: '2025-01-19', account: 'OCBC 365',
    rawCategory: 'dining', merchant: 'Crystal Jade Golden Mile',
    amount: 142.80, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-11', date: '2025-01-20', account: 'OCBC 365',
    rawCategory: 'food', merchant: 'Foodpanda Delivery',
    amount: 36.50, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-12', date: '2025-01-21', account: 'OCBC 365',
    rawCategory: 'food', merchant: 'Old Chang Kee',
    amount: 12.80, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-13', date: '2025-01-22', account: 'OCBC 365',
    rawCategory: 'dining', merchant: 'Sushi Tei Bugis Junction',
    amount: 88.60, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-14', date: '2025-01-24', account: 'OCBC 365',
    rawCategory: 'dining', merchant: 'Ramen Keisuke Tanjong Pagar',
    amount: 28.50, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-15', date: '2025-01-25', account: 'OCBC 365',
    rawCategory: 'food', merchant: 'Coffee Bean & Tea Leaf',
    amount: 15.90, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-16', date: '2025-01-26', account: 'OCBC 365',
    rawCategory: 'food', merchant: 'GrabFood Delivery',
    amount: 42.30, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-17', date: '2025-01-28', account: 'OCBC 365',
    rawCategory: 'dining', merchant: 'Poulet Bugis+',
    amount: 62.40, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-18', date: '2025-01-29', account: 'OCBC 365',
    rawCategory: 'food', merchant: 'Nasi Lemak Ayam Taliwang',
    amount: 22.40, source: 'Sample Data', ccCategory: 'DINING',
  },
  {
    id: 'smp-din-19', date: '2025-01-31', account: 'OCBC 365',
    rawCategory: 'food', merchant: 'Koufu Food Court',
    amount: 18.60, source: 'Sample Data', ccCategory: 'DINING',
  },

  // ── GROCERIES ────────────────────────────────────────────────────────────────
  {
    id: 'smp-groc-01', date: '2025-01-06', account: 'OCBC 365',
    rawCategory: 'groceries', merchant: 'NTUC FairPrice Compass One',
    amount: 68.40, source: 'Sample Data', ccCategory: 'GROCERIES',
  },
  {
    id: 'smp-groc-02', date: '2025-01-15', account: 'OCBC 365',
    rawCategory: 'groceries', merchant: 'Cold Storage Holland Village',
    amount: 52.80, source: 'Sample Data', ccCategory: 'GROCERIES',
  },
  {
    id: 'smp-groc-03', date: '2025-01-26', account: 'OCBC 365',
    rawCategory: 'groceries', merchant: 'Sheng Siong Supermarket',
    amount: 38.50, source: 'Sample Data', ccCategory: 'GROCERIES',
  },

  // ── TRAVEL ───────────────────────────────────────────────────────────────────
  {
    id: 'smp-trv-01', date: '2025-01-09', account: 'DBS Multiplier',
    rawCategory: 'travel', merchant: 'Scoot Airways',
    amount: 168.00, source: 'Sample Data', ccCategory: 'TRAVEL',
  },
  {
    id: 'smp-trv-02', date: '2025-01-09', account: 'DBS Multiplier',
    rawCategory: 'travel', merchant: 'Agoda Hotel Bali',
    amount: 198.50, source: 'Sample Data', ccCategory: 'TRAVEL',
  },
  {
    id: 'smp-trv-03', date: '2025-01-18', account: 'DBS Multiplier',
    rawCategory: 'travel', merchant: 'Klook Activity Voucher',
    amount: 68.40, source: 'Sample Data', ccCategory: 'TRAVEL',
  },

  // ── HEALTH AND BEAUTY ────────────────────────────────────────────────────────
  {
    id: 'smp-hb-01', date: '2025-01-09', account: 'OCBC 365',
    rawCategory: 'health', merchant: 'Guardian Pharmacy',
    amount: 32.80, source: 'Sample Data', ccCategory: 'HEALTH AND BEAUTY',
  },
  {
    id: 'smp-hb-02', date: '2025-01-14', account: 'OCBC 365',
    rawCategory: 'medical', merchant: 'Raffles Medical Clinic',
    amount: 65.00, source: 'Sample Data', ccCategory: 'HEALTH AND BEAUTY',
  },
  {
    id: 'smp-hb-03', date: '2025-01-23', account: 'OCBC 365',
    rawCategory: 'beauty', merchant: 'Watsons Personal Care',
    amount: 28.40, source: 'Sample Data', ccCategory: 'HEALTH AND BEAUTY',
  },

  // ── ONLINE SHOPPING ──────────────────────────────────────────────────────────
  {
    id: 'smp-osh-01', date: '2025-01-05', account: 'DBS Multiplier',
    rawCategory: 'shopping', merchant: 'Shopee Singapore',
    amount: 45.80, source: 'Sample Data', ccCategory: 'ONLINE SHOPPING',
  },
  {
    id: 'smp-osh-02', date: '2025-01-12', account: 'DBS Multiplier',
    rawCategory: 'shopping', merchant: 'Lazada Singapore',
    amount: 68.40, source: 'Sample Data', ccCategory: 'ONLINE SHOPPING',
  },
  {
    id: 'smp-osh-03', date: '2025-01-20', account: 'DBS Multiplier',
    rawCategory: 'shopping', merchant: 'Amazon SG',
    amount: 52.90, source: 'Sample Data', ccCategory: 'ONLINE SHOPPING',
  },
  {
    id: 'smp-osh-04', date: '2025-01-28', account: 'DBS Multiplier',
    rawCategory: 'shopping', merchant: 'Qoo10 Singapore',
    amount: 38.60, source: 'Sample Data', ccCategory: 'ONLINE SHOPPING',
  },

  // ── ENTERTAINMENT ────────────────────────────────────────────────────────────
  {
    id: 'smp-ent-01', date: '2025-01-11', account: 'OCBC 365',
    rawCategory: 'entertainment', merchant: 'Golden Village VivoCity',
    amount: 32.00, source: 'Sample Data', ccCategory: 'ENTERTAINMENT',
  },
  {
    id: 'smp-ent-02', date: '2025-01-25', account: 'OCBC 365',
    rawCategory: 'entertainment', merchant: 'SISTIC Concert Tickets',
    amount: 45.00, source: 'Sample Data', ccCategory: 'ENTERTAINMENT',
  },

  // ── RETAIL SHOPPING ──────────────────────────────────────────────────────────
  {
    id: 'smp-rsh-01', date: '2025-01-13', account: 'DBS Multiplier',
    rawCategory: 'shopping', merchant: 'Uniqlo Singapore',
    amount: 59.90, source: 'Sample Data', ccCategory: 'RETAIL SHOPPING',
  },

  // ── EDUCATION ────────────────────────────────────────────────────────────────
  {
    id: 'smp-edu-01', date: '2025-01-16', account: 'DBS Multiplier',
    rawCategory: 'education', merchant: 'Kinokuniya Bookstore',
    amount: 32.40, source: 'Sample Data', ccCategory: 'EDUCATION',
  },
]
