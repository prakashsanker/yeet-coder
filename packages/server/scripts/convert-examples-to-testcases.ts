/**
 * Script to convert existing examples to test cases.
 * This is deterministic and doesn't require an LLM.
 *
 * Usage:
 *   npx tsx scripts/convert-examples-to-testcases.ts              # Process all
 *   npx tsx scripts/convert-examples-to-testcases.ts --dry-run    # Preview only
 *   npx tsx scripts/convert-examples-to-testcases.ts --limit=10   # Limit processing
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
)

interface Example {
  input: string
  output: string
  explanation?: string
}

interface TestCase {
  input: string
  expected_output: string
  category?: string
}

interface Question {
  id: string
  title: string
  slug: string
  examples: Example[]
  metadata: {
    constraints?: string[]
    visible_test_cases?: TestCase[]
    hidden_test_cases?: TestCase[]
    starter_code?: Record<string, string>
  } | null
}

/**
 * Parse example input like "nums = [1,2,3], target = 5" into "[1,2,3]\n5"
 */
function parseExampleInput(input: string): string {
  // Handle cases like "nums = [1,2,3], target = 5"
  // Extract the values after the = signs

  // Split by comma, but not commas inside brackets
  const parts: string[] = []
  let current = ''
  let bracketDepth = 0

  for (const char of input) {
    if (char === '[' || char === '{' || char === '(') {
      bracketDepth++
      current += char
    } else if (char === ']' || char === '}' || char === ')') {
      bracketDepth--
      current += char
    } else if (char === ',' && bracketDepth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) {
    parts.push(current.trim())
  }

  // Extract values from "name = value" patterns
  const values = parts.map(part => {
    const match = part.match(/^\s*\w+\s*=\s*(.+)$/)
    if (match) {
      return match[1].trim()
    }
    return part.trim()
  })

  return values.join('\n')
}

/**
 * Parse example output - usually just needs quote removal
 */
function parseExampleOutput(output: string): string {
  return output.trim()
}

/**
 * Convert examples to visible test cases
 */
function convertExamplesToTestCases(examples: Example[]): TestCase[] {
  return examples.map((ex, i) => ({
    input: parseExampleInput(ex.input),
    expected_output: parseExampleOutput(ex.output),
    category: i === 0 ? 'basic' : 'example'
  }))
}

/**
 * Generate basic hidden test cases from constraints
 * This handles common patterns deterministically
 */
function generateBasicHiddenTestCases(
  question: Question,
  visibleTestCases: TestCase[]
): TestCase[] {
  const hidden: TestCase[] = []
  const constraints = question.metadata?.constraints || []
  const firstVisible = visibleTestCases[0]

  if (!firstVisible) return hidden

  // Analyze the input format to understand the structure
  const inputLines = firstVisible.input.split('\n')

  // Try to detect if it's an array problem
  const isArrayProblem = inputLines.some(line => line.trim().startsWith('['))

  if (isArrayProblem) {
    // Find which line(s) are arrays
    const arrayLines = inputLines.map((line, i) => ({
      index: i,
      isArray: line.trim().startsWith('['),
      original: line
    }))

    // Generate edge cases for array problems
    // Single element
    const singleElementInput = inputLines.map((line, i) => {
      if (arrayLines[i]?.isArray) {
        return '[1]'
      }
      return line
    }).join('\n')

    hidden.push({
      input: singleElementInput,
      expected_output: 'TBD', // Will need manual verification or LLM
      category: 'edge_case_single'
    })

    // Two elements
    const twoElementInput = inputLines.map((line, i) => {
      if (arrayLines[i]?.isArray) {
        return '[1,2]'
      }
      return line
    }).join('\n')

    hidden.push({
      input: twoElementInput,
      expected_output: 'TBD',
      category: 'edge_case_two'
    })
  }

  return hidden
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined

  console.log('=== Example to Test Case Converter ===')
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  if (limit) console.log(`Limit: ${limit}`)
  console.log('')

  // Fetch all coding questions
  const { data: questions, error } = await supabase
    .from('questions')
    .select('*')
    .eq('type', 'coding')

  if (error) {
    console.error('Error fetching questions:', error)
    process.exit(1)
  }

  // Filter to questions needing test cases
  const needsTestCases = (questions as Question[]).filter(q => {
    const hasVisible = q.metadata?.visible_test_cases?.length
    const hasHidden = q.metadata?.hidden_test_cases?.length
    return !hasVisible || !hasHidden
  })

  console.log(`Total questions: ${questions.length}`)
  console.log(`Needing test cases: ${needsTestCases.length}`)
  console.log('')

  const toProcess = limit ? needsTestCases.slice(0, limit) : needsTestCases
  let successCount = 0
  let skipCount = 0

  for (const q of toProcess) {
    console.log(`Processing: ${q.title}`)

    if (!q.examples?.length) {
      console.log(`  Skipping - no examples available`)
      skipCount++
      continue
    }

    // Convert examples to visible test cases
    const visibleTestCases = convertExamplesToTestCases(q.examples)

    console.log(`  Converted ${q.examples.length} examples to visible test cases`)

    if (dryRun) {
      console.log('  Visible test cases:')
      visibleTestCases.forEach((tc, i) => {
        console.log(`    [${i}] input: ${tc.input.replace(/\n/g, '\\n')}`)
        console.log(`        output: ${tc.expected_output}`)
      })
    } else {
      // Update the question with test cases
      const newMetadata = {
        ...q.metadata,
        visible_test_cases: visibleTestCases
      }

      const { error: updateError } = await supabase
        .from('questions')
        .update({ metadata: newMetadata })
        .eq('id', q.id)

      if (updateError) {
        console.log(`  ERROR: ${updateError.message}`)
      } else {
        console.log('  Updated successfully')
        successCount++
      }
    }
  }

  console.log('')
  console.log('=== Summary ===')
  console.log(`Processed: ${toProcess.length}`)
  console.log(`Success: ${successCount}`)
  console.log(`Skipped: ${skipCount}`)
}

main()
