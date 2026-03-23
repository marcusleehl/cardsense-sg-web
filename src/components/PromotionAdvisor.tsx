import { useState, useEffect } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import {
  getActivePromotions,
  getPromotionsBySource,
  type Promotion,
} from '../utils/promotions'
import type { UserPreferences } from '../utils/engine'

// ── types ─────────────────────────────────────────────────────────────────────

type NewToBankAnswer = 'yes' | 'no' | 'not_sure' | null
type MeetSpendAnswer = 'yes_easily' | 'yes_with_effort' | 'not_sure' | 'no' | null
type BonusPrefAnswer = 'miles' | 'cashback' | 'gift' | 'any' | null

interface AIResult {
  recommendedPromotionId: string | null
  reason: string
  channelAdvice: string
  caveat: string | null
}

interface Props {
  cardId: string
  cardName: string
  bankName: string
  monthlySpend: number
  userPrefs: UserPreferences | null
}

// ── pill selector ──────────────────────────────────────────────────────────────

function PillGroup<T extends string | null>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-4 py-2 rounded-full text-sm font-medium border transition-all"
          style={
            value === opt.value
              ? { backgroundColor: '#1F4E79', color: '#fff', borderColor: '#1F4E79' }
              : { backgroundColor: '#fff', color: '#374151', borderColor: '#D1D5DB' }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── promotion row in the full table ───────────────────────────────────────────

function PromoRow({ promo }: { promo: Promotion }) {
  const targetLabel =
    promo.targetUser === 'new_to_bank'
      ? 'New customers'
      : promo.targetUser === 'existing'
        ? 'Existing customers'
        : 'All customers'

  return (
    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
      <td className="py-3 pr-3 text-xs font-medium text-gray-700">{promo.sourceLabel}</td>
      <td className="py-3 pr-3 text-xs text-gray-600 leading-relaxed">{promo.title}</td>
      <td className="py-3 pr-3 text-xs font-semibold" style={{ color: '#EA580C' }}>
        {promo.bonusDescription}
      </td>
      <td className="py-3 pr-3 text-xs text-gray-500">
        {promo.minSpendAmount > 0
          ? `SGD ${promo.minSpendAmount.toLocaleString('en-SG')}${promo.minSpendMonths > 1 ? `/${promo.minSpendMonths}mo` : ''}`
          : 'None'}
      </td>
      <td className="py-3 pr-3 text-xs text-gray-500">{targetLabel}</td>
      <td className="py-3">
        <a
          href={promo.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#1F4E79' }}
        >
          Apply →
        </a>
      </td>
    </tr>
  )
}

// ── main component ─────────────────────────────────────────────────────────────

export default function PromotionAdvisor({
  cardId,
  cardName,
  bankName,
  monthlySpend,
  userPrefs: _userPrefs,
}: Props) {
  const activePromos = getActivePromotions(cardId)
  const bySource = getPromotionsBySource(cardId)

  const [newToBank, setNewToBank] = useState<NewToBankAnswer>(null)
  const [meetSpend, setMeetSpend] = useState<MeetSpendAnswer>(null)
  const [bonusPref, setBonusPref] = useState<BonusPrefAnswer>(null)
  const [aiResult, setAiResult] = useState<AIResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiError, setAiError] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const maxMinSpend = activePromos.reduce((max, p) => Math.max(max, p.minSpendAmount), 0)
  const allAnswered = newToBank !== null && meetSpend !== null && bonusPref !== null

  // ── trigger AI call when all 3 questions answered ────────────────────────────
  useEffect(() => {
    if (!allAnswered || aiResult || loading || activePromos.length === 0) return

    const newToBankLabel =
      newToBank === 'yes' ? 'yes' : newToBank === 'no' ? 'no' : 'not sure'
    const meetSpendLabel =
      meetSpend === 'yes_easily'
        ? 'yes easily'
        : meetSpend === 'yes_with_effort'
          ? 'yes with effort'
          : meetSpend === 'no'
            ? 'no'
            : 'not sure'

    const promoList = activePromos
      .map(
        (p) =>
          `- Source: ${p.sourceLabel} | Offer: ${p.bonusDescription} | Min spend: SGD ${p.minSpendAmount}${p.minSpendMonths > 1 ? ` over ${p.minSpendMonths} months` : ''} | Conditions: ${p.conditions} | Apply URL: ${p.applyUrl} | For: ${p.targetUser} | Exclusive: ${p.exclusiveChannel ? 'yes' : 'no'} | ID: ${p.id}`,
      )
      .join('\n')

    const systemPrompt = `You are a Singapore credit card promotions advisor. Analyse the available promotions and recommend the best one for this specific user. Be concise and practical.`

    const userPrompt = `The user is considering applying for ${cardName} from ${bankName}.

Available promotions:
${promoList}

User context:
New to bank: ${newToBankLabel}
Can meet minimum spend: ${meetSpendLabel}
Preferred bonus: ${bonusPref}

Recommend the single best promotion for this user. Respond in this exact JSON format with no other text:
{
  "recommendedPromotionId": "string or null if none suitable",
  "reason": "2 to 3 sentences in plain English",
  "channelAdvice": "which URL to apply through and why",
  "caveat": "important warning or null"
}`

    async function callAI() {
      setLoading(true)
      setAiError(false)
      try {
        const client = new Anthropic({
          apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY as string,
          dangerouslyAllowBrowser: true,
        })
        const message = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })
        const text = (message.content[0] as { type: string; text: string }).text.trim()
        const parsed = JSON.parse(text) as AIResult
        setAiResult(parsed)
      } catch {
        setAiError(true)
      } finally {
        setLoading(false)
      }
    }

    void callAI()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnswered])

  const recommendedPromo = aiResult?.recommendedPromotionId
    ? activePromos.find((p) => p.id === aiResult.recommendedPromotionId)
    : null

  // ── no promotions state ────────────────────────────────────────────────────
  if (activePromos.length === 0) {
    return (
      <div>
        <p className="text-sm text-gray-400 mb-3">
          No active promotions at this time. Check the bank website and SingSaver for the latest
          offers.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`https://www.singsaver.com.sg/credit-cards`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium underline"
            style={{ color: '#1F4E79' }}
          >
            SingSaver credit cards →
          </a>
          <a
            href={`https://www.moneysmart.sg/credit-cards`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium underline"
            style={{ color: '#1F4E79' }}
          >
            MoneySmart credit cards →
          </a>
        </div>
      </div>
    )
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Questions */}
      {!allAnswered && (
        <div className="space-y-5 mb-6">
          {/* Q1 */}
          <div>
            <p className="text-sm font-semibold text-gray-700">
              Are you new to {bankName}?
            </p>
            <PillGroup<NewToBankAnswer>
              options={[
                { value: 'yes', label: 'Yes, new customer' },
                { value: 'no', label: 'No, existing customer' },
                { value: 'not_sure', label: 'Not sure' },
              ]}
              value={newToBank}
              onChange={setNewToBank}
            />
          </div>

          {/* Q2 — only show after Q1 */}
          {newToBank !== null && (
            <div>
              <p className="text-sm font-semibold text-gray-700">
                Can you spend{' '}
                {maxMinSpend > 0 ? (
                  <span className="font-bold" style={{ color: '#1F4E79' }}>
                    SGD {maxMinSpend.toLocaleString('en-SG')}
                  </span>
                ) : (
                  'the required amount'
                )}{' '}
                to qualify for the top promotion?
              </p>
              <PillGroup<MeetSpendAnswer>
                options={[
                  { value: 'yes_easily', label: 'Yes easily' },
                  { value: 'yes_with_effort', label: 'Yes with effort' },
                  { value: 'not_sure', label: 'Not sure' },
                  { value: 'no', label: 'No' },
                ]}
                value={meetSpend}
                onChange={setMeetSpend}
              />
            </div>
          )}

          {/* Q3 — only show after Q2 */}
          {meetSpend !== null && (
            <div>
              <p className="text-sm font-semibold text-gray-700">
                What welcome bonus do you prefer?
              </p>
              <PillGroup<BonusPrefAnswer>
                options={[
                  { value: 'miles', label: 'Miles' },
                  { value: 'cashback', label: 'Cash' },
                  { value: 'gift', label: 'Gift' },
                  { value: 'any', label: 'Best overall value' },
                ]}
                value={bonusPref}
                onChange={setBonusPref}
              />
            </div>
          )}
        </div>
      )}

      {/* Answers summary (after all answered) */}
      {allAnswered && (
        <div
          className="flex flex-wrap gap-2 mb-5 p-3 rounded-xl text-xs"
          style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
        >
          {[
            { label: 'New to bank', value: newToBank === 'yes' ? 'Yes' : newToBank === 'no' ? 'No' : 'Not sure' },
            {
              label: 'Can meet spend',
              value:
                meetSpend === 'yes_easily'
                  ? 'Yes easily'
                  : meetSpend === 'yes_with_effort'
                    ? 'With effort'
                    : meetSpend === 'no'
                      ? 'No'
                      : 'Not sure',
            },
            { label: 'Preference', value: bonusPref === 'any' ? 'Best value' : bonusPref ?? '' },
          ].map((item) => (
            <span key={item.label} className="text-gray-500">
              <span className="font-medium text-gray-700">{item.label}:</span> {item.value}
            </span>
          ))}
          <button
            onClick={() => {
              setNewToBank(null)
              setMeetSpend(null)
              setBonusPref(null)
              setAiResult(null)
              setAiError(false)
            }}
            className="ml-auto text-xs underline"
            style={{ color: '#1F4E79' }}
          >
            Change answers
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div
          className="flex flex-col items-center justify-center gap-3 py-8 rounded-2xl mb-4"
          style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
        >
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#1F4E79', borderTopColor: 'transparent' }}
          />
          <p className="text-sm font-medium" style={{ color: '#1E40AF' }}>
            Finding your best promotion…
          </p>
        </div>
      )}

      {/* AI error fallback */}
      {aiError && !loading && (
        <div
          className="flex gap-2.5 p-3 rounded-xl mb-4 text-xs"
          style={{ backgroundColor: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE68A' }}
        >
          <span>⚠️</span>
          <span>
            Could not load personalised recommendation. Browse all available promotions below.
          </span>
        </div>
      )}

      {/* AI result */}
      {aiResult && !loading && (
        <div
          className="rounded-2xl p-5 mb-5"
          style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}
        >
          {recommendedPromo ? (
            <>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-1">
                    Recommended for you
                  </p>
                  <p className="text-lg font-bold text-gray-900 leading-tight">
                    {recommendedPromo.title}
                  </p>
                  <p
                    className="text-base font-semibold mt-0.5"
                    style={{ color: '#EA580C' }}
                  >
                    {recommendedPromo.bonusDescription}
                  </p>
                </div>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}
                >
                  {recommendedPromo.sourceLabel}
                </span>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed mb-3">{aiResult.reason}</p>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">{aiResult.channelAdvice}</p>

              {aiResult.caveat && (
                <div
                  className="flex gap-2 text-xs rounded-xl px-3 py-2 mb-4 leading-relaxed"
                  style={{ backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}
                >
                  <span className="flex-shrink-0">⚠️</span>
                  <span>{aiResult.caveat}</span>
                </div>
              )}

              <a
                href={recommendedPromo.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full font-semibold rounded-xl text-white py-3 text-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#1F4E79' }}
              >
                Apply via {recommendedPromo.sourceLabel} →
              </a>
            </>
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed">{aiResult.reason}</p>
          )}
        </div>
      )}

      {/* See all promotions toggle */}
      {activePromos.length > 0 && (
        <div>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium mb-3 transition-opacity hover:opacity-70"
            style={{ color: '#1F4E79' }}
          >
            <span
              className="text-xs transition-transform"
              style={{ transform: showAll ? 'rotate(90deg)' : 'none', display: 'inline-block' }}
            >
              ▶
            </span>
            {showAll ? 'Hide' : 'See all'} promotions ({activePromos.length} across{' '}
            {Object.keys(bySource).length} sources)
          </button>

          {showAll && (
            <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #E2E8F0' }}>
              <table className="w-full text-xs min-w-[640px]">
                <thead style={{ backgroundColor: '#F8FAFC' }}>
                  <tr>
                    {['Source', 'Offer', 'Bonus value', 'Min spend', 'For', 'Apply'].map((h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-2.5 font-semibold text-gray-400 uppercase tracking-wide"
                        style={{ borderBottom: '1px solid #E2E8F0' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {activePromos.map((promo) => (
                    <PromoRow key={promo.id} promo={promo} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
