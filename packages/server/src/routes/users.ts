import { Router, Response } from 'express'
import { supabase } from '../db/supabase.js'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js'

const router = Router()

// GET /api/users/subscription - Get user's subscription status
router.get('/subscription', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Get user profile with subscription tier
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier, stripe_customer_id')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return res.status(500).json({ error: 'Failed to fetch subscription status' })
    }

    const tier = profile?.subscription_tier || 'free'

    // Count user's interviews
    const { count: interviewsUsed } = await supabase
      .from('interview_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Get existing interview if on free tier
    let existingInterview = null
    if (tier === 'free' && interviewsUsed && interviewsUsed > 0) {
      const { data: interview } = await supabase
        .from('interview_sessions')
        .select('id, question_id, session_type, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      existingInterview = interview
    }

    return res.json({
      success: true,
      subscription: {
        tier,
        interviewsUsed: interviewsUsed || 0,
        interviewsAllowed: tier === 'pro' ? 'unlimited' : 1,
        existingInterview,
      },
    })
  } catch (err) {
    console.error('Error fetching subscription status:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
