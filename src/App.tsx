import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Upload from './pages/Upload'
import Analysis from './pages/Analysis'
import Preferences from './pages/Preferences'
import Recommendations from './pages/Recommendations'
import CardDetail from './pages/CardDetail'
import Compare from './pages/Compare'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Upload />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/preferences" element={<Preferences />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/card/:id" element={<CardDetail />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
