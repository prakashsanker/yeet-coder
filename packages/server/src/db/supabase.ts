import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

let supabaseInstance: SupabaseClient | null = null

if (supabaseUrl && supabaseServiceKey) {
  supabaseInstance = createClient(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
} else {
  console.warn('Supabase credentials not configured. Database operations will fail.')
}

// Create a chainable mock that supports common Supabase patterns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockQuery(): any {
  const mockResult = { data: [], error: null }

  const chainable = {
    select: () => chainable,
    order: () => chainable,
    limit: () => chainable,
    eq: () => chainable,
    single: () => Promise.resolve({ data: null, error: { code: 'NOT_CONFIGURED', message: 'Supabase not configured' } }),
    insert: () => chainable,
    update: () => chainable,
    delete: () => chainable,
    then: (resolve: (value: typeof mockResult) => void) => {
      resolve(mockResult)
      return Promise.resolve(mockResult)
    },
  }

  return chainable
}

const mockClient = {
  from: () => createMockQuery(),
}

export const supabase = (supabaseInstance || mockClient) as SupabaseClient
