import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const EMAIL = 'rdkgpian@gmail.com'

async function main() {
  console.log(`Looking up user: ${EMAIL}\n`)

  // First, find the user by email in auth.users
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers()

  if (userError) {
    console.error('Error fetching users:', userError)
    return
  }

  const user = userData.users.find(u => u.email === EMAIL)

  if (!user) {
    console.log(`User with email ${EMAIL} not found`)
    return
  }

  console.log('User found:')
  console.log(`  ID: ${user.id}`)
  console.log(`  Email: ${user.email}`)
  console.log(`  Created: ${user.created_at}`)
  console.log(`  Last sign in: ${user.last_sign_in_at}`)
  console.log()

  // Now fetch their interview sessions
  const { data: interviews, error: interviewError } = await supabase
    .from('interview_sessions')
    .select('id, status, session_type, transcript, started_at, ended_at, time_spent_seconds')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })

  if (interviewError) {
    console.error('Error fetching interviews:', interviewError)
    return
  }

  if (!interviews || interviews.length === 0) {
    console.log('No interview sessions found for this user')
    return
  }

  console.log(`Found ${interviews.length} interview session(s):\n`)

  for (const interview of interviews) {
    console.log('-------------------------------------------')
    console.log(`Interview ID: ${interview.id}`)
    console.log(`  Type: ${interview.session_type}`)
    console.log(`  Status: ${interview.status}`)
    console.log(`  Started: ${interview.started_at}`)
    console.log(`  Ended: ${interview.ended_at || 'N/A'}`)
    console.log(`  Time spent: ${interview.time_spent_seconds || 0} seconds`)

    const transcript = interview.transcript as Array<{speaker: string, text: string, timestamp: number}> | null
    console.log('\nRaw transcript:')
    console.log(JSON.stringify(transcript, null, 2))
    console.log()
  }
}

main()
