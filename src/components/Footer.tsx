import { useState } from 'react'

export default function Footer() {
  const [showModal, setShowModal] = useState(false)

  function handleClear() {
    localStorage.clear()
    window.location.reload()
  }

  return (
    <>
      <footer style={{ borderTop: '1px solid #E5E7EB' }} className="mt-auto py-6 px-4">
        <p className="text-center text-xs max-w-2xl mx-auto leading-relaxed" style={{ color: '#9CA3AF' }}>
          CardSense SG may earn a referral commission if you apply for a card through our links.
          This does not affect our recommendations. Your data is processed locally and never uploaded.
        </p>
        <div className="flex justify-center mt-3">
          <button
            onClick={() => setShowModal(true)}
            className="text-xs underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: '#9CA3AF' }}
          >
            Clear session data
          </button>
        </div>
      </footer>

      {/* ── Confirmation modal ────────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-gray-900 mb-3">Clear session data?</h2>
            <p className="text-sm leading-relaxed mb-2" style={{ color: '#6B7280' }}>
              This will permanently delete:
            </p>
            <ul className="text-sm mb-4 space-y-1 pl-4" style={{ color: '#6B7280', listStyleType: 'disc' }}>
              <li>Your saved card preferences (reward priority, income, perks)</li>
              <li>Your existing cards selection</li>
              <li>Any custom category corrections</li>
            </ul>
            <p className="text-xs mb-5 leading-relaxed" style={{ color: '#9CA3AF' }}>
              Your spending data is already session-only — it is never saved and will be cleared
              automatically when you close this tab.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                style={{ borderColor: '#E5E7EB' }}
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#DC2626' }}
              >
                Clear and reload
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
