/**
 * Solution Scraper for System Design Questions
 *
 * This script:
 * 1. Fetches system design questions from our database
 * 2. Scrapes solutions from systemdesignschool.io and other solution_links
 * 3. Uses an LLM to synthesize a comprehensive answer key
 * 4. Stores the reference solution in the database
 *
 * Usage:
 *   npx tsx packages/server/scripts/scrape-solutions.ts              # Process all questions
 *   npx tsx packages/server/scripts/scrape-solutions.ts --dry-run    # Preview without saving
 *   npx tsx packages/server/scripts/scrape-solutions.ts --test       # Test with first question
 *   npx tsx packages/server/scripts/scrape-solutions.ts --force      # Re-process even if already has answer key
 *   npx tsx packages/server/scripts/scrape-solutions.ts --question "Twitter"  # Process specific question
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '..', '.env') })

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: OPENROUTER_API_KEY,
})

// Mapping from our database question titles to systemdesignschool.io problem slugs
const SYSTEM_DESIGN_SCHOOL_MAPPING: Record<string, string> = {
  'Design a URL Shortening service like TinyURL': 'url-shortener',
  'Design an API Rate Limiter': 'rate-limiter',
  'Design Pastebin': 'pastebin',
  'Design Google Calendar': 'google-calendar',
  'Design Yelp or Nearby Friends': 'yelp',
  'Identify the K Most Shared Articles in Various Time Windows (24 hours, 1 hour, 5 minutes)': 'topk',
  'Top K Elements: App Store Rankings, Amazon Bestsellers, etc.': 'topk',
  'System to Collect Performance Metrics from Thousands of Servers': 'realtime-monitoring-system',
  'Design a Distributed Metrics Logging and Aggregation System': 'realtime-monitoring-system',
  'Design Typeahead Suggestion/Autocomplete': 'typeahead',
  'Design a Live Comments Feature for Facebook': 'comment-system',
  'Design Twitter for millions of users': 'twitter',
  'Design Facebook Messenger or WhatsApp': 'chatapp',
  'Design Dropbox or Google Drive': 'dropbox',
  'Design Youtube or Netflix': 'youtube',
  'Design Web Crawler': 'web-crawler',
}

// ============================================================================
// Types
// ============================================================================

interface Question {
  id: string
  title: string
  slug: string
  metadata: {
    solution_links?: Array<{ url: string; label: string }>
    key_considerations?: string[]
    reference_solutions?: {
      solutions: ScrapedSolution[]
      synthesized_answer_key: string
      generated_at: string
    }
  }
}

interface ScrapedSolution {
  source_url: string
  source_label: string
  solution_text: string
  scraped_at: string
}

// ============================================================================
// Scraping Functions
// ============================================================================

async function scrapeSystemDesignSchool(page: Page, slug: string): Promise<ScrapedSolution | null> {
  const url = `https://systemdesignschool.io/problems/${slug}/solution`
  console.log(`    📥 SystemDesignSchool: ${slug}`)

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise(resolve => setTimeout(resolve, 2000))

    const content = await page.evaluate(() => {
      const paragraphs: string[] = []

      // Try to get main content
      const selectors = ['article', 'main', '.prose', '[class*="content"]', '.post-content']
      let mainContent: Element | null = null

      for (const selector of selectors) {
        mainContent = document.querySelector(selector)
        if (mainContent) break
      }

      if (!mainContent) mainContent = document.body

      // Extract structured content
      const elements = mainContent.querySelectorAll('h1, h2, h3, h4, p, li, pre, code, blockquote')
      elements.forEach(el => {
        const text = el.textContent?.trim()
        if (text && text.length > 15) {
          const tagName = el.tagName.toLowerCase()
          if (tagName === 'h1') paragraphs.push(`\n# ${text}\n`)
          else if (tagName === 'h2') paragraphs.push(`\n## ${text}\n`)
          else if (tagName === 'h3') paragraphs.push(`\n### ${text}\n`)
          else if (tagName === 'h4') paragraphs.push(`\n#### ${text}\n`)
          else if (tagName === 'li') paragraphs.push(`- ${text}`)
          else if (tagName === 'pre' || tagName === 'code') paragraphs.push(`\`\`\`\n${text}\n\`\`\``)
          else if (tagName === 'blockquote') paragraphs.push(`> ${text}`)
          else paragraphs.push(text)
        }
      })

      return paragraphs.join('\n\n')
    })

    if (!content || content.length < 500) {
      console.log(`    ⚠️  Content too short (${content?.length || 0} chars)`)
      return null
    }

    return {
      source_url: url,
      source_label: 'SystemDesignSchool',
      solution_text: content.substring(0, 50000),
      scraped_at: new Date().toISOString(),
    }
  } catch (error) {
    console.log(`    ⚠️  Error: ${error}`)
    return null
  }
}

async function scrapeHelloInterview(page: Page, url: string): Promise<ScrapedSolution | null> {
  console.log(`    📥 HelloInterview: ${url}`)

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise(resolve => setTimeout(resolve, 3000))

    const content = await page.evaluate(() => {
      const paragraphs: string[] = []
      const article = document.querySelector('article, main, .prose, [class*="content"]') || document.body

      const elements = article.querySelectorAll('h1, h2, h3, h4, p, li, pre, code')
      elements.forEach(el => {
        const text = el.textContent?.trim()
        if (text && text.length > 15) {
          const tagName = el.tagName.toLowerCase()
          if (tagName.startsWith('h')) paragraphs.push(`\n## ${text}\n`)
          else if (tagName === 'li') paragraphs.push(`- ${text}`)
          else if (tagName === 'pre' || tagName === 'code') paragraphs.push(`\`\`\`\n${text}\n\`\`\``)
          else paragraphs.push(text)
        }
      })

      return paragraphs.join('\n\n')
    })

    if (!content || content.length < 500) {
      console.log(`    ⚠️  Content too short`)
      return null
    }

    return {
      source_url: url,
      source_label: 'HelloInterview',
      solution_text: content.substring(0, 40000),
      scraped_at: new Date().toISOString(),
    }
  } catch (error) {
    console.log(`    ⚠️  Error: ${error}`)
    return null
  }
}

async function scrapeMedium(page: Page, url: string): Promise<ScrapedSolution | null> {
  console.log(`    📥 Medium: ${url}`)

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise(resolve => setTimeout(resolve, 3000))

    const content = await page.evaluate(() => {
      const article = document.querySelector('article')
      if (!article) return null

      const paragraphs: string[] = []
      const elements = article.querySelectorAll('h1, h2, h3, h4, p, li, pre, code')

      elements.forEach(el => {
        const text = el.textContent?.trim()
        if (text && text.length > 15) {
          const tagName = el.tagName.toLowerCase()
          if (tagName.startsWith('h')) paragraphs.push(`\n## ${text}\n`)
          else if (tagName === 'li') paragraphs.push(`- ${text}`)
          else if (tagName === 'pre' || tagName === 'code') paragraphs.push(`\`\`\`\n${text}\n\`\`\``)
          else paragraphs.push(text)
        }
      })

      return paragraphs.join('\n\n')
    })

    if (!content || content.length < 500) {
      console.log(`    ⚠️  Content too short or paywalled`)
      return null
    }

    return {
      source_url: url,
      source_label: 'Medium',
      solution_text: content.substring(0, 30000),
      scraped_at: new Date().toISOString(),
    }
  } catch (error) {
    console.log(`    ⚠️  Error: ${error}`)
    return null
  }
}

async function scrapeGeneric(page: Page, url: string, label: string): Promise<ScrapedSolution | null> {
  console.log(`    📥 ${label}: ${url}`)

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise(resolve => setTimeout(resolve, 2000))

    const content = await page.evaluate(() => {
      // Remove noise
      document.querySelectorAll('script, style, nav, footer, header, aside, .sidebar, .comments, .ads').forEach(el => el.remove())

      const selectors = ['article', 'main', '.post-content', '.article-content', '.content', '.prose', '[role="main"]', '.entry-content']
      let mainContent: Element | null = null

      for (const selector of selectors) {
        mainContent = document.querySelector(selector)
        if (mainContent) break
      }

      if (!mainContent) mainContent = document.body

      const paragraphs: string[] = []
      const elements = mainContent.querySelectorAll('h1, h2, h3, h4, p, li, pre, code')

      elements.forEach(el => {
        const text = el.textContent?.trim()
        if (text && text.length > 20) {
          const tagName = el.tagName.toLowerCase()
          if (tagName.startsWith('h')) paragraphs.push(`\n## ${text}\n`)
          else if (tagName === 'li') paragraphs.push(`- ${text}`)
          else if (tagName === 'pre' || tagName === 'code') paragraphs.push(`\`\`\`\n${text}\n\`\`\``)
          else paragraphs.push(text)
        }
      })

      return paragraphs.join('\n\n')
    })

    if (!content || content.length < 300) {
      console.log(`    ⚠️  Content too short (${content?.length || 0} chars)`)
      return null
    }

    return {
      source_url: url,
      source_label: label,
      solution_text: content.substring(0, 30000),
      scraped_at: new Date().toISOString(),
    }
  } catch (error) {
    console.log(`    ⚠️  Error: ${error}`)
    return null
  }
}

async function scrapeUrl(page: Page, url: string, label: string): Promise<ScrapedSolution | null> {
  // Skip video URLs
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    console.log(`    ⏭️  Skipping video: ${url}`)
    return null
  }

  // Route to appropriate scraper
  if (url.includes('hellointerview.com')) return scrapeHelloInterview(page, url)
  if (url.includes('medium.com')) return scrapeMedium(page, url)
  return scrapeGeneric(page, url, label)
}

// ============================================================================
// LLM Synthesis
// ============================================================================

async function synthesizeSolutions(
  questionTitle: string,
  keyConsiderations: string[],
  scrapedSolutions: ScrapedSolution[]
): Promise<string> {
  console.log(`  🤖 Synthesizing answer key from ${scrapedSolutions.length} sources...`)

  const sourcesText = scrapedSolutions
    .map((s, i) => `\n--- SOURCE ${i + 1}: ${s.source_label} ---\n${s.solution_text.substring(0, 12000)}`)
    .join('\n\n')

  const prompt = `You are an expert system design interviewer at a FAANG company. Create a comprehensive ANSWER KEY for evaluating candidates on this system design question.

## Question: ${questionTitle}

## Key Considerations to Address:
${keyConsiderations.length > 0 ? keyConsiderations.map(c => `- ${c}`).join('\n') : '(None specified)'}

## Reference Solutions from various sources:
${sourcesText}

---

Create a comprehensive, well-structured answer key that synthesizes insights from all sources. Format:

# Answer Key: ${questionTitle}

## 1. Requirements Clarification
**Functional Requirements:**
- [List what the system must do]

**Non-Functional Requirements:**
- [Scalability, availability, latency, etc.]

**Capacity Estimation:**
- [Key numbers: users, requests/second, storage]

## 2. High-Level Design
- Core components and their responsibilities
- Data flow between components
- Key architectural decisions

## 3. Data Model
- Key entities and their attributes
- Database choice and rationale
- Indexing strategy

## 4. API Design
- Key endpoints with request/response formats
- Authentication/authorization considerations

## 5. Deep Dive Topics
For each topic, explain:
- What it is
- Why it matters
- How to implement it
- Trade-offs

Topics to cover:
- [Based on the question, e.g., sharding, caching, message queues, etc.]

## 6. Scalability & Performance
- Horizontal scaling strategies
- Caching layers
- Database optimization
- CDN usage (if applicable)

## 7. Reliability & Fault Tolerance
- Replication strategies
- Failover mechanisms
- Data backup and recovery

## 8. Common Mistakes to Avoid
- [List typical gaps in weak answers]

## 9. Evaluation Criteria
**Strong Answer (Would Hire):**
- [What excellent coverage looks like]

**Adequate Answer (Lean Hire):**
- [Minimum acceptable coverage]

**Weak Answer (No Hire):**
- [Signs of insufficient preparation]

Be specific and technical. Include concrete examples, numbers for capacity planning, and specific technology choices where appropriate.`

  // Try different models in order of preference (cost vs quality tradeoff)
  const models = [
    'anthropic/claude-sonnet-4',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o-mini',
    'google/gemini-flash-1.5',
  ]

  for (const model of models) {
    try {
      console.log(`    Trying model: ${model}`)
      const response = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 6000,
        temperature: 0.3,
      })

      const content = response.choices[0]?.message?.content
      if (content && content.length > 500) {
        console.log(`    ✅ Success with ${model}`)
        return content
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      // If it's a credit/billing error, try next model
      if (errorMessage.includes('402') || errorMessage.includes('credits') || errorMessage.includes('billing')) {
        console.log(`    ⚠️  ${model}: insufficient credits, trying next...`)
        continue
      }
      console.log(`    ⚠️  ${model} error: ${errorMessage}`)
    }
  }

  console.log(`  ❌ All models failed`)
  return ''
}

// ============================================================================
// Main Processing
// ============================================================================

async function processQuestion(
  page: Page,
  question: Question,
  dryRun: boolean
): Promise<boolean> {
  console.log(`\n📋 Processing: ${question.title}`)

  const scrapedSolutions: ScrapedSolution[] = []

  // 1. Try SystemDesignSchool if we have a mapping
  const sdsSlug = SYSTEM_DESIGN_SCHOOL_MAPPING[question.title]
  if (sdsSlug) {
    const solution = await scrapeSystemDesignSchool(page, sdsSlug)
    if (solution) {
      scrapedSolutions.push(solution)
      console.log(`    ✅ SystemDesignSchool: ${solution.solution_text.length} chars`)
    }
    await sleep(1000)
  }

  // 2. Scrape from solution_links in metadata
  const solutionLinks = question.metadata?.solution_links || []
  for (const link of solutionLinks.slice(0, 4)) { // Limit to top 4 links
    // Skip if we already have this source
    if (scrapedSolutions.some(s => s.source_url === link.url)) continue

    const solution = await scrapeUrl(page, link.url, link.label)
    if (solution) {
      scrapedSolutions.push(solution)
      console.log(`    ✅ ${link.label}: ${solution.solution_text.length} chars`)
    }

    await sleep(1000)
  }

  if (scrapedSolutions.length === 0) {
    console.log(`  ❌ No solutions scraped`)
    return false
  }

  console.log(`  📊 Scraped ${scrapedSolutions.length} solutions total`)

  // 3. Synthesize using LLM
  const keyConsiderations = question.metadata?.key_considerations || []
  const synthesizedAnswerKey = await synthesizeSolutions(
    question.title,
    keyConsiderations,
    scrapedSolutions
  )

  if (!synthesizedAnswerKey || synthesizedAnswerKey.length < 500) {
    console.log(`  ❌ Failed to synthesize answer key`)
    return false
  }

  console.log(`  ✅ Synthesized answer key: ${synthesizedAnswerKey.length} chars`)

  // 4. Update database
  if (dryRun) {
    console.log(`  🔍 DRY RUN - Would update database`)
    console.log(`     Preview: ${synthesizedAnswerKey.substring(0, 300)}...`)
    return true
  }

  const updatedMetadata = {
    ...question.metadata,
    reference_solutions: {
      solutions: scrapedSolutions.map(s => ({
        source_url: s.source_url,
        source_label: s.source_label,
        solution_text: s.solution_text,
        scraped_at: s.scraped_at,
      })),
      synthesized_answer_key: synthesizedAnswerKey,
      generated_at: new Date().toISOString(),
    },
  }

  const { error } = await supabase
    .from('questions')
    .update({ metadata: updatedMetadata })
    .eq('id', question.id)

  if (error) {
    console.log(`  ❌ Database error: ${error.message}`)
    return false
  }

  console.log(`  ✅ Saved to database`)
  return true
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const testMode = args.includes('--test')
  const force = args.includes('--force')
  const questionArg = args.find((_, i) => args[i - 1] === '--question')

  console.log('🚀 Solution Scraper + LLM Synthesizer')
  console.log('=====================================')
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : testMode ? 'TEST' : 'LIVE'}`)
  if (force) console.log(`   Force: Re-processing all questions`)
  if (questionArg) console.log(`   Filter: "${questionArg}"`)
  console.log('')

  // Validate environment
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
    process.exit(1)
  }
  if (!OPENROUTER_API_KEY) {
    console.error('❌ Missing OPENROUTER_API_KEY')
    process.exit(1)
  }

  // Fetch questions
  let query = supabase
    .from('questions')
    .select('id, title, slug, metadata')
    .eq('type', 'system_design')

  if (questionArg) {
    query = query.ilike('title', `%${questionArg}%`)
  }

  const { data: questions, error } = await query

  if (error) {
    console.error('❌ Failed to fetch questions:', error)
    process.exit(1)
  }

  console.log(`📊 Found ${questions?.length || 0} system design questions`)

  // Filter out questions that already have reference solutions
  let questionsToProcess = (questions || []).filter(q => {
    const hasExisting = q.metadata?.reference_solutions?.synthesized_answer_key
    if (hasExisting && !force) {
      console.log(`   ⏭️  Skipping "${q.title}" (already has answer key)`)
      return false
    }
    return true
  }) as Question[]

  if (testMode) {
    questionsToProcess = questionsToProcess.slice(0, 1)
    console.log(`   Test mode: processing only first question`)
  }

  console.log(`   Processing ${questionsToProcess.length} questions\n`)

  if (questionsToProcess.length === 0) {
    console.log('Nothing to process!')
    return
  }

  // Launch browser
  console.log('🌐 Launching browser...\n')
  const browser: Browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')

  let successCount = 0
  let failCount = 0

  try {
    for (const question of questionsToProcess) {
      const success = await processQuestion(page, question, dryRun)
      if (success) successCount++
      else failCount++

      // Rate limiting between questions
      await sleep(2000)
    }
  } finally {
    await browser.close()
  }

  console.log(`\n=====================================`)
  console.log(`📊 Summary:`)
  console.log(`   ✅ Success: ${successCount}`)
  console.log(`   ❌ Failed: ${failCount}`)
  console.log(`=====================================`)
}

main().catch(console.error)
