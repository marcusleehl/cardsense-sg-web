import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid #E5E7EB' }} className="mt-auto py-6 px-4">
      <p className="text-center text-xs max-w-2xl mx-auto leading-relaxed" style={{ color: '#9CA3AF' }}>
        CardSense SG may earn a referral commission if you apply for a card through our links.
        This does not affect our recommendations. Your data is processed locally and never uploaded.
      </p>
      <div className="flex justify-center mt-3">
        <Link
          to="/privacy"
          className="text-xs underline underline-offset-2 transition-opacity hover:opacity-70"
          style={{ color: '#9CA3AF' }}
        >
          Privacy
        </Link>
      </div>
    </footer>
  )
}
