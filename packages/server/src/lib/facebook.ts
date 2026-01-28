import crypto from 'crypto'

const FACEBOOK_PIXEL_ID = process.env.FACEBOOK_PIXEL_ID
const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN
const FACEBOOK_API_VERSION = 'v21.0'

const isDev = process.env.NODE_ENV !== 'production'

// Hash function for user data (Facebook requires SHA256 hashing for PII)
function hashData(data: string): string {
  return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex')
}

interface UserData {
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  externalId?: string
  clientIpAddress?: string
  clientUserAgent?: string
  fbc?: string // Facebook click ID from cookie
  fbp?: string // Facebook browser ID from cookie
}

interface CustomData {
  value?: number
  currency?: string
  contentType?: string
  contentIds?: string[]
  contentName?: string
  numItems?: number
}

interface FacebookEvent {
  event_name: string
  event_time: number
  event_id?: string
  event_source_url?: string
  action_source: 'website' | 'app' | 'email' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other'
  user_data: {
    em?: string // hashed email
    ph?: string // hashed phone
    fn?: string // hashed first name
    ln?: string // hashed last name
    external_id?: string // hashed external ID
    client_ip_address?: string
    client_user_agent?: string
    fbc?: string
    fbp?: string
  }
  custom_data?: {
    value?: number
    currency?: string
    content_type?: string
    content_ids?: string[]
    content_name?: string
    num_items?: number
  }
}

