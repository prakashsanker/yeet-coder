import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import Interview from './pages/Interview'
import { supabase } from './lib/supabase'

function AuthCallback() {
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    // Supabase handles the OAuth callback automatically via detectSessionInUrl
    // We just need to wait for it to complete and then redirect
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setIsProcessing(false)
      } else {
        // Give it a moment to process the URL hash
        setTimeout(() => setIsProcessing(false), 1000)
      }
    }
    checkSession()
  }, [])

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-lc-bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lc-green mx-auto mb-4"></div>
          <p className="text-lc-text-secondary">Completing sign in...</p>
        </div>
      </div>
    )
  }

  return <Navigate to="/onboarding" replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/interview/:id" element={<Interview />} />
    </Routes>
  )
}

export default App
