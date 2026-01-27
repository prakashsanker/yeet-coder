import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkReferenceSolutions() {
  // Get all system design questions
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, title, type, metadata')
    .eq('type', 'system_design')

  if (error) {
    console.error('Error fetching questions:', error)
    return
  }

  console.log(`Found ${questions?.length || 0} system design questions\n`)

  let withAnswerKey = 0
  let withoutAnswerKey = 0

  for (const q of questions || []) {
    const metadata = q.metadata as { reference_solutions?: { solutions?: unknown[], synthesized_answer_key?: string } } | null
    const solutions = metadata?.reference_solutions?.solutions
    const answerKey = metadata?.reference_solutions?.synthesized_answer_key
    const hasSolutions = solutions && solutions.length > 0
    const hasAnswerKey = !!answerKey

    if (hasAnswerKey) withAnswerKey++
    else withoutAnswerKey++

    console.log(`- ${q.title}`)
    console.log(`  Has answer key: ${hasAnswerKey ? '✅ YES' : '❌ NO'}`)
    if (hasSolutions) {
      console.log(`  Sources: ${(solutions as Array<{ source_label?: string }>).map(s => s.source_label).join(', ')}`)
    }
    if (hasAnswerKey) {
      console.log(`  Preview: ${answerKey.substring(0, 100)}...`)
    }
    console.log()
  }

  console.log('=====================================')
  console.log(`Summary:`)
  console.log(`  ✅ With answer key: ${withAnswerKey}`)
  console.log(`  ❌ Without answer key: ${withoutAnswerKey}`)
}

checkReferenceSolutions()
