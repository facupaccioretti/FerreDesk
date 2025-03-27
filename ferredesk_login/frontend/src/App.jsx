// frontend/src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'

export default function App() {
  return (
    <Routes>
      {/* Redirige la raíz al login */}
      <Route path="/" element={<Navigate to="/login" />} />
      {/* Página de login */}
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  )
}
