/**
 * SystemDesign.io Scraper
 *
 * This script scrapes all system design questions from systemdesign.io
 * and stores them in the database.
 *
 * Usage:
 *   npx tsx scripts/scrape-systemdesign.ts              # Scrape all questions
 *   npx tsx scripts/scrape-systemdesign.ts --test       # Test with first question only
 *   npx tsx scripts/scrape-systemdesign.ts --dry-run    # Don't save to database
 *   npx tsx scripts/scrape-systemdesign.ts --limit=10   # Scrape only first 10 questions
 *   npx tsx scripts/scrape-systemdesign.ts --headed     # Run browser in visible mode
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SYSTEMDESIGN_BASE_URL = 'https://systemdesign.io';

// Parse command line arguments
const args = process.argv.slice(2);
const isTest = args.includes('--test');
const isDryRun = args.includes('--dry-run');
const isHeaded = args.includes('--headed');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : (isTest ? 1 : undefined);

// Question info extracted from the main page
interface QuestionInfo {
  title: string;
  url: string;
  difficulty: string;
  companies: string[];
}

// Full extracted question data
interface ExtractedQuestion {
  title: string;
  slug: string;
  description: string;
  difficulty: string;
  source: string;
  source_url: string;
  companies: string[];
  key_considerations: string[];
  solution_links: Array<{ label: string; url: string }>;
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabase;
}

// Cache for System Design topic ID
let systemDesignTopicId: string | null = null;

async function getSystemDesignTopicId(): Promise<string | null> {
  if (systemDesignTopicId !== null) {
    return systemDesignTopicId;
  }

  try {
    const { data, error } = await getSupabase()
      .from('topics')
      .select('id')
      .eq('slug', 'system-design')
      .single();

    if (error || !data) {
      console.warn('System Design topic not found in database');
      return null;
    }

    systemDesignTopicId = data.id;
    return data.id;
  } catch (e) {
    console.warn('Error fetching System Design topic:', e);
    return null;
  }
}

// Map complexity to our difficulty levels
function mapDifficulty(complexity: string): string {
  const normalized = complexity.toLowerCase().trim();
  if (normalized === 'easy') return 'easy';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'hard' || normalized === 'very hard') return 'hard';
  return 'medium';
}

/**
 * Extract all question URLs from the main page
 */
async function extractQuestionUrls(page: Page): Promise<QuestionInfo[]> {
  console.log('Phase 1: Extracting question URLs from main page...');

  await page.goto(SYSTEMDESIGN_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Wait for the table to load
  try {
    await page.waitForSelector('table', { timeout: 10000 });
  } catch {
    console.log('Warning: Table may not be fully loaded');
  }

  // Extract all questions from the table
  const questions = await page.evaluate(() => {
    const results: Array<{
      title: string;
      url: string;
      difficulty: string;
      companies: string[];
    }> = [];

    // Find all table rows
    const rows = document.querySelectorAll('table tbody tr');

    rows.forEach(row => {
      // Find the question link
      const link = row.querySelector('a[href*="/question/"]');
      if (!link) return;

      const href = link.getAttribute('href');
      // Get just the first text node, not children
      let title = '';
      link.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          title += node.textContent?.trim() || '';
        }
      });
      // Fallback to full text content if no text nodes
      if (!title) {
        title = link.textContent?.trim() || '';
      }
      // Clean up title - remove "Solutions available" suffix
      title = title.replace(/Solutions available$/i, '').trim();

      if (!href || !title) return;

      // Find difficulty and companies from row cells
      const cells = row.querySelectorAll('td');
      let difficulty = 'medium';
      const companies: string[] = [];

      cells.forEach((cell, index) => {
        const text = cell.textContent?.trim() || '';

        // Last cell usually contains difficulty
        if (text === 'Easy' || text === 'Medium' || text === 'Hard' || text === 'Very Hard') {
          difficulty = text;
          return;
        }

        // Companies cell - look for multiple company-like spans/badges
        // This is typically the second-to-last cell
        const badges = cell.querySelectorAll('span');
        if (badges.length > 0) {
          badges.forEach(badge => {
            const badgeText = badge.textContent?.trim();
            if (badgeText &&
                !['Easy', 'Medium', 'Hard', 'Very Hard'].includes(badgeText) &&
                !badgeText.startsWith('+') &&
                badgeText.length > 1 &&
                !badgeText.includes('Solutions')) {
              companies.push(badgeText);
            }
          });
        }
      });

      results.push({
        title,
        url: href,
        difficulty,
        companies
      });
    });

    return results;
  });

  console.log(`Found ${questions.length} questions`);
  return questions;
}

/**
 * Extract full question content from a question page
 */
