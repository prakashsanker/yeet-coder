/**
 * Solution Scraper for System Design Questions
 *
 * This script scrapes solution content from external resources linked on systemdesign.io
 * and stores them as reference solutions for AI grading.
 *
 * Usage:
 *   npx tsx scripts/scrape-solutions.ts              # Scrape all questions
 *   npx tsx scripts/scrape-solutions.ts --test       # Test with first question only
 *   npx tsx scripts/scrape-solutions.ts --dry-run    # Don't save to database
 *   npx tsx scripts/scrape-solutions.ts --slug=sd-design-twitter  # Scrape specific question
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '..', '.env') })

// Parse command line arguments
const args = process.argv.slice(2)
const isTest = args.includes('--test')
const isDryRun = args.includes('--dry-run')
const slugArg = args.find(a => a.startsWith('--slug='))
const targetSlug = slugArg ? slugArg.split('=')[1] : undefined

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

let supabase: ReturnType<typeof createClient> | null = null

function getSupabase() {
  if (!supabase) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
    }
    supabase = createClient(supabaseUrl, supabaseServiceKey)
  }
  return supabase
}

interface QuestionWithLinks {
  id: string
  slug: string
  title: string
  metadata: {
    solution_links?: Array<{ label: string; url: string }>
    reference_solutions?: {
      solutions: Array<{
        solution_text: string
        source_url: string
        source_label: string
        scraped_at: string
      }>
      last_updated: string
    }
  }
}

interface ScrapedSolution {
  solution_text: string
  source_url: string
  source_label: string
  scraped_at: string
}

interface ScrapedSolutionsCollection {
  solutions: ScrapedSolution[]
  last_updated: string
}

/**
 * Scrape content from a Substack article
 */
