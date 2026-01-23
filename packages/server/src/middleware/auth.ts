import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

// Create a separate client for auth verification
const supabaseAuth = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email?: string
  }
}

/**
 * Middleware that requires authentication.
 * Returns 401 if no valid token is provided.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' })
    }

    const token = authHeader.replace('Bearer ', '')

    if (!supabaseAuth) {
      console.warn('Supabase not configured, skipping auth verification')
      // In development without Supabase, use a demo user
      req.user = { id: '00000000-0000-0000-0000-000000000000' }
      return next()
    }

    const { data: { user }, error } = await supabaseAuth.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    req.user = {
      id: user.id,
      email: user.email,
    }

    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return res.status(500).json({ error: 'Authentication failed' })
  }
}

/**
 * Middleware that optionally authenticates.
 * Allows unauthenticated requests to proceed, but attaches user if token is valid.
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      // No token provided, continue without user
      return next()
    }

    const token = authHeader.replace('Bearer ', '')

    if (!supabaseAuth) {
      // In development without Supabase, use demo user if header present
      req.user = { id: '00000000-0000-0000-0000-000000000000' }
      return next()
    }

    const { data: { user }, error } = await supabaseAuth.auth.getUser(token)

    if (!error && user) {
      req.user = {
        id: user.id,
        email: user.email,
      }
    }

    next()
  } catch (error) {
    // Don't fail on auth errors for optional auth
    console.warn('Optional auth middleware error:', error)
    next()
  }
}
