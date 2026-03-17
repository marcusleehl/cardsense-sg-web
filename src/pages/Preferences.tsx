import { useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'

export default function Preferences() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <h1 className="text-3xl font-bold mb-8" style={{ color: '#1F4E79' }}>
            Your Preferences
          </h1>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
            <p className="text-lg">Preference questions will appear here</p>
          </div>

          <button
            onClick={() => navigate('/recommendations')}
            className="mt-8 w-full py-3 rounded-xl text-white font-semibold text-base transition-opacity"
            style={{ backgroundColor: '#1F4E79' }}
          >
            View Recommendations
          </button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
