/**
 * Script to import test cases from the LeetCodeDataset (newfacade)
 *
 * This script:
 * 1. Downloads the LeetCodeDataset JSONL files from Hugging Face
 * 2. Matches problems to our database questions by title/slug
 * 3. Parses the input_output field into our test case format
 * 4. Updates the questions in Supabase with the imported test cases
 *
 * Dataset: https://huggingface.co/datasets/newfacade/LeetCodeDataset
 * Contains 2,600+ problems with 100+ test cases each
 *
 * Usage:
 *   npx tsx scripts/import-leetcode-testcases.ts              # Import all matching test cases
 *   npx tsx scripts/import-leetcode-testcases.ts --dry-run    # Don't save to DB
 *   npx tsx scripts/import-leetcode-testcases.ts --limit=10   # Limit to 10 questions
 *   npx tsx scripts/import-leetcode-testcases.ts --download   # Just download dataset
 *   npx tsx scripts/import-leetcode-testcases.ts --show-sample # Show sample data structure
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Dataset URLs from Hugging Face
const DATASET_URLS = {
  train: 'https://huggingface.co/datasets/newfacade/LeetCodeDataset/resolve/main/LeetCodeDataset-train.jsonl',
  test: 'https://huggingface.co/datasets/newfacade/LeetCodeDataset/resolve/main/LeetCodeDataset-test.jsonl'
}

const CACHE_DIR = path.join(__dirname, '..', '.cache')
const TRAIN_FILE = path.join(CACHE_DIR, 'LeetCodeDataset-train.jsonl')
const TEST_FILE = path.join(CACHE_DIR, 'LeetCodeDataset-test.jsonl')

// Parse command line arguments
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const downloadOnly = args.includes('--download')
const showSample = args.includes('--show-sample')
const limitArg = args.find(a => a.startsWith('--limit='))
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

/**
 * Dataset row structure from LeetCodeDataset
 */
interface DatasetRow {
  task_id: string           // Problem slug (e.g., "two-sum")
  question_id: number       // LeetCode problem number
  difficulty: string        // Easy/Medium/Hard
  tags: string[]           // Topic tags
  problem_description: string
  starter_code: string
  prompt: string
  completion: string       // Solution code
  entry_point: string      // Function name
  test: string             // Test verification function
  input_output: string     // JSON string of test cases
  query: string
  response: string
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
  leetcode_number: number | null
  metadata: {
    constraints?: string[]
    visible_test_cases?: TestCase[]
    hidden_test_cases?: TestCase[]
    starter_code?: Record<string, string>
  } | null
}

/**
 * Download a file from URL
 */
async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`Downloading: ${url}`)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  fs.writeFileSync(dest, Buffer.from(buffer))

  const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2)
  console.log(`  Downloaded ${sizeMB} MB to ${path.basename(dest)}`)
}

/**
 * Download the dataset from Hugging Face
 */
async function downloadDataset(): Promise<void> {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }

  // Download train file if not cached
  if (!fs.existsSync(TRAIN_FILE)) {
    await downloadFile(DATASET_URLS.train, TRAIN_FILE)
  } else {
    console.log('Train file already cached')
  }

  // Download test file if not cached
  if (!fs.existsSync(TEST_FILE)) {
    await downloadFile(DATASET_URLS.test, TEST_FILE)
  } else {
    console.log('Test file already cached')
  }
}

/**
 * Load dataset from JSONL files (streaming to handle large files)
 */
async function loadDataset(): Promise<DatasetRow[]> {
  const rows: DatasetRow[] = []

  for (const file of [TRAIN_FILE, TEST_FILE]) {
    if (!fs.existsSync(file)) continue

    const fileStream = fs.createReadStream(file)
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    })

    for await (const line of rl) {
      if (line.trim()) {
        try {
          rows.push(JSON.parse(line))
        } catch (e) {
          // Skip malformed lines
        }
      }
    }
  }

  return rows
}

/**
 * Normalize title for matching
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Convert task_id (slug) to normalized form for matching
 */
function normalizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/-/g, '')
    .replace(/_/g, '')
}

