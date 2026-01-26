import { User } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'prakashsanker1@gmail.com'

/**
 * Check if the given user is an admin who can see all features
 * (including NeetCode/coding interview content)
 */
export function isAdmin(user: User | null): boolean {
  return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}
