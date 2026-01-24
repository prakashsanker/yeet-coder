import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { supabase } from '../db/supabase.js'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js'
import { serverAnalytics } from '../lib/posthog.js'

const router = Router()

// Initialize Stripe (use prod key in production, dev key otherwise)
const isProduction = process.env.NODE_ENV === 'production'
const stripeSecretKey = isProduction
  ? process.env.STRIPE_PROD_SECRET_KEY
  : process.env.STRIPE_DEV_SECRET_KEY || process.env.STRIPE_PROD_SECRET_KEY

const stripePriceId = isProduction
  ? process.env.STRIPE_PRICE_ID
  : process.env.STRIPE_DEV_PRICE_ID || process.env.STRIPE_PRICE_ID

const stripe = new Stripe(stripeSecretKey || '')

// POST /api/stripe/create-checkout-session - Create Stripe Checkout session
router.post(
  '/create-checkout-session',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      const userEmail = req.user?.email

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      if (!stripePriceId) {
        console.error('Stripe Price ID not configured')
        return res.status(500).json({ error: 'Payment not configured' })
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

      const session = await stripe.checkout.sessions.create({
        customer_email: userEmail,
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${frontendUrl}/dashboard?upgraded=true`,
        cancel_url: `${frontendUrl}/dashboard?cancelled=true`,
        metadata: {
          user_id: userId,
        },
      })

      console.log(`[STRIPE] Created checkout session ${session.id} for user ${userId}`)

      return res.json({
        success: true,
        url: session.url,
      })
    } catch (err) {
      console.error('Error creating checkout session:', err)
      return res.status(500).json({ error: 'Failed to create checkout session' })
    }
  }
)

// GET /api/stripe/subscription-details - Get detailed subscription info from Stripe
router.get(
  '/subscription-details',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      // Get the user's stripe_customer_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('stripe_customer_id, subscription_tier')
        .eq('id', userId)
        .single()

      if (profileError || !profile) {
        return res.json({
          success: true,
          subscription: {
            tier: 'free',
            status: null,
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
          },
        })
      }

      if (!profile.stripe_customer_id || profile.subscription_tier !== 'pro') {
        return res.json({
          success: true,
          subscription: {
            tier: profile.subscription_tier || 'free',
            status: null,
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
          },
        })
      }

      // Get the customer's active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        limit: 1,
      })

      if (subscriptions.data.length === 0) {
        return res.json({
          success: true,
          subscription: {
            tier: profile.subscription_tier,
            status: null,
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
          },
        })
      }

      const subscription = subscriptions.data[0] as Stripe.Subscription & {
        current_period_end?: number
      }

      return res.json({
        success: true,
        subscription: {
          tier: profile.subscription_tier,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
        },
      })
    } catch (err) {
      console.error('Error fetching subscription details:', err)
      return res.status(500).json({ error: 'Failed to fetch subscription details' })
    }
  }
)

// POST /api/stripe/cancel-subscription - Cancel user's subscription
router.post(
  '/cancel-subscription',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      // Get the user's stripe_customer_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('stripe_customer_id, subscription_tier')
        .eq('id', userId)
        .single()

      if (profileError || !profile) {
        console.error('Error fetching profile:', profileError)
        return res.status(404).json({ error: 'User profile not found' })
      }

      if (profile.subscription_tier !== 'pro') {
        return res.status(400).json({ error: 'No active subscription to cancel' })
      }

      if (!profile.stripe_customer_id) {
        return res.status(400).json({ error: 'No Stripe customer found' })
      }

      // Get the customer's active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'active',
        limit: 1,
      })

      if (subscriptions.data.length === 0) {
        // No active subscription found, but user is marked as pro - sync the state
        await supabase
          .from('profiles')
          .update({ subscription_tier: 'free' })
          .eq('id', userId)

        return res.status(400).json({ error: 'No active subscription found' })
      }

      // Cancel the subscription at period end (gives user access until billing period ends)
      const subscription = await stripe.subscriptions.update(
        subscriptions.data[0].id,
        { cancel_at_period_end: true }
      )

      console.log(`[STRIPE] Subscription ${subscription.id} set to cancel at period end for user ${userId}`)

      return res.json({
        success: true,
        message: 'Subscription will be cancelled at the end of the billing period',
        cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      })
    } catch (err) {
      console.error('Error cancelling subscription:', err)
      return res.status(500).json({ error: 'Failed to cancel subscription' })
    }
  }
)

// POST /api/stripe/webhook - Handle Stripe webhooks
// Note: This needs raw body, configured in index.ts
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    console.error('Missing stripe signature or webhook secret')
    return res.status(400).json({ error: 'Missing signature' })
  }

  let event: Stripe.Event

  try {
    // req.body should be raw buffer for webhook signature verification
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return res.status(400).json({ error: 'Invalid signature' })
  }

  console.log(`[STRIPE] Received webhook event: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const customerId = session.customer as string

        if (!userId) {
          console.error('No user_id in checkout session metadata')
          break
        }

        // Upgrade user to pro tier
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_tier: 'pro',
            stripe_customer_id: customerId,
          })
          .eq('id', userId)

        if (error) {
          console.error('Error upgrading user to pro:', error)
        } else {
          console.log(`[STRIPE] Upgraded user ${userId} to pro tier`)
          // Track payment completed
          serverAnalytics.paymentCompleted(userId, customerId, session.customer_email || undefined)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Find user by stripe_customer_id and downgrade to free
        const { error } = await supabase
          .from('profiles')
          .update({ subscription_tier: 'free' })
          .eq('stripe_customer_id', customerId)

        if (error) {
          console.error('Error downgrading user to free:', error)
        } else {
          console.log(`[STRIPE] Downgraded customer ${customerId} to free tier`)
          // Track subscription cancelled
          serverAnalytics.subscriptionCancelled(customerId, subscription.id)
        }
        break
      }

      default:
        console.log(`[STRIPE] Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error('Error processing webhook:', err)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }

  return res.json({ received: true })
})

export default router
