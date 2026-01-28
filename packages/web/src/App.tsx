import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Landing from './pages/Landing'
import Compare from './pages/Compare'
import Dashboard from './pages/Dashboard'
import Roadmap from './pages/Roadmap'
import Onboarding from './pages/Onboarding'
import Interview from './pages/Interview'
import SystemDesignInterview from './pages/SystemDesignInterview'
import Evaluation from './pages/Evaluation'
import GeneratingEvaluation from './pages/GeneratingEvaluation'
import Subscription from './pages/Subscription'
import { supabase } from './lib/supabase'
import { useAuth } from './contexts/AuthContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
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
    // Use onAuthStateChange to reliably detect when session is established
    // This handles the race condition where getSession() might return null
    // while Supabase is still processing the OAuth callback URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Session established - AuthContext will handle PostHog identify
          setIsProcessing(false)
        }
      }
    )

    // Also check if session already exists (in case event fired before listener was set up)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsProcessing(false)
      }
    })

    // Timeout fallback after 5 seconds to prevent infinite loading
    const timeout = setTimeout(() => {
      setIsProcessing(false)
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Completing sign in...</p>
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
      <Route path="/compare" element={<Compare />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/roadmap" element={<ProtectedRoute><Roadmap /></ProtectedRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/interview/:id" element={<ProtectedRoute><Interview /></ProtectedRoute>} />
      <Route path="/system-design/:id" element={<ProtectedRoute><SystemDesignInterview /></ProtectedRoute>} />
      <Route path="/evaluation/generating/:interviewId" element={<ProtectedRoute><GeneratingEvaluation /></ProtectedRoute>} />
      <Route path="/evaluation/:id" element={<ProtectedRoute><Evaluation /></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
    </Routes>
  )
}

export default App