async function sendEvent(event: FacebookEvent): Promise<void> {
  if (!FACEBOOK_PIXEL_ID || !FACEBOOK_ACCESS_TOKEN) {
    if (isDev) {
      console.log('[Facebook CAPI] Missing FACEBOOK_PIXEL_ID or FACEBOOK_ACCESS_TOKEN - skipping event')
    }
    return
  }

  const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${FACEBOOK_PIXEL_ID}/events`

  const payload = {
    data: [event],
    access_token: FACEBOOK_ACCESS_TOKEN,
    // In production, set test_event_code only during testing
    ...(isDev && process.env.FACEBOOK_TEST_EVENT_CODE
      ? { test_event_code: process.env.FACEBOOK_TEST_EVENT_CODE }
      : {}),
  }

  try {
    if (isDev) {
      console.log('[Facebook CAPI] Sending event:', JSON.stringify(event, null, 2))
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('[Facebook CAPI] Error sending event:', result)
    } else if (isDev) {
      console.log('[Facebook CAPI] Event sent successfully:', result)
    }
  } catch (error) {
    console.error('[Facebook CAPI] Failed to send event:', error)
  }
}

function buildUserData(userData: UserData): FacebookEvent['user_data'] {
  const result: FacebookEvent['user_data'] = {}

  if (userData.email) {
    result.em = hashData(userData.email)
  }
  if (userData.phone) {
    result.ph = hashData(userData.phone)
  }
  if (userData.firstName) {
    result.fn = hashData(userData.firstName)
  }
  if (userData.lastName) {
    result.ln = hashData(userData.lastName)
  }
  if (userData.externalId) {
    result.external_id = hashData(userData.externalId)
  }
  if (userData.clientIpAddress) {
    result.client_ip_address = userData.clientIpAddress
  }
  if (userData.clientUserAgent) {
    result.client_user_agent = userData.clientUserAgent
  }
  if (userData.fbc) {
    result.fbc = userData.fbc
  }
  if (userData.fbp) {
    result.fbp = userData.fbp
  }

  return result
}

function buildCustomData(customData: CustomData): FacebookEvent['custom_data'] {
  const result: FacebookEvent['custom_data'] = {}

  if (customData.value !== undefined) {
    result.value = customData.value
  }
  if (customData.currency) {
    result.currency = customData.currency
  }
  if (customData.contentType) {
    result.content_type = customData.contentType
  }
  if (customData.contentIds) {
    result.content_ids = customData.contentIds
  }
  if (customData.contentName) {
    result.content_name = customData.contentName
  }
  if (customData.numItems !== undefined) {
    result.num_items = customData.numItems
  }

  return result
}

// Generate a unique event ID for deduplication
function generateEventId(): string {
  return `${Date.now()}-${crypto.randomUUID()}`
}

// Server-side Facebook Conversions API events
export const facebookAnalytics = {
  // Track successful purchase/subscription
  purchase: async (params: {
    userId: string
    email?: string
    value: number
    currency?: string
    clientIpAddress?: string
    clientUserAgent?: string
    eventSourceUrl?: string
  }) => {
    const event: FacebookEvent = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: generateEventId(),
      event_source_url: params.eventSourceUrl,
      action_source: 'website',
      user_data: buildUserData({
        email: params.email,
        externalId: params.userId,
        clientIpAddress: params.clientIpAddress,
        clientUserAgent: params.clientUserAgent,
      }),
      custom_data: buildCustomData({
        value: params.value,
        currency: params.currency || 'USD',
        contentType: 'product',
        contentIds: ['pro_subscription'],
        contentName: 'YeetCoder Pro Subscription',
        numItems: 1,
      }),
    }

    if (isDev) {
      console.log('[Facebook CAPI] Event: Purchase', {
        userId: params.userId,
        value: params.value,
        currency: params.currency || 'USD',
      })
    }

    await sendEvent(event)
  },

  // Track when user initiates checkout
  initiateCheckout: async (params: {
    userId: string
    email?: string
    value?: number
    currency?: string
    clientIpAddress?: string
    clientUserAgent?: string
    eventSourceUrl?: string
  }) => {
    const event: FacebookEvent = {
      event_name: 'InitiateCheckout',
      event_time: Math.floor(Date.now() / 1000),
      event_id: generateEventId(),
      event_source_url: params.eventSourceUrl,
      action_source: 'website',
      user_data: buildUserData({
        email: params.email,
        externalId: params.userId,
        clientIpAddress: params.clientIpAddress,
        clientUserAgent: params.clientUserAgent,
      }),
      custom_data: buildCustomData({
        value: params.value,
        currency: params.currency || 'USD',
        contentType: 'product',
        contentIds: ['pro_subscription'],
        contentName: 'YeetCoder Pro Subscription',
      }),
    }

    if (isDev) {
      console.log('[Facebook CAPI] Event: InitiateCheckout', { userId: params.userId })
    }

    await sendEvent(event)
  },

  // Track new user registration/signup
  lead: async (params: {
    userId: string
    email?: string
    clientIpAddress?: string
    clientUserAgent?: string
    eventSourceUrl?: string
  }) => {
    const event: FacebookEvent = {
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: generateEventId(),
      event_source_url: params.eventSourceUrl,
      action_source: 'website',
      user_data: buildUserData({
        email: params.email,
        externalId: params.userId,
        clientIpAddress: params.clientIpAddress,
        clientUserAgent: params.clientUserAgent,
      }),
    }

    if (isDev) {
      console.log('[Facebook CAPI] Event: Lead', { userId: params.userId })
    }

    await sendEvent(event)
  },

  // Track content views (e.g., viewing pricing page, specific interview)
  viewContent: async (params: {
    userId?: string
    email?: string
    contentType?: string
    contentIds?: string[]
    contentName?: string
    value?: number
    currency?: string
    clientIpAddress?: string
    clientUserAgent?: string
    eventSourceUrl?: string
  }) => {
    const event: FacebookEvent = {
      event_name: 'ViewContent',
      event_time: Math.floor(Date.now() / 1000),
      event_id: generateEventId(),
      event_source_url: params.eventSourceUrl,
      action_source: 'website',
      user_data: buildUserData({
        email: params.email,
        externalId: params.userId,
        clientIpAddress: params.clientIpAddress,
        clientUserAgent: params.clientUserAgent,
      }),
      custom_data: buildCustomData({
        contentType: params.contentType,
        contentIds: params.contentIds,
        contentName: params.contentName,
        value: params.value,
        currency: params.currency,
      }),
    }

    if (isDev) {
      console.log('[Facebook CAPI] Event: ViewContent', {
        userId: params.userId,
        contentName: params.contentName,
      })
    }

    await sendEvent(event)
  },

  // Track when user completes registration
  completeRegistration: async (params: {
    userId: string
    email?: string
    clientIpAddress?: string
    clientUserAgent?: string
    eventSourceUrl?: string
  }) => {
    const event: FacebookEvent = {
      event_name: 'CompleteRegistration',
      event_time: Math.floor(Date.now() / 1000),
      event_id: generateEventId(),
      event_source_url: params.eventSourceUrl,
      action_source: 'website',
      user_data: buildUserData({
        email: params.email,
        externalId: params.userId,
        clientIpAddress: params.clientIpAddress,
        clientUserAgent: params.clientUserAgent,
      }),
    }

    if (isDev) {
      console.log('[Facebook CAPI] Event: CompleteRegistration', { userId: params.userId })
    }

    await sendEvent(event)
  },
}
