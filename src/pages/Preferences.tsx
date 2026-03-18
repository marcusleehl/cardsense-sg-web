import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Footer from '../components/Footer'
import cardsData from '../data/cards.json'
import type { SpendProfile } from './Analysis'

// ── constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cardSensePrefs'

const PERK_OPTIONS = [
  'Airport lounge access',
  'Travel insurance',
  'Dining privileges',
  'Concierge',
  'No preference',
]

const INCOME_OPTIONS = [
  'Below SGD 30,000',
  'SGD 30,000 to 50,000',
  'SGD 50,000 to 80,000',
  'SGD 80,000 to 120,000',
  'Above SGD 120,000',
]

const SPEND_OPTIONS = [
  'No preference',
  'Up to SGD 500 per month',
  'Up to SGD 1,000 per month',
  'Up to SGD 2,000 per month',
]

const CATEGORY_LABELS: Record<string, string> = {
  dining: 'Dining',
  travel: 'Travel',
  transport: 'Transport',
  onlineShopping: 'Online Shopping',
  retailShopping: 'Retail Shopping',
  groceries: 'Groceries',
  healthBeauty: 'Health & Beauty',
  entertainment: 'Entertainment',
  subscriptions: 'Subscriptions',
  education: 'Education',
  others: 'Others',
}

const ALL_CATEGORY_NAMES = Object.values(CATEGORY_LABELS)

// ── types ─────────────────────────────────────────────────────────────────────

interface CardPref {
  id: string
  usageCategory: string
}

export interface Prefs {
  rewardPriority: 'miles' | 'cashback' | 'both' | ''
  existingCards: CardPref[]
  perks: string[]
  annualIncome: string
  minMonthlySpend: string
}

