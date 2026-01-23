/**
 * Script to generate test cases for questions that don't have them.
 * Uses incremental batch generation to avoid response truncation.
 *
 * Usage:
 *   npx tsx scripts/generate-test-cases.ts              # Process all questions without test cases
 *   npx tsx scripts/generate-test-cases.ts --limit=10   # Limit to 10 questions
 *   npx tsx scripts/generate-test-cases.ts --dry-run    # Don't save to DB
 *   npx tsx scripts/generate-test-cases.ts --id=<uuid>  # Generate for specific question
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { llm } from '../src/services/llm'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface TestCase {
  input: string
  expected_output: string
  category?: string
}

interface Question {
  id: string
  title: string
  slug: string
  description: string
  type: 'coding' | 'system_design'
  difficulty: 'easy' | 'medium' | 'hard'
  examples: { input: string; output: string; explanation?: string }[]
  metadata: {
    constraints?: string[]
    visible_test_cases?: TestCase[]
    hidden_test_cases?: TestCase[]
    starter_code?: Record<string, string>
  } | null
}

interface BatchTestCases {
  test_cases: TestCase[]
}

// Simplified prompt for batch generation
const BATCH_SYSTEM_PROMPT = `You are a test case generator for coding problems. Generate exactly the requested number of test cases.

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "test_cases": [
    { "input": "input string", "expected_output": "output string", "category": "category_name" }
  ]
}

CRITICAL RULES:
- Return ONLY valid JSON, no markdown or extra text
- For multiple parameters, separate with newlines: "[1,2,3]\\n5"
- Arrays must be LITERAL values like "[1, 2, 3, 4, 5]" - NEVER use code expressions or list comprehensions
- NEVER write code like "[" + ... or range() or any programming constructs
- For large arrays, write out actual numbers: "[1, 2, 3, 4, ..., 100]" with real values
- Escape special characters: \\n, \\"
- Calculate correct expected_output for ALL test cases
- No trailing commas
- Keep arrays reasonable size (100-500 elements max for performance tests)`

type TestCaseType = 'visible_basic' | 'edge_case' | 'boundary' | 'special' | 'performance'

const TEST_CASE_BATCHES: { type: TestCaseType; count: number; description: string }[] = [
  { type: 'visible_basic', count: 3, description: 'basic visible test cases that help users understand the problem' },
  { type: 'edge_case', count: 3, description: 'edge cases: empty input, single element, two elements, all same values' },
  { type: 'boundary', count: 2, description: 'boundary value tests using min/max from constraints' },
  { type: 'special', count: 2, description: 'special cases: sorted input, reverse sorted, duplicates, negatives' },
  { type: 'performance', count: 2, description: 'performance tests with arrays of 30-50 elements (write out actual literal values, NO code expressions). Keep expected_output short - if numbers would be huge, use smaller input values like [1,1,1,2,2,2...]' },
]

async function generateBatch(
  question: Question,
  batchType: TestCaseType,
  count: number,
  description: string,
  existingTestCases: TestCase[]
): Promise<TestCase[]> {
  const metadata = question.metadata || {}
  const constraints = metadata.constraints || []
  const starterCode = metadata.starter_code?.python || ''

  const existingInputs = existingTestCases.map(tc => tc.input).join('\n- ')
  const existingSection = existingTestCases.length > 0
    ? `\n\nALREADY GENERATED (DO NOT DUPLICATE):\n- ${existingInputs}`
    : ''

  const userPrompt = `Generate exactly ${count} ${description} for this problem:

**Title:** ${question.title}
**Difficulty:** ${question.difficulty}

**Description:**
${question.description}

**Examples:**
${question.examples?.map((ex, i) => `${i + 1}. Input: ${ex.input} → Output: ${ex.output}`).join('\n') || 'None'}

**Constraints:**
${constraints.join('\n') || 'None'}

**Starter Code:**
${starterCode || 'None'}
${existingSection}

Generate exactly ${count} NEW test cases with category "${batchType}". Make sure expected_output is correct.`

  const MAX_RETRIES = 3
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await llm.generateJSON<BatchTestCases>(
        [
          { role: 'system', content: BATCH_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        {
          model: 'anthropic/claude-opus-4',
          temperature: 0.2,
          maxTokens: 2048
        }
      )

      if (!result.test_cases?.length) {
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }
        return []
      }

      // Add category to each test case
      return result.test_cases.map(tc => ({ ...tc, category: batchType }))
    } catch (error) {
      console.error(`    Batch ${batchType} attempt ${attempt} failed:`, error instanceof Error ? error.message : error)
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }
  return []
}

async function generateTestCasesForQuestion(question: Question): Promise<{ visible: TestCase[]; hidden: TestCase[] } | null> {
  if (question.type === 'system_design') {
    console.log(`  Skipping system design question: ${question.title}`)
    return null
  }

  const allTestCases: TestCase[] = []
  const visibleTestCases: TestCase[] = []
  const hiddenTestCases: TestCase[] = []

  for (const batch of TEST_CASE_BATCHES) {
    console.log(`    Generating ${batch.count} ${batch.type} test cases...`)

    const newCases = await generateBatch(
      question,
      batch.type,
      batch.count,
      batch.description,
      allTestCases
    )

    if (newCases.length === 0) {
      console.log(`    Warning: No test cases generated for ${batch.type}`)
      continue
    }

    console.log(`    ✓ Got ${newCases.length} test cases`)

    // First batch goes to visible, rest to hidden
    if (batch.type === 'visible_basic') {
      visibleTestCases.push(...newCases)
    } else {
      hiddenTestCases.push(...newCases)
    }

    allTestCases.push(...newCases)

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  if (visibleTestCases.length === 0 || hiddenTestCases.length === 0) {
    console.log(`  Failed to generate sufficient test cases`)
    return null
  }

  return { visible: visibleTestCases, hidden: hiddenTestCases }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined
  const idArg = args.find((a) => a.startsWith('--id='))
  const specificId = idArg ? idArg.split('=')[1] : undefined

  console.log('=== Test Case Generator (Batch Mode) ===')
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  if (limit) console.log(`Limit: ${limit}`)
  if (specificId) console.log(`Specific ID: ${specificId}`)
  console.log('')

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('ERROR: OPENROUTER_API_KEY is not set')
    process.exit(1)
  }

  let query = supabase
    .from('questions')
    .select('*')
    .eq('type', 'coding')

  if (specificId) {
    query = query.eq('id', specificId)
  }

  const { data: questions, error } = await query

  if (error) {
    console.error('Error fetching questions:', error)
    process.exit(1)
  }

  const questionsNeedingTestCases = questions.filter((q: Question) => {
    const metadata = q.metadata || {}
    const hasVisible = metadata.visible_test_cases && metadata.visible_test_cases.length > 0
    const hasHidden = metadata.hidden_test_cases && metadata.hidden_test_cases.length > 0
    return !hasVisible || !hasHidden
  })

  console.log(`Found ${questions.length} coding questions`)
  console.log(`Questions needing test cases: ${questionsNeedingTestCases.length}`)
  console.log('')

  const toProcess = limit ? questionsNeedingTestCases.slice(0, limit) : questionsNeedingTestCases

  let successCount = 0
  let failCount = 0

  for (let i = 0; i < toProcess.length; i++) {
    const question = toProcess[i] as Question
    console.log(`[${i + 1}/${toProcess.length}] Processing: ${question.title} (${question.difficulty})`)

    const testCases = await generateTestCasesForQuestion(question)

    if (!testCases) {
      failCount++
      continue
    }

    console.log(`  Total: ${testCases.visible.length} visible, ${testCases.hidden.length} hidden`)

    if (!dryRun) {
      const updatedMetadata = {
        ...(question.metadata || {}),
        visible_test_cases: testCases.visible,
        hidden_test_cases: testCases.hidden,
      }

      const { error: updateError } = await supabase
        .from('questions')
        .update({ metadata: updatedMetadata })
        .eq('id', question.id)

      if (updateError) {
        console.error(`  Error updating question:`, updateError)
        failCount++
        continue
      }

      console.log(`  ✓ Saved to database`)
    } else {
      console.log(`  [DRY RUN] Would save`)
    }

    successCount++

    // Delay between questions
    if (i < toProcess.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  console.log('')
  console.log('=== Summary ===')
  console.log(`Processed: ${toProcess.length}`)
  console.log(`Success: ${successCount}`)
  console.log(`Failed: ${failCount}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
