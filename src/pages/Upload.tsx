import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'

interface UploadedFile {
  id: string
  file: File
}

export default function Upload() {
  const navigate = useNavigate()
  const xlsxInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])

  function handleFiles(files: FileList | null) {
    if (!files) return
    const newFiles: UploadedFile[] = Array.from(files).map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
    }))
    setUploadedFiles((prev) => [...prev, ...newFiles])
  }

  function removeFile(id: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          {/* Heading */}
          <h1 className="text-4xl font-bold text-center mb-2" style={{ color: '#1F4E79' }}>
            CardSense SG
          </h1>
          <p className="text-center text-gray-500 mb-10 text-lg">
            Find your perfect Singapore credit card
          </p>

          {/* Upload area */}
          <div className="border-2 border-dashed border-blue-200 rounded-2xl p-8 bg-white text-center">
            <p className="text-gray-500 mb-6 text-sm">
              Upload your spending data to get started
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              <button
                onClick={() => xlsxInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors hover:bg-blue-50"
                style={{ borderColor: '#1F4E79', color: '#1F4E79' }}
              >
                <span>📊</span> Import Money Manager Excel (.xlsx)
              </button>
              <button
                onClick={() => pdfInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors hover:bg-blue-50"
                style={{ borderColor: '#1F4E79', color: '#1F4E79' }}
              >
                <span>📄</span> Import Bank Statement PDF (.pdf)
              </button>
            </div>

            <p className="text-xs text-gray-400">You can import multiple files</p>

            <input
              ref={xlsxInputRef}
              type="file"
              accept=".xlsx,.xls"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* File list */}
          {uploadedFiles.length > 0 && (
            <ul className="mt-4 space-y-2">
              {uploadedFiles.map(({ id, file }) => (
                <li
                  key={id}
                  className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-gray-100 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg">{file.name.endsWith('.pdf') ? '📄' : '📊'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(id)}
                    className="ml-4 text-gray-300 hover:text-red-400 transition-colors text-xl leading-none flex-shrink-0"
                    aria-label="Remove file"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Analyse button */}
          <button
            disabled={uploadedFiles.length === 0}
            onClick={() => navigate('/analysis', { state: { files: uploadedFiles.map((f) => f.file) } })}
            className="mt-6 w-full py-3 rounded-xl text-white font-semibold text-base transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#1F4E79' }}
          >
            Analyse My Spending
          </button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