/**
 * Parse the input_output field from the dataset
 *
 * The input_output field is a list of objects:
 * [
 *   {"input": "nums = [3,3], target = 6", "output": "[0, 1]"},
 *   {"input": "nums = [-1,-2,-3,-4], target = -8", "output": "None"},
 *   ...
 * ]
 *
 * We need to convert the input string format (Python-style assignments)
 * to our format (JSON values separated by newlines)
 */
function parseInputOutput(inputOutput: unknown): TestCase[] {
  const testCases: TestCase[] = []

  // Handle if it's already parsed as an array
  const data = Array.isArray(inputOutput) ? inputOutput : []

  for (const item of data) {
    if (!item || typeof item !== 'object') continue

    const inputStr = (item as any).input
    const outputStr = (item as any).output

    if (!inputStr || outputStr === undefined) continue

    // Parse the Python-style input string
    // Format: "nums = [3,3], target = 6" or "s = \"abc\""
    const parsedInput = parsePythonInput(inputStr)

    testCases.push({
      input: parsedInput,
      expected_output: outputStr
    })
  }

  return testCases
}

/**
 * Parse Python-style input string into our format
 *
 * Input: "nums = [3,3], target = 6"
 * Output: "[3,3]\n6"
 *
 * Input: "s = \"abc\", t = \"bac\""
 * Output: "\"abc\"\n\"bac\""
 */
function parsePythonInput(inputStr: string): string {
  const values: string[] = []

  // Try to extract variable assignments
  // Pattern: varname = value (where value can be [...], "...", number, etc.)

  // Regex to match assignments: handles arrays, strings, numbers, etc.
  // We need to be careful with nested structures and quoted strings

  let remaining = inputStr.trim()
  const assignmentPattern = /^\s*(\w+)\s*=\s*/

  while (remaining) {
    const match = remaining.match(assignmentPattern)
    if (!match) break

    remaining = remaining.slice(match[0].length)

    // Now extract the value - could be:
    // - Array: [...]
    // - String: "..." or '...'
    // - Number: 123 or -123 or 123.45
    // - Boolean: True, False
    // - None
    // - Tuple: (...)

    let value = ''
    let endIndex = -1

    if (remaining.startsWith('[')) {
      // Array - find matching ]
      endIndex = findMatchingBracket(remaining, '[', ']')
      if (endIndex !== -1) {
        value = remaining.slice(0, endIndex + 1)
      }
    } else if (remaining.startsWith('(')) {
      // Tuple - find matching )
      endIndex = findMatchingBracket(remaining, '(', ')')
      if (endIndex !== -1) {
        value = remaining.slice(0, endIndex + 1)
      }
    } else if (remaining.startsWith('{')) {
      // Dict - find matching }
      endIndex = findMatchingBracket(remaining, '{', '}')
      if (endIndex !== -1) {
        value = remaining.slice(0, endIndex + 1)
      }
    } else if (remaining.startsWith('"')) {
      // Double-quoted string
      endIndex = findClosingQuote(remaining, '"')
      if (endIndex !== -1) {
        value = remaining.slice(0, endIndex + 1)
      }
    } else if (remaining.startsWith("'")) {
      // Single-quoted string
      endIndex = findClosingQuote(remaining, "'")
      if (endIndex !== -1) {
        value = remaining.slice(0, endIndex + 1)
      }
    } else {
      // Number, boolean, None, or other primitive
      const primitiveMatch = remaining.match(/^(-?\d+(?:\.\d+)?|True|False|None|null|true|false)/)
      if (primitiveMatch) {
        value = primitiveMatch[1]
        endIndex = value.length - 1
      }
    }

    if (value) {
      values.push(value)
      remaining = remaining.slice(endIndex + 1)

      // Skip comma and whitespace
      const commaMatch = remaining.match(/^\s*,\s*/)
      if (commaMatch) {
        remaining = remaining.slice(commaMatch[0].length)
      }
    } else {
      // Couldn't parse, give up
      break
    }
  }

  // Return values joined by newlines, or original if parsing failed
  return values.length > 0 ? values.join('\n') : inputStr
}

/**
 * Find the index of matching closing bracket
 */
function findMatchingBracket(str: string, open: string, close: string): number {
  let depth = 0
  let inString = false
  let stringChar = ''

  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    const prevChar = i > 0 ? str[i - 1] : ''

    // Handle string literals
    if (!inString && (char === '"' || char === "'")) {
      inString = true
      stringChar = char
    } else if (inString && char === stringChar && prevChar !== '\\') {
      inString = false
    }

    if (!inString) {
      if (char === open) depth++
      else if (char === close) depth--

      if (depth === 0) return i
    }
  }

  return -1
}

