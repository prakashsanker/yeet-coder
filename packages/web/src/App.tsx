import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Roadmap from './pages/Roadmap'
import Onboarding from './pages/Onboarding'
import Interview from './pages/Interview'
import SystemDesignInterview from './pages/SystemDesignInterview'
import Evaluation from './pages/Evaluation'
import { supabase } from './lib/supabase'
import { useAuth } from './contexts/AuthContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-lc-bg-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lc-green"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

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

  return <Navigate to="/dashboard" replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/roadmap" element={<ProtectedRoute><Roadmap /></ProtectedRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/interview/:id" element={<ProtectedRoute><Interview /></ProtectedRoute>} />
      <Route path="/system-design/:id" element={<ProtectedRoute><SystemDesignInterview /></ProtectedRoute>} />
      <Route path="/evaluation/:id" element={<ProtectedRoute><Evaluation /></ProtectedRoute>} />
    </Routes>
  )
}

export default App