const defaultPrefs: Prefs = {
  rewardPriority: '',
  existingCards: [],
  perks: [],
  annualIncome: '',
  minMonthlySpend: '',
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Preferences() {
  const navigate = useNavigate()
  const location = useLocation()
  const spendProfile: SpendProfile | null = location.state?.spendProfile ?? null

  const [prefs, setPrefs] = useState<Prefs>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return { ...defaultPrefs, ...JSON.parse(saved) }
    } catch {
      // ignore
    }
    return defaultPrefs
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  }, [prefs])

  const isComplete =
    prefs.rewardPriority !== '' &&
    prefs.perks.length > 0 &&
    prefs.annualIncome !== '' &&
    prefs.minMonthlySpend !== ''

  const sortedCards = [...cardsData].sort((a, b) =>
    a.bank !== b.bank ? a.bank.localeCompare(b.bank) : a.name.localeCompare(b.name)
  )

  const selectedCardIds = new Set(prefs.existingCards.map((c) => c.id))

  function toggleCard(cardId: string) {
    setPrefs((prev) => {
      if (selectedCardIds.has(cardId)) {
        return { ...prev, existingCards: prev.existingCards.filter((c) => c.id !== cardId) }
      }
      return { ...prev, existingCards: [...prev.existingCards, { id: cardId, usageCategory: '' }] }
    })
  }

  function setCardCategory(cardId: string, category: string) {
    setPrefs((prev) => ({
      ...prev,
      existingCards: prev.existingCards.map((c) =>
        c.id === cardId ? { ...c, usageCategory: category } : c
      ),
    }))
  }

  function togglePerk(perk: string) {
    setPrefs((prev) => {
      if (perk === 'No preference') {
        return { ...prev, perks: prev.perks.includes('No preference') ? [] : ['No preference'] }
      }
      const without = prev.perks.filter((p) => p !== 'No preference' && p !== perk)
      if (prev.perks.includes(perk)) return { ...prev, perks: without }
      return { ...prev, perks: [...without, perk] }
    })
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <main className="flex-1 px-4 py-10 max-w-2xl mx-auto w-full">

        {/* ── Progress ────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500">Step 2 of 3 — Your Preferences</span>
            <span className="text-sm font-semibold" style={{ color: '#1F4E79' }}>67%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: '67%', backgroundColor: '#1F4E79' }}
            />
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-10" style={{ color: '#1F4E79' }}>
          Your Preferences
        </h1>

        {/* ── Q1: Reward priority ─────────────────────────────────────────── */}
        <Section label="1" heading="What matters most to you?">
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { value: 'miles', label: 'Miles', subtitle: 'Air miles for flights', icon: '✈️' },
                { value: 'cashback', label: 'Cashback', subtitle: 'Monthly savings', icon: '💵' },
                { value: 'both', label: 'Both', subtitle: 'Show me best of each', icon: '⭐' },
              ] as const
            ).map(({ value, label, subtitle, icon }) => {
              const selected = prefs.rewardPriority === value
              return (
                <button
                  key={value}
                  onClick={() => setPrefs((p) => ({ ...p, rewardPriority: value }))}
                  className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 text-center transition-all"
                  style={{
                    borderColor: selected ? '#1F4E79' : '#E5E7EB',
                    backgroundColor: selected ? '#1F4E79' : '#FFFFFF',
                    boxShadow: selected
                      ? '0 4px 14px rgba(31,78,121,0.25)'
                      : '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                >
                  <span className="text-3xl mb-2 leading-none">{icon}</span>
                  <span
                    className="font-semibold text-sm sm:text-base"
                    style={{ color: selected ? '#FFFFFF' : '#1F2937' }}
                  >
                    {label}
                  </span>
                  <span
                    className="text-xs mt-1 leading-tight"
                    style={{ color: selected ? '#BAD4EE' : '#9CA3AF' }}
                  >
                    {subtitle}
                  </span>
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── Q2: Existing cards ──────────────────────────────────────────── */}
        <Section label="2" heading="Which cards do you currently hold?">
          <p className="text-sm text-gray-400 -mt-1 mb-4">
            Select all that apply — we'll avoid recommending cards you already have.
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-y-auto" style={{ maxHeight: '360px' }}>
              {sortedCards.map((card, idx) => {
                const checked = selectedCardIds.has(card.id)
                const cardPref = prefs.existingCards.find((c) => c.id === card.id)
                const dropdownOptions = card.categorySelectable
                  ? card.selectableOptions
                  : ALL_CATEGORY_NAMES

                return (
                  <div key={card.id}>
                    {/* Card row */}
                    <label
                      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                      style={idx > 0 ? { borderTop: '1px solid #F3F4F6' } : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCard(card.id)}
                        className="w-4 h-4 flex-shrink-0 rounded"
                        style={{ accentColor: '#1F4E79' }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 leading-snug">
                          {card.name}
                        </p>
                        <p className="text-xs text-gray-400">{card.bank}</p>
                      </div>
                      <RewardBadge type={card.rewardType} />
                    </label>

                    {/* Category dropdown — shown only when card is checked */}
                    {checked && (
                      <div
                        className="px-4 pb-3 pt-2"
                        style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #F3F4F6' }}
                      >
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                          {card.categorySelectable
                            ? 'Which bonus category have you set?'
                            : 'Which category do you mainly use this card for?'}
                        </label>
                        <select
                          value={cardPref?.usageCategory ?? ''}
                          onChange={(e) => setCardCategory(card.id, e.target.value)}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none"
                          style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}
                        >
                          <option value="">Select a category…</option>
                          {dropdownOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {prefs.existingCards.length > 0 && (
            <p className="text-xs text-gray-400 mt-2 text-right">
              {prefs.existingCards.length} card{prefs.existingCards.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </Section>

        {/* ── Q3: Lifestyle perks ─────────────────────────────────────────── */}
        <Section label="3" heading="Which perks matter to you?">
          <div className="flex flex-wrap gap-2.5">
            {PERK_OPTIONS.map((perk) => {
              const selected = prefs.perks.includes(perk)
              return (
                <button
                  key={perk}
                  onClick={() => togglePerk(perk)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all border-2"
                  style={{
                    borderColor: selected ? '#1F4E79' : '#E5E7EB',
                    backgroundColor: selected ? '#1F4E79' : '#FFFFFF',
                    color: selected ? '#FFFFFF' : '#374151',
                    boxShadow: selected ? '0 2px 8px rgba(31,78,121,0.2)' : 'none',
                  }}
                >
                  {perk}
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── Q4: Annual income ───────────────────────────────────────────── */}
        <Section label="4" heading="What is your annual income?">
          <div className="relative">
            <select
              value={prefs.annualIncome}
              onChange={(e) => setPrefs((p) => ({ ...p, annualIncome: e.target.value }))}
              className="w-full appearance-none bg-white border-2 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none transition-colors"
              style={{
                borderColor: prefs.annualIncome ? '#1F4E79' : '#E5E7EB',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <option value="">Select income bracket…</option>
              {INCOME_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {/* Chevron */}
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              ▾
            </span>
          </div>
        </Section>

        {/* ── Q5: Min monthly spend ───────────────────────────────────────── */}
        <Section label="5" heading="Are you comfortable meeting a minimum monthly spend?">
          <div className="flex flex-col gap-2.5">
            {SPEND_OPTIONS.map((opt) => {
              const selected = prefs.minMonthlySpend === opt
              return (
                <button
                  key={opt}
                  onClick={() => setPrefs((p) => ({ ...p, minMonthlySpend: opt }))}
                  className="w-full text-left px-4 py-3.5 rounded-xl border-2 text-sm transition-all flex items-center gap-3"
                  style={{
                    borderColor: selected ? '#1F4E79' : '#E5E7EB',
                    backgroundColor: selected ? '#EFF6FF' : '#FFFFFF',
                    color: selected ? '#1F4E79' : '#374151',
                    fontWeight: selected ? 600 : 400,
                    boxShadow: selected
                      ? '0 2px 8px rgba(31,78,121,0.1)'
                      : '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Radio indicator */}
                  <span
                    className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                    style={{ borderColor: selected ? '#1F4E79' : '#D1D5DB' }}
                  >
                    {selected && (
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: '#1F4E79' }}
                      />
                    )}
                  </span>
                  {opt}
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        {!isComplete && (
          <p className="text-xs text-center text-gray-400 mb-3">
            Answer all questions to continue
          </p>
        )}
        <button
          onClick={() =>
            isComplete && navigate('/recommendations', { state: { spendProfile, prefs } })
          }
          disabled={!isComplete}
          className="w-full py-3 rounded-xl text-white font-semibold text-base transition-all"
          style={{
            backgroundColor: isComplete ? '#1F4E79' : '#D1D5DB',
            cursor: isComplete ? 'pointer' : 'not-allowed',
            boxShadow: isComplete ? '0 4px 14px rgba(31,78,121,0.3)' : 'none',
          }}
        >
          View Recommendations
        </button>
      </main>
      <Footer />
    </div>
  )
}

// ── sub-components ────────────────────────────────────────────────────────────

function Section({
  label,
  heading,
  children,
}: {
  label: string
  heading: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <div className="flex items-start gap-3 mb-4">
        <span
          className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ backgroundColor: '#EFF6FF', color: '#1F4E79' }}
        >
          {label}
        </span>
        <h2 className="text-base font-semibold text-gray-800 leading-snug">{heading}</h2>
      </div>
      {children}
    </section>
  )
}

function RewardBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    miles: { bg: '#EFF6FF', color: '#1D4ED8' },
    cashback: { bg: '#F0FDF4', color: '#15803D' },
    points: { bg: '#FFF7ED', color: '#C2410C' },
  }
  const s = styles[type] ?? styles.points
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {type}
    </span>
  )
}
