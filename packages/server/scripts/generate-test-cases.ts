/**
 * Script to generate test cases for questions that don't have them.
 * Uses Claude Opus 4.5 to analyze the question and generate comprehensive test cases.
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
  category?: string // For documentation purposes
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

interface GeneratedTestCases {
  visible_test_cases: TestCase[]
  hidden_test_cases: TestCase[]
}

const SYSTEM_PROMPT = `You are an expert algorithm engineer and test case designer. Your job is to create comprehensive test cases for LeetCode-style coding problems.

Given a coding problem, you must generate test cases that thoroughly verify:
1. **Correctness** - The solution produces the right output
2. **Edge cases** - Boundary conditions and special inputs
3. **Time complexity** - Large inputs to verify O(n), O(n log n), etc.
4. **Space complexity** - Inputs that stress memory usage

## TEST CASE CATEGORIES

### Visible Test Cases (3-5 cases)
These help users understand the problem. Include:
- Basic example that matches the problem description
- Simple edge case (e.g., empty input, single element)
- Moderate complexity case

### Hidden Test Cases (8-12 cases)
These thoroughly test the solution. MUST include:

**Category 1: Edge Cases**
- Empty input (empty array, empty string, n=0)
- Single element
- Two elements
- All same values
- Null/None handling if applicable

**Category 2: Boundary Values**
- Minimum values from constraints (e.g., n=1, values=-10^9)
- Maximum values from constraints (e.g., n=10^5, values=10^9)
- Values at constraint boundaries

**Category 3: Special Cases**
- Already sorted input (if sorting involved)
- Reverse sorted input
- Duplicates
- Negative numbers (if applicable)
- All positive / all negative

**Category 4: Performance/Stress Tests**
- Large input to test time complexity:
  - For O(n): array of 10,000-50,000 elements
  - For O(n log n): array of 50,000-100,000 elements
  - For O(n^2) acceptable: array of 1,000-5,000 elements
- Worst case input for the algorithm
- Input that would cause timeout if using brute force

**Category 5: Algorithm-Specific**
- Cases that test the core algorithm insight
- Cases where greedy fails but optimal works
- Cases that require the full algorithm, not shortcuts

## OUTPUT FORMAT

Return a JSON object with this EXACT structure:
{
  "visible_test_cases": [
    { "input": "input as string", "expected_output": "output as string", "category": "basic" }
  ],
  "hidden_test_cases": [
    { "input": "input as string", "expected_output": "output as string", "category": "edge_case" },
    { "input": "[large array...]", "expected_output": "output", "category": "performance" }
  ]
}

## INPUT/OUTPUT FORMAT RULES
- For multiple parameters, separate with newlines: "[1,2,3]\\n5" (array and target)
- Arrays: "[1, 2, 3]" or "[[1,2],[3,4]]" for 2D
- Strings: Include quotes if the function expects a string parameter
- Numbers: Just the number, e.g., "42"
- Boolean output: "true" or "false"
- Match the exact format expected by the function signature

## CRITICAL RULES
- Return ONLY valid JSON, no markdown or explanatory text
- Use double quotes for strings
- Escape special characters properly (\\n, \\", \\\\)
- No trailing commas
- For performance tests, generate realistic large inputs (not placeholders)
- Calculate the correct expected output for ALL test cases`

async function generateTestCasesForQuestion(question: Question): Promise<GeneratedTestCases | null> {
  if (question.type === 'system_design') {
    console.log(`  Skipping system design question: ${question.title}`)
    return null
  }

  const metadata = question.metadata || {}
  const constraints = metadata.constraints || []
  const starterCode = metadata.starter_code?.python || ''

  // Analyze constraints to determine appropriate test sizes
  let maxArraySize = 1000 // default
  let maxValue = 10000 // default

  for (const constraint of constraints) {
    // Try to extract array size constraints like "1 <= n <= 10^5" or "n <= 10000"
    const sizeMatch = constraint.match(/n\s*<=?\s*(\d+(?:\^\d+)?)/i) ||
                      constraint.match(/length\s*<=?\s*(\d+(?:\^\d+)?)/i) ||
                      constraint.match(/(\d+(?:\^\d+)?)\s*elements?/i)
    if (sizeMatch) {
      const sizeStr = sizeMatch[1]
      if (sizeStr.includes('^')) {
        const [base, exp] = sizeStr.split('^').map(Number)
        maxArraySize = Math.pow(base, exp)
      } else {
        maxArraySize = parseInt(sizeStr, 10)
      }
    }

    // Try to extract value constraints
    const valueMatch = constraint.match(/(?:nums|val|value).*?<=?\s*(\d+(?:\^\d+)?)/i) ||
                       constraint.match(/(-?\d+(?:\^\d+)?)\s*<=?\s*.*?<=?\s*(\d+(?:\^\d+)?)/i)
    if (valueMatch) {
      const valStr = valueMatch[valueMatch.length - 1]
      if (valStr.includes('^')) {
        const [base, exp] = valStr.split('^').map(Number)
        maxValue = Math.pow(base, exp)
      } else {
        maxValue = parseInt(valStr, 10)
      }
    }
  }

  // Recommend appropriate performance test sizes
  const recommendedPerfSize = Math.min(maxArraySize, 10000) // Cap at 10k for reasonable test execution
  const recommendedLargePerfSize = Math.min(maxArraySize, 50000)

  const userPrompt = `Generate comprehensive test cases for this coding problem:

## PROBLEM DETAILS

**Title:** ${question.title}
**Difficulty:** ${question.difficulty}

**Description:**
${question.description}

**Examples:**
${question.examples?.map((ex, i) => `Example ${i + 1}:
  Input: ${ex.input}
  Output: ${ex.output}
  ${ex.explanation ? `Explanation: ${ex.explanation}` : ''}`).join('\n\n') || 'No examples provided'}

**Constraints:**
${constraints.length > 0 ? constraints.join('\n') : 'No constraints provided'}

**Starter Code (Python):**
\`\`\`python
${starterCode || 'No starter code provided'}
\`\`\`

## REQUIREMENTS

Based on the constraints, generate:
- 3-5 visible test cases (simple, help users understand)
- 8-12 hidden test cases including:
  - At least 2 edge cases (empty, single element, etc.)
  - At least 2 boundary value tests
  - At least 2 performance tests with arrays of size ${recommendedPerfSize}-${recommendedLargePerfSize}
  - Algorithm-specific test cases

For performance tests:
- Generate actual arrays with ${recommendedPerfSize}+ elements
- Values should be within range [-${maxValue}, ${maxValue}]
- Calculate the correct expected output

Make sure every test case has a correct expected_output that you have verified.`

  const MAX_RETRIES = 3

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  Using Llama 3.3 70B via Groq... (attempt ${attempt}/${MAX_RETRIES})`)
      const result = await llm.generateJSON<GeneratedTestCases>(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        {
          model: 'llama-3.3-70b-versatile',  // Llama 3.3 70B via Groq (free)
          temperature: 0.2,
          maxTokens: 8000  // Groq has generous limits
        }
      )

      // Validate the response
      if (!result.visible_test_cases?.length || !result.hidden_test_cases?.length) {
        console.error(`  Invalid test case structure for ${question.title}`)
        if (attempt < MAX_RETRIES) {
          console.log(`  Retrying...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue
        }
        return null
      }

      // Log category breakdown
      const categories: Record<string, number> = {}
      for (const tc of result.hidden_test_cases) {
        const cat = tc.category || 'uncategorized'
        categories[cat] = (categories[cat] || 0) + 1
      }
      console.log(`  Categories:`, Object.entries(categories).map(([k, v]) => `${k}(${v})`).join(', '))

      return result
    } catch (error) {
      console.error(`  Error generating test cases for ${question.title} (attempt ${attempt}):`, error instanceof Error ? error.message : error)
      if (attempt < MAX_RETRIES) {
        console.log(`  Retrying in 3 seconds...`)
        await new Promise(resolve => setTimeout(resolve, 3000))
      } else {
        return null
      }
    }
  }

  return null
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined
  const idArg = args.find((a) => a.startsWith('--id='))
  const specificId = idArg ? idArg.split('=')[1] : undefined

  console.log('=== Test Case Generator (Llama 3.3 70B via Groq) ===')
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  if (limit) console.log(`Limit: ${limit}`)
  if (specificId) console.log(`Specific ID: ${specificId}`)
  console.log('')

  // Check for Groq API key
  if (!process.env.GROQ_API_KEY) {
    console.error('ERROR: GROQ_API_KEY is not set')
    console.error('Please set GROQ_API_KEY in your .env file to use Llama 3.3 70B')
    process.exit(1)
  }

  // Build query
  let query = supabase
    .from('questions')
    .select('*')
    .eq('type', 'coding') // Only coding questions need test cases

  if (specificId) {
    query = query.eq('id', specificId)
  }

  const { data: questions, error } = await query

  if (error) {
    console.error('Error fetching questions:', error)
    process.exit(1)
  }

  // Filter questions that need test cases
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

    console.log(`  Generated ${testCases.visible_test_cases.length} visible, ${testCases.hidden_test_cases.length} hidden test cases`)

    // Check for performance test cases
    const hasPerformanceTests = testCases.hidden_test_cases.some(tc =>
      tc.category === 'performance' ||
      (tc.input && tc.input.length > 1000) // Large input
    )
    if (hasPerformanceTests) {
      console.log(`  Includes performance/stress tests`)
    }

    if (!dryRun) {
      // Update the question's metadata with test cases
      const updatedMetadata = {
        ...(question.metadata || {}),
        visible_test_cases: testCases.visible_test_cases,
        hidden_test_cases: testCases.hidden_test_cases,
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

      console.log(`  Saved to database`)
    } else {
      console.log(`  [DRY RUN] Would save to database`)
      console.log(`  Sample visible:`, JSON.stringify(testCases.visible_test_cases[0]).slice(0, 200))
      console.log(`  Sample hidden:`, JSON.stringify(testCases.hidden_test_cases[0]).slice(0, 200))
    }

    successCount++

    // Rate limiting - wait between requests (Opus is rate-limited)
    if (i < toProcess.length - 1) {
      console.log(`  Waiting 2s before next request...`)
      await new Promise((resolve) => setTimeout(resolve, 2000))
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
