import Footer from '../components/Footer'

export default function Recommendations() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <h1 className="text-3xl font-bold mb-8" style={{ color: '#1F4E79' }}>
            Your Recommendations
          </h1>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
            <p className="text-lg">Card recommendations will appear here</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
