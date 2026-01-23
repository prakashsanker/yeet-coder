import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface AppHeaderProps {
  /** Optional: Show a back button */
  showBack?: boolean
  /** Optional: Custom back navigation handler */
  onBack?: () => void
  /** Optional: Additional content to show in the center/right of the header */
  children?: React.ReactNode
  /** Optional: Content to show on the right side (replaces user info) */
  rightContent?: React.ReactNode
  /** Optional: Hide the user section entirely */
  hideUser?: boolean
}

export default function AppHeader({ showBack, onBack, children, rightContent, hideUser }: AppHeaderProps) {
  const navigate = useNavigate()
  const { user, signInWithGoogle, signOut } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      navigate(-1)
    }
  }

  const handleLogoClick = () => {
    // Go to dashboard if logged in, otherwise landing page
    navigate(user ? '/dashboard' : '/')
  }

  const handleSignIn = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Failed to sign in:', error)
    }
  }

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-lc-border bg-lc-bg-dark/95 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-4">
        {showBack && (
          <button
            onClick={handleBack}
            className="text-lc-text-muted hover:text-lc-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <button
          onClick={handleLogoClick}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-brand-orange rounded-lg flex items-center justify-center">
            <span className="text-lc-bg-dark font-bold text-lg">Y</span>
          </div>
          <span className="text-lc-text-primary font-semibold text-lg">YeetCoder</span>
        </button>
      </div>

      {/* Optional center content from parent */}
      {children}

      {/* Right side - either custom content or user section */}
      {rightContent ? (
        rightContent
      ) : !hideUser && !children ? (
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <button
                onClick={() => navigate('/roadmap')}
                className="text-lc-text-muted hover:text-lc-text-primary text-sm transition-colors"
              >
                Roadmap
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-lc-text-muted hover:text-lc-text-primary text-sm transition-colors"
              >
                Dashboard
              </button>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt=""
                      className="w-8 h-8 rounded-full"
                      onError={(e) => {
                        // Hide broken image and show fallback
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white font-medium text-sm">
                      {(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-lc-text-secondary text-sm hidden sm:inline">
                    {user.user_metadata?.full_name || user.email}
                  </span>
                  <svg className="w-4 h-4 text-lc-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-lc-bg-layer-2 border border-lc-border rounded-lg shadow-lg py-1 z-50">
                    <button
                      onClick={() => {
                        setShowDropdown(false)
                        navigate('/subscription')
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-lc-text-secondary hover:bg-lc-bg-layer-3 hover:text-lc-text-primary transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Subscription
                    </button>
                    <button
                      onClick={async () => {
                        await signOut()
                        setShowDropdown(false)
                        navigate('/')
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-lc-text-secondary hover:bg-lc-bg-layer-3 hover:text-lc-text-primary transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={handleSignIn}
              className="px-4 py-1.5 bg-lc-bg-layer-2 hover:bg-lc-bg-layer-3 text-lc-text-primary text-sm rounded-lg transition-colors border border-lc-border"
            >
              Sign In
            </button>
          )}
        </div>
      ) : null}
    </header>
  )
}