async function extractQuestionContent(page: Page, info: QuestionInfo): Promise<ExtractedQuestion | null> {
  const fullUrl = info.url.startsWith('http') ? info.url : `${SYSTEMDESIGN_BASE_URL}${info.url}`;
  console.log(`  Scraping: ${info.title}`);

  try {
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract content
    const content = await page.evaluate(() => {
      const result = {
        key_considerations: [] as string[],
        solution_links: [] as Array<{ label: string; url: string }>
      };

      const main = document.querySelector('main') || document.body;
      const text = main.innerText;

      // Find "Here are some details you should know about this question:" section
      const detailsMatch = text.match(/Here are some details you should know about this question:([\s\S]*?)(?:← Back to Main Table|$)/i);
      if (detailsMatch) {
        const detailsText = detailsMatch[1];
        const lines = detailsText.split('\n')
          .map(l => l.trim())
          .filter(l => l && l.endsWith('?'));
        result.key_considerations = lines;
      }

      // Find solution links
      const links = main.querySelectorAll('a[href*="http"]');
      links.forEach(link => {
        const href = link.getAttribute('href');
        const label = link.textContent?.trim();

        // Skip internal links and navigation
        if (!href || !label) return;
        if (href.includes('systemdesign.io')) return;
        if (label === 'Sign up here') return;
        if (label.length < 5) return;

        // Find the label (e.g., "Good overview:", "Good solution:", etc.)
        const parent = link.parentElement;
        let fullLabel = label;
        if (parent) {
          const parentText = parent.textContent?.trim() || '';
          if (parentText.includes(':')) {
            const labelMatch = parentText.match(/^([^:]+):/);
            if (labelMatch) {
              fullLabel = labelMatch[1].trim();
            }
          }
        }

        result.solution_links.push({
          label: fullLabel,
          url: href
        });
      });

      return result;
    });

    // Extract slug from URL
    const slugMatch = info.url.match(/\/question\/([^/]+)/);
    const slug = slugMatch ? slugMatch[1] : info.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Create a description from the title and key considerations
    let description = info.title;
    if (content.key_considerations.length > 0) {
      description += '\n\nKey considerations:\n' + content.key_considerations.map(c => `• ${c}`).join('\n');
    }

    return {
      title: info.title,
      slug: `sd-${slug}`, // Prefix with 'sd-' to avoid conflicts with coding questions
      description,
      difficulty: mapDifficulty(info.difficulty),
      source: 'systemdesign.io',
      source_url: fullUrl,
      companies: info.companies,
      key_considerations: content.key_considerations,
      solution_links: content.solution_links
    };
  } catch (error) {
    console.error(`    Error scraping ${info.title}:`, error);
    return null;
  }
}

async function saveToDatabase(question: ExtractedQuestion): Promise<boolean> {
  try {
    const topicId = await getSystemDesignTopicId();

    const { error } = await getSupabase()
      .from('questions')
      .upsert({
        title: question.title,
        slug: question.slug,
        description: question.description,
        type: 'system_design',
        difficulty: question.difficulty,
        topic_id: topicId,
        source: question.source,
        source_url: question.source_url,
        examples: [], // System design questions don't have examples
        metadata: {
          companies: question.companies,
          key_considerations: question.key_considerations,
          solution_links: question.solution_links
        },
        hints: question.key_considerations // Use key considerations as hints
      }, {
        onConflict: 'slug'
      });

    if (error) {
      console.error(`    Error saving ${question.title}:`, error);
      return false;
    }

    console.log(`    Saved: ${question.title}`);
    return true;
  } catch (error) {
    console.error(`    Error saving ${question.title}:`, error);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('SystemDesign.io Scraper');
  console.log('========================================');
  console.log(`Mode: ${isTest ? 'TEST' : isDryRun ? 'DRY RUN' : 'FULL'}`);
  console.log(`Browser: ${isHeaded ? 'Visible' : 'Headless'}`);
  if (limit) console.log(`Limit: ${limit} questions`);
  console.log();

  // Check for required environment variables (unless dry run)
  if (!isDryRun) {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
      console.error('Set these in packages/server/.env or use --dry-run mode');
      process.exit(1);
    }
  }

  // Launch browser
  console.log('Launching browser...\n');
  const browser: Browser = await puppeteer.launch({
    headless: !isHeaded,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    // Phase 1: Extract question URLs
    let questions = await extractQuestionUrls(page);

    // Apply limit
    if (limit) {
      questions = questions.slice(0, limit);
      console.log(`\nLimited to ${questions.length} questions`);
    }

    // Phase 2: Scrape each question
    console.log('\n========================================');
    console.log('Phase 2: Scraping question content...');
    console.log('========================================\n');

    let successCount = 0;
    let failCount = 0;
    const results: ExtractedQuestion[] = [];
    let currentPage = page;

    for (let i = 0; i < questions.length; i++) {
      const info = questions[i];
      console.log(`[${i + 1}/${questions.length}] ${info.title} (${info.difficulty})`);

      try {
        const questionData = await extractQuestionContent(currentPage, info);

        if (questionData) {
          results.push(questionData);

          if (isDryRun) {
            console.log(`    [DRY RUN] Would save: ${questionData.title}`);
            console.log(`    - Difficulty: ${questionData.difficulty}`);
            console.log(`    - Companies: ${questionData.companies.join(', ') || 'N/A'}`);
            console.log(`    - Key considerations: ${questionData.key_considerations.length}`);
            console.log(`    - Solution links: ${questionData.solution_links.length}`);
            successCount++;
          } else {
            const saved = await saveToDatabase(questionData);
            if (saved) {
              successCount++;
            } else {
              failCount++;
            }
          }
        } else {
          failCount++;
        }
      } catch (e: any) {
        // Handle detached frame error by creating a new page
        if (e.message?.includes('detached Frame') || e.message?.includes('Target closed')) {
          console.log('    Browser page became stale, creating new page...');
          try {
            await currentPage.close().catch(() => {});
          } catch {}
          currentPage = await browser.newPage();
          await currentPage.setViewport({ width: 1280, height: 800 });
          await currentPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

          // Retry with new page
          console.log('    Retrying...');
          const questionData = await extractQuestionContent(currentPage, info);
          if (questionData) {
            results.push(questionData);
            if (isDryRun) {
              console.log(`    [DRY RUN] Would save: ${questionData.title}`);
              successCount++;
            } else {
              const saved = await saveToDatabase(questionData);
              if (saved) successCount++;
              else failCount++;
            }
          } else {
            failCount++;
          }
        } else {
          console.error(`    Error: ${e.message}`);
          failCount++;
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n========================================');
    console.log('Scraping complete!');
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log('========================================');

    // In test mode, print first result
    if (isTest && results.length > 0) {
      console.log('\n--- Test Result ---');
      console.log(JSON.stringify(results[0], null, 2));
    }

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
