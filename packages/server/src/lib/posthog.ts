import { PostHog } from 'posthog-node'

const POSTHOG_KEY = process.env.POSTHOG_KEY
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com'

let posthogClient: PostHog | null = null

export function getPostHogClient(): PostHog | null {
  if (!POSTHOG_KEY) {
    return null
  }

  if (!posthogClient) {
    posthogClient = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
    })
  }

  return posthogClient
}

// Shutdown PostHog client gracefully
export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown()
  }
}

const isDev = process.env.NODE_ENV !== 'production'

// Server-side analytics events
export const serverAnalytics = {
  // Payment events
  paymentCompleted: (userId: string, customerId: string, email?: string) => {
    const client = getPostHogClient()
    if (client) {
      if (isDev) {
        console.log('[PostHog] Event: payment_completed', { userId, customerId, email })
      }
      client.capture({
        distinctId: userId,
        event: 'payment_completed',
        properties: {
          stripe_customer_id: customerId,
          email,
        },
      })
    }
  },

  subscriptionCreated: (userId: string, customerId: string, subscriptionId: string) => {
    const client = getPostHogClient()
    if (client) {
      if (isDev) {
        console.log('[PostHog] Event: subscription_created', { userId, customerId, subscriptionId })
      }
      client.capture({
        distinctId: userId,
        event: 'subscription_created',
        properties: {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        },
      })
    }
  },

  subscriptionCancelled: (customerId: string, subscriptionId: string) => {
    const client = getPostHogClient()
    if (client) {
      if (isDev) {
        console.log('[PostHog] Event: subscription_cancelled', { customerId, subscriptionId })
      }
      // Use customer ID as distinct ID since we may not have user ID
      client.capture({
        distinctId: customerId,
        event: 'subscription_cancelled',
        properties: {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        },
      })
    }
  },
}