/**
 * Find the index of closing quote
 */
function findClosingQuote(str: string, quote: string): number {
  for (let i = 1; i < str.length; i++) {
    if (str[i] === quote && str[i - 1] !== '\\') {
      return i
    }
  }
  return -1
}

/**
 * Show a sample row from the dataset
 */
async function showSampleData(): Promise<void> {
  await downloadDataset()

  console.log('\nLoading dataset...')
  const dataset = await loadDataset()
  console.log(`Loaded ${dataset.length} problems\n`)

  if (dataset.length === 0) {
    console.log('No data found')
    return
  }

  // Show first row
  const sample = dataset[0]
  console.log('=== Sample Dataset Row ===')
  console.log(`task_id: ${sample.task_id}`)
  console.log(`question_id: ${sample.question_id}`)
  console.log(`difficulty: ${sample.difficulty}`)
  console.log(`tags: ${JSON.stringify(sample.tags)}`)
  console.log(`entry_point: ${sample.entry_point}`)
  console.log(`\nproblem_description (first 200 chars):`)
  console.log(sample.problem_description?.slice(0, 200) + '...')
  console.log(`\ninput_output (first 2 items):`)
  const ioSample = Array.isArray(sample.input_output) ? sample.input_output.slice(0, 2) : []
  console.log(JSON.stringify(ioSample, null, 2))

  // Parse and show test cases
  const testCases = parseInputOutput(sample.input_output)
  console.log(`\nParsed ${testCases.length} test cases`)
  if (testCases.length > 0) {
    console.log('First test case:')
    console.log(JSON.stringify(testCases[0], null, 2))
  }

  // Show stats about the dataset
  console.log('\n=== Dataset Statistics ===')
  const difficulties: Record<string, number> = {}
  for (const row of dataset) {
    difficulties[row.difficulty] = (difficulties[row.difficulty] || 0) + 1
  }
  console.log('By difficulty:', difficulties)

  // Count problems with test cases
  let withTestCases = 0
  let totalTestCases = 0
  for (const row of dataset) {
    const tc = parseInputOutput(row.input_output)
    if (tc.length > 0) {
      withTestCases++
      totalTestCases += tc.length
    }
  }
  console.log(`Problems with test cases: ${withTestCases}/${dataset.length}`)
  console.log(`Average test cases per problem: ${(totalTestCases / withTestCases).toFixed(1)}`)
}

