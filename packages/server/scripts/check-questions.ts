import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
)

async function main() {
  // Get all coding questions
  const { data } = await supabase.from('questions').select('*').eq('type', 'coding')

  const withTestCases: string[] = []
  const withoutTestCases: string[] = []

  for (const q of data || []) {
    const hasVisible = q.metadata?.visible_test_cases?.length > 0
    const hasHidden = q.metadata?.hidden_test_cases?.length > 0

    if (hasVisible && hasHidden) {
      withTestCases.push(q.title)
    } else {
      withoutTestCases.push(q.title)
    }
  }

  console.log(`Total: ${data?.length}`)
  console.log(`With test cases: ${withTestCases.length}`)
  console.log(`Without test cases: ${withoutTestCases.length}`)
  console.log('')
  console.log('Questions needing test cases:')
  withoutTestCases.forEach(t => console.log(`  - ${t}`))

  // Show a sample question without test cases
  console.log('\n=== Sample question without test cases ===')
  const sample = (data || []).find((q: any) =>
    !q.metadata?.visible_test_cases?.length || !q.metadata?.hidden_test_cases?.length
  )
  if (sample) {
    console.log('Title:', sample.title)
    console.log('Examples:', JSON.stringify(sample.examples, null, 2))
    console.log('Constraints:', sample.metadata?.constraints)
  }
}
main()
