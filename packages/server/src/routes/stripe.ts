import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { supabase } from '../db/supabase'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth'

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