async function main() {
  console.log('========================================')
  console.log('LeetCode Test Case Importer')
  console.log('========================================')
  console.log('Source: newfacade/LeetCodeDataset')
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : downloadOnly ? 'DOWNLOAD ONLY' : showSample ? 'SHOW SAMPLE' : 'IMPORT'}`)
  if (limit) console.log(`Limit: ${limit}`)
  console.log()

  // Show sample mode
  if (showSample) {
    await showSampleData()
    return
  }

  // Download dataset
  await downloadDataset()

  if (downloadOnly) {
    console.log('\nDownload complete. Use without --download to import.')
    return
  }

  // Check Supabase credentials for import mode
  if (!isDryRun) {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
      console.error('Use --dry-run to test without database')
      process.exit(1)
    }
  }

  const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null

  // Load dataset
  console.log('\nLoading dataset...')
  const dataset = await loadDataset()
  console.log(`Loaded ${dataset.length} problems from dataset`)

  // Create lookup maps
  const datasetBySlug = new Map<string, DatasetRow>()
  const datasetByTitle = new Map<string, DatasetRow>()
  const datasetByNumber = new Map<number, DatasetRow>()

  for (const row of dataset) {
    // By slug (task_id) - normalized without dashes
    const normalizedSlug = normalizeSlug(row.task_id)
    datasetBySlug.set(normalizedSlug, row)

    // By question number
    if (row.question_id) {
      datasetByNumber.set(row.question_id, row)
    }

    // Also map task_id as a title (since "two-sum" normalizes to "twosum" = "Two Sum")
    // This helps match when our DB has different slugs but same title
    datasetByTitle.set(normalizedSlug, row)

    // Try to extract title from problem_description header
    const titleMatch = row.problem_description?.match(/^#+\s*\d*\.?\s*(.+?)(?:\n|$)/m)
    if (titleMatch) {
      const title = titleMatch[1].trim()
      datasetByTitle.set(normalizeTitle(title), row)
    }
  }

  console.log(`Created lookup maps: ${datasetBySlug.size} by slug, ${datasetByNumber.size} by number, ${datasetByTitle.size} by title`)

  // Get questions from database
  console.log('\nFetching questions from database...')

  let questions: Question[] = []

  if (supabase) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('type', 'coding')

    if (error) {
      console.error('Error fetching questions:', error)
      process.exit(1)
    }

    questions = data || []
  } else {
    console.log('[DRY RUN] Skipping database fetch')
    // For dry run without DB, we'll just process the dataset
    questions = dataset.slice(0, limit || 10).map(row => ({
      id: `dry-run-${row.question_id}`,
      title: row.task_id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      slug: row.task_id,
      leetcode_number: row.question_id,
      metadata: null
    }))
  }

  console.log(`Found ${questions.length} coding questions in database`)

  // Match and import test cases
  let matchCount = 0
  let importCount = 0
  let failCount = 0
  const unmatched: string[] = []

  const toProcess = limit ? questions.slice(0, limit) : questions

  for (const question of toProcess) {
    // Try to match by different methods
    let datasetRow: DatasetRow | undefined

    // 1. Try by LeetCode number
    if (question.leetcode_number) {
      datasetRow = datasetByNumber.get(question.leetcode_number)
    }

    // 2. Try by slug
    if (!datasetRow && question.slug) {
      datasetRow = datasetBySlug.get(normalizeSlug(question.slug))
    }

    // 3. Try by title
    if (!datasetRow && question.title) {
      datasetRow = datasetByTitle.get(normalizeTitle(question.title))
    }

    if (!datasetRow) {
      unmatched.push(question.title)
      continue
    }

    matchCount++

    if (!datasetRow.input_output) {
      console.log(`[${matchCount}] ${question.title}: No input_output field`)
      continue
    }

    // Parse test cases
    const testCases = parseInputOutput(datasetRow.input_output)

    if (testCases.length === 0) {
      console.log(`[${matchCount}] ${question.title}: Could not parse test cases`)
      failCount++
      continue
    }

    // Split into visible (first 3) and hidden (rest, up to 20)
    const visibleTestCases = testCases.slice(0, 3)
    const hiddenTestCases = testCases.slice(3, 23) // Cap at 20 hidden to avoid huge data

    console.log(`[${matchCount}] ${question.title}: ${testCases.length} test cases (${visibleTestCases.length} visible, ${hiddenTestCases.length} hidden)`)

    if (isDryRun) {
      console.log(`  Sample: ${JSON.stringify(visibleTestCases[0]).slice(0, 100)}...`)
      importCount++
    } else if (supabase) {
      // Update database
      const updatedMetadata = {
        ...(question.metadata || {}),
        visible_test_cases: visibleTestCases,
        hidden_test_cases: hiddenTestCases
      }

      const { error: updateError } = await supabase
        .from('questions')
        .update({ metadata: updatedMetadata })
        .eq('id', question.id)

      if (updateError) {
        console.error(`  Error updating: ${updateError.message}`)
        failCount++
      } else {
        importCount++
      }
    }
  }

  // Summary
  console.log('\n========================================')
  console.log('Import Summary')
  console.log('========================================')
  console.log(`Questions processed: ${toProcess.length}`)
  console.log(`Matched in dataset: ${matchCount}`)
  console.log(`Successfully imported: ${importCount}`)
  console.log(`Failed to parse/import: ${failCount}`)
  console.log(`Unmatched: ${unmatched.length}`)

  if (unmatched.length > 0 && unmatched.length <= 30) {
    console.log('\nUnmatched questions:')
    unmatched.forEach(t => console.log(`  - ${t}`))
  } else if (unmatched.length > 30) {
    console.log(`\nFirst 30 unmatched questions:`)
    unmatched.slice(0, 30).forEach(t => console.log(`  - ${t}`))
    console.log(`  ... and ${unmatched.length - 30} more`)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
