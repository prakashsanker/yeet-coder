import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
  const location = useLocation()
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
    navigate(user ? '/dashboard' : '/')
  }

  const handleSignIn = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Failed to sign in:', error)
    }
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="app-header flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-6">
        {showBack && (
          <button
            onClick={handleBack}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
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
          <span className="text-[var(--text-primary)] font-semibold tracking-tight text-lg">YeetCoder</span>
        </button>
      </div>

      {/* Optional center content from parent */}
      {children}

      {/* Right side - navigation and user section */}
      {rightContent ? (
        rightContent
      ) : !hideUser ? (
        <div className="flex items-center gap-6">
          {user && (
            <>
              <nav className="hidden md:flex items-center gap-6">
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`text-sm font-medium transition-colors ${
                    isActive('/dashboard')
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Dashboard
                </button>
              </nav>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt=""
                      className="w-8 h-8 rounded-full ring-2 ring-[var(--bg-section)]"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#F3E5F5] flex items-center justify-center text-[var(--accent-purple)] font-medium text-sm">
                      {(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-[var(--text-secondary)] text-sm hidden sm:inline font-medium">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </span>
                  <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showDropdown && (
                  <div className="dropdown-menu absolute right-0 mt-2 w-56 z-50">
                    <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.08)]">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{user.user_metadata?.full_name || 'User'}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowDropdown(false)
                          navigate('/subscription')
                        }}
                        className="dropdown-item w-full text-left"
                      >
                        <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        className="dropdown-item w-full text-left"
                      >
                        <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          {!user && (
            <button
              onClick={handleSignIn}
              className="btn-primary"
            >
              Sign In
            </button>
          )}
        </div>
      ) : null}
    </header>
  )
}