async function scrapeSubstack(page: Page, url: string): Promise<string | null> {
  try {
    console.log(`    Scraping Substack: ${url}`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise(resolve => setTimeout(resolve, 2000))

    const content = await page.evaluate(() => {
      // Substack articles have the main content in .body or article
      const article = document.querySelector('.body, article, .post-content, .available-content')
      if (!article) return null

      // Get all text content, preserving some structure
      const paragraphs: string[] = []
      const elements = article.querySelectorAll('p, h1, h2, h3, h4, li, pre, code')

      elements.forEach(el => {
        const text = el.textContent?.trim()
        if (text && text.length > 10) {
          const tagName = el.tagName.toLowerCase()
          if (tagName.startsWith('h')) {
            paragraphs.push(`\n## ${text}\n`)
          } else if (tagName === 'li') {
            paragraphs.push(`- ${text}`)
          } else if (tagName === 'pre' || tagName === 'code') {
            paragraphs.push(`\`\`\`\n${text}\n\`\`\``)
          } else {
            paragraphs.push(text)
          }
        }
      })

      return paragraphs.join('\n\n')
    })

    return content
  } catch (error) {
    console.error(`    Error scraping Substack: ${error}`)
    return null
  }
}

/**
 * Scrape content from a Dev.to article
 */
async function scrapeDevTo(page: Page, url: string): Promise<string | null> {
  try {
    console.log(`    Scraping Dev.to: ${url}`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise(resolve => setTimeout(resolve, 2000))

    const content = await page.evaluate(() => {
      const article = document.querySelector('#article-body, .crayons-article__body, article')
      if (!article) return null

      const paragraphs: string[] = []
      const elements = article.querySelectorAll('p, h1, h2, h3, h4, li, pre, code')

      elements.forEach(el => {
        const text = el.textContent?.trim()
        if (text && text.length > 10) {
          const tagName = el.tagName.toLowerCase()
          if (tagName.startsWith('h')) {
            paragraphs.push(`\n## ${text}\n`)
          } else if (tagName === 'li') {
            paragraphs.push(`- ${text}`)
          } else if (tagName === 'pre' || tagName === 'code') {
            paragraphs.push(`\`\`\`\n${text}\n\`\`\``)
          } else {
            paragraphs.push(text)
          }
        }
      })

      return paragraphs.join('\n\n')
    })

    return content
  } catch (error) {
    console.error(`    Error scraping Dev.to: ${error}`)
    return null
  }
}

/**
 * Scrape content from a Medium article
 */
async function scrapeMedium(page: Page, url: string): Promise<string | null> {
  try {
    console.log(`    Scraping Medium: ${url}`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise(resolve => setTimeout(resolve, 3000))

    const content = await page.evaluate(() => {
      const article = document.querySelector('article')
      if (!article) return null

      const paragraphs: string[] = []
      const elements = article.querySelectorAll('p, h1, h2, h3, h4, li, pre, code')

      elements.forEach(el => {
        const text = el.textContent?.trim()
        if (text && text.length > 10) {
          const tagName = el.tagName.toLowerCase()
          if (tagName.startsWith('h')) {
            paragraphs.push(`\n## ${text}\n`)
          } else if (tagName === 'li') {
            paragraphs.push(`- ${text}`)
          } else if (tagName === 'pre' || tagName === 'code') {
            paragraphs.push(`\`\`\`\n${text}\n\`\`\``)
          } else {
            paragraphs.push(text)
          }
        }
      })

      return paragraphs.join('\n\n')
    })

    return content
  } catch (error) {
    console.error(`    Error scraping Medium: ${error}`)
    return null
  }
}

/**
 * Scrape content from a generic article page
 */
async function scrapeGeneric(page: Page, url: string): Promise<string | null> {
  try {
    console.log(`    Scraping generic page: ${url}`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise(resolve => setTimeout(resolve, 2000))

    const content = await page.evaluate(() => {
      // Try common content selectors
      const selectors = [
        'article',
        '.post-content',
        '.article-content',
        '.content',
        'main',
        '.entry-content'
      ]

      let article: Element | null = null
      for (const selector of selectors) {
        article = document.querySelector(selector)
        if (article) break
      }

      if (!article) {
        article = document.body
      }

      const paragraphs: string[] = []
      const elements = article.querySelectorAll('p, h1, h2, h3, h4, li, pre, code')

      elements.forEach(el => {
        const text = el.textContent?.trim()
        if (text && text.length > 20) {
          const tagName = el.tagName.toLowerCase()
          if (tagName.startsWith('h')) {
            paragraphs.push(`\n## ${text}\n`)
          } else if (tagName === 'li') {
            paragraphs.push(`- ${text}`)
          } else if (tagName === 'pre' || tagName === 'code') {
            paragraphs.push(`\`\`\`\n${text}\n\`\`\``)
          } else {
            paragraphs.push(text)
          }
        }
      })

      return paragraphs.join('\n\n')
    })

    return content
  } catch (error) {
    console.error(`    Error scraping generic page: ${error}`)
    return null
  }
}

/**
 * Determine the scraper to use based on URL
 */
function getScraperForUrl(url: string): (page: Page, url: string) => Promise<string | null> {
  if (url.includes('substack.com')) return scrapeSubstack
  if (url.includes('dev.to')) return scrapeDevTo
  if (url.includes('medium.com')) return scrapeMedium
  return scrapeGeneric
}

/**
 * Get label for URL source
 */
function getLabelForUrl(url: string): string {
  if (url.includes('substack.com')) return 'Substack'
  if (url.includes('dev.to')) return 'Dev.to'
  if (url.includes('medium.com')) return 'Medium'
  if (url.includes('youtube.com')) return 'YouTube'
  if (url.includes('github.com')) return 'GitHub'
  return 'External Article'
}

/**
 * Scrape ALL text-based solutions for a single question
 */
async function scrapeSolutionsForQuestion(
  page: Page,
  question: QuestionWithLinks
): Promise<ScrapedSolutionsCollection | null> {
  const solutionLinks = question.metadata?.solution_links || []

  if (solutionLinks.length === 0) {
    console.log(`  No solution links for: ${question.title}`)
    return null
  }

  // Skip YouTube links (can't scrape video content)
  const scrapableLinks = solutionLinks.filter(
    link => !link.url.includes('youtube.com') && !link.url.includes('youtu.be')
  )

  if (scrapableLinks.length === 0) {
    console.log(`  Only YouTube links available for: ${question.title}`)
    return null
  }

  console.log(`  Found ${scrapableLinks.length} text-based links to scrape`)

  // Scrape ALL text-based links
  const scrapedSolutions: ScrapedSolution[] = []

  for (const link of scrapableLinks) {
    const scraper = getScraperForUrl(link.url)
    const content = await scraper(page, link.url)

    if (content && content.length > 500) {
      scrapedSolutions.push({
        solution_text: content,
        source_url: link.url,
        source_label: link.label || getLabelForUrl(link.url),
        scraped_at: new Date().toISOString()
      })
      console.log(`    ✓ Scraped: ${link.label || getLabelForUrl(link.url)} (${content.length} chars)`)
    } else {
      console.log(`    ✗ Failed or too short: ${link.label || getLabelForUrl(link.url)}`)
    }

    // Rate limiting between requests
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  if (scrapedSolutions.length === 0) {
    console.log(`  Could not scrape any content for: ${question.title}`)
    return null
  }

  return {
    solutions: scrapedSolutions,
    last_updated: new Date().toISOString()
  }
}

/**
 * Save solutions collection to database
 */
async function saveSolutions(questionId: string, solutions: ScrapedSolutionsCollection): Promise<boolean> {
  try {
    // Get current metadata
    const { data: question, error: fetchError } = await getSupabase()
      .from('questions')
      .select('metadata')
      .eq('id', questionId)
      .single()

    if (fetchError || !question) {
      console.error(`    Error fetching question: ${fetchError}`)
      return false
    }

    // Update metadata with reference solutions
    const updatedMetadata = {
      ...question.metadata,
      reference_solutions: solutions
    }

    const { error: updateError } = await getSupabase()
      .from('questions')
      .update({ metadata: updatedMetadata })
      .eq('id', questionId)

    if (updateError) {
      console.error(`    Error updating question: ${updateError}`)
      return false
    }

    return true
  } catch (error) {
    console.error(`    Error saving solutions: ${error}`)
    return false
  }
}

async function main() {
  console.log('========================================')
  console.log('System Design Solution Scraper')
  console.log('========================================')
  console.log(`Mode: ${isTest ? 'TEST' : isDryRun ? 'DRY RUN' : 'FULL'}`)
  if (targetSlug) console.log(`Target: ${targetSlug}`)
  console.log()

  // Check for required environment variables (unless dry run)
  if (!isDryRun) {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
      process.exit(1)
    }
  }

  // Fetch questions with solution links
  console.log('Fetching questions from database...')
  let query = getSupabase()
    .from('questions')
    .select('id, slug, title, metadata')
    .eq('type', 'system_design')

  if (targetSlug) {
    query = query.eq('slug', targetSlug)
  }

  const { data: questions, error } = await query

  if (error || !questions) {
    console.error('Error fetching questions:', error)
    process.exit(1)
  }

  console.log(`Found ${questions.length} system design questions`)

  // Filter to questions that have solution links
  const questionsWithLinks = questions.filter(
    q => q.metadata?.solution_links?.length > 0
  ) as QuestionWithLinks[]

  console.log(`${questionsWithLinks.length} questions have solution links`)

  if (isTest) {
    questionsWithLinks.splice(1) // Keep only first question
    console.log('Test mode: processing only first question')
  }

  // Launch browser
  console.log('\nLaunching browser...\n')
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
  let skipCount = 0

  try {
    for (let i = 0; i < questionsWithLinks.length; i++) {
      const question = questionsWithLinks[i]
      console.log(`[${i + 1}/${questionsWithLinks.length}] ${question.title}`)

      // Skip if already has reference solutions
      if (question.metadata?.reference_solutions?.solutions?.length > 0) {
        console.log(`  Already has ${question.metadata.reference_solutions.solutions.length} reference solution(s), skipping`)
        skipCount++
        continue
      }

      const solutions = await scrapeSolutionsForQuestion(page, question)

      if (solutions && solutions.solutions.length > 0) {
        const totalChars = solutions.solutions.reduce((sum, s) => sum + s.solution_text.length, 0)
        if (isDryRun) {
          console.log(`  [DRY RUN] Would save ${solutions.solutions.length} solution(s) (${totalChars} total chars)`)
          solutions.solutions.forEach(s => {
            console.log(`    - ${s.source_label}: ${s.solution_text.length} chars`)
          })
          successCount++
        } else {
          const saved = await saveSolutions(question.id, solutions)
          if (saved) {
            console.log(`  Saved ${solutions.solutions.length} solution(s) (${totalChars} total chars)`)
            successCount++
          } else {
            failCount++
          }
        }
      } else {
        failCount++
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
  } finally {
    await browser.close()
  }

  console.log('\n========================================')
  console.log('Scraping complete!')
  console.log(`Success: ${successCount}`)
  console.log(`Failed: ${failCount}`)
  console.log(`Skipped: ${skipCount}`)
  console.log('========================================')
}

main().catch(console.error)
