import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

const isDev = import.meta.env.DEV

export function initPostHog() {
  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      // Enable debug mode in development - logs all events to console
      debug: isDev,
      // Explicitly enable session recording
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: {
          password: true,
        },
      },
    })

    if (isDev) {
      console.log('[PostHog] Initialized with debug mode enabled')
      console.log('[PostHog] Session recording enabled:', !posthog.sessionRecordingStarted ? 'starting...' : 'active')
      // Expose posthog on window for debugging
      ;(window as unknown as { posthog: typeof posthog }).posthog = posthog
    }
  }
}

// Helper function to identify user
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (POSTHOG_KEY) {
    posthog.identify(userId, properties)
  }
}

// Helper function to reset user (on logout)
export function resetUser() {
  if (POSTHOG_KEY) {
    posthog.reset()
  }
}

// Event tracking helpers
export const analytics = {
  // Landing page events
  signupInitiated: () => {
    posthog.capture('signup_initiated')
  },

  // Auth events
  userAuthenticated: (userId: string, email?: string) => {
    identifyUser(userId, { email })
    posthog.capture('user_authenticated', { user_id: userId })
  },

  // Dashboard events
  dashboardViewed: (tier: 'free' | 'pro') => {
    posthog.capture('dashboard_viewed', { subscription_tier: tier })
  },

  // Onboarding events
  interviewTypeSelected: (type: 'leetcode' | 'system_design') => {
    posthog.capture('interview_type_selected', { interview_type: type })
  },

  topicSelected: (topicId: string, topicName: string) => {
    posthog.capture('topic_selected', { topic_id: topicId, topic_name: topicName })
  },

  questionSelected: (questionId: string, questionTitle: string, difficulty: string) => {
    posthog.capture('question_selected', {
      question_id: questionId,
      question_title: questionTitle,
      difficulty,
    })
  },

  interviewStartClicked: (questionId: string, interviewType: 'leetcode' | 'system_design') => {
    posthog.capture('interview_start_clicked', {
      question_id: questionId,
      interview_type: interviewType,
    })
  },

  interviewCreated: (interviewId: string, sessionType: 'coding' | 'system_design') => {
    posthog.capture('interview_created', {
      interview_id: interviewId,
      session_type: sessionType,
    })
  },

  // Paywall events
  freeTierLimitHit: () => {
    posthog.capture('free_tier_limit_hit')
  },

  paywallShown: () => {
    posthog.capture('paywall_shown')
  },

  upgradeClicked: () => {
    posthog.capture('upgrade_clicked')
  },

  // Post-upgrade events
  upgradeSuccessful: () => {
    posthog.capture('upgrade_successful')
  },
}

// Expose analytics on window for debugging in dev mode
if (import.meta.env.DEV) {
  ;(window as unknown as { analytics: typeof analytics }).analytics = analytics
}

export { posthog }
