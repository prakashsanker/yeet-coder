/**
 * NeetCode 150 Scraper
 *
 * This script scrapes all NeetCode 150 problems and stores them in the database.
 * It uses a two-phase approach:
 * 1. First extracts all problem URLs from the practice page
 * 2. Then visits each problem page to scrape full content
 *
 * Usage:
 *   npx tsx scripts/scrape-neetcode.ts              # Scrape all problems
 *   npx tsx scripts/scrape-neetcode.ts --test       # Test with first problem only
 *   npx tsx scripts/scrape-neetcode.ts --dry-run    # Don't save to database
 *   npx tsx scripts/scrape-neetcode.ts --limit=10   # Scrape only first 10 problems
 *   npx tsx scripts/scrape-neetcode.ts --headed     # Run browser in visible mode
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

const NEETCODE_PRACTICE_URL = 'https://neetcode.io/practice/practice/neetcode150';
const NEETCODE_BASE_URL = 'https://neetcode.io';

// Parse command line arguments
const args = process.argv.slice(2);
const isTest = args.includes('--test');
const isDryRun = args.includes('--dry-run');
const isHeaded = args.includes('--headed');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : (isTest ? 1 : undefined);

// Problem info extracted from the practice page
interface ProblemInfo {
  title: string;
  url: string;
  topic: string;
  difficulty: string;
  leetcodeUrl?: string;
}

// Full extracted problem data
interface ExtractedProblem {
  title: string;
  slug: string;
  description: string;
  difficulty: string;
  topic: string;
  source: string;
  source_url: string;
  leetcode_number: number | null;
  examples: Array<{ input: string; output: string; explanation?: string }>;
  metadata: {
    constraints: string[];
    visible_test_cases: Array<{ input: string; expected_output: string }>;
    hidden_test_cases: Array<{ input: string; expected_output: string }>;
    starter_code: Record<string, string>;
  };
  hints: string[];
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

// Map NeetCode pattern names to our topic slugs
const topicMapping: Record<string, string> = {
  'Arrays & Hashing': 'arrays-hashing',
  'Two Pointers': 'two-pointers',
  'Stack': 'stack',
  'Sliding Window': 'sliding-window',
  'Binary Search': 'binary-search',
  'Linked List': 'linked-list',
  'Trees': 'trees',
  'Tries': 'tries',
  'Backtracking': 'backtracking',
  'Heap / Priority Queue': 'heap-priority-queue',
  'Heap': 'heap-priority-queue',
  'Graphs': 'graphs',
  'Advanced Graphs': 'graphs',
  'Intervals': 'intervals',
  'Greedy': 'greedy',
  '1-D DP': 'dp-1d',
  '1-D Dynamic Programming': 'dp-1d',
  '2-D DP': 'dp-2d',
  '2-D Dynamic Programming': 'dp-2d',
  'Bit Manipulation': 'bit-manipulation',
  'Math & Geometry': 'math-geometry'
};

// Cache for topic IDs
const topicIdCache: Record<string, string | null> = {};

async function getTopicId(topicName: string): Promise<string | null> {
  if (topicName in topicIdCache) {
    return topicIdCache[topicName];
  }

  const slug = topicMapping[topicName];
  if (!slug) {
    console.warn(`Unknown topic: ${topicName}`);
    topicIdCache[topicName] = null;
    return null;
  }

  try {
    const { data, error } = await getSupabase()
      .from('topics')
      .select('id')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      console.warn(`Topic not found in database: ${slug}`);
      topicIdCache[topicName] = null;
      return null;
    }

    topicIdCache[topicName] = data.id;
    return data.id;
  } catch (e) {
    console.warn(`Error fetching topic: ${topicName}`, e);
    topicIdCache[topicName] = null;
    return null;
  }
}

/**
 * Phase 1: Extract all problem URLs from the practice page
 */
async function extractProblemUrls(page: Page): Promise<ProblemInfo[]> {
  console.log('Phase 1: Extracting problem URLs from practice page...');

  await page.goto(NEETCODE_PRACTICE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Find all topic buttons - they contain topic names from our mapping
  const topicNames = Object.keys(topicMapping);

  // Get all buttons on the page
  const allButtons = await page.$$('button');
  console.log(`Found ${allButtons.length} buttons total`);

  // Filter to only topic buttons
  const topicButtons: { button: any; topic: string }[] = [];
  for (const button of allButtons) {
    const text = await button.evaluate(el => el.textContent?.trim() || '');
    for (const topic of topicNames) {
      if (text.includes(topic)) {
        topicButtons.push({ button, topic });
        break;
      }
    }
  }

  console.log(`Found ${topicButtons.length} topic sections`);

  const allProblems: ProblemInfo[] = [];
  const seenUrls = new Set<string>();

  // Click on each topic to expand it and extract problems
  for (const { button, topic: topicName } of topicButtons) {
    try {
      // Click to expand
      await button.click();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Extract problems from the expanded section
      const problems = await page.evaluate((topic, alreadySeen) => {
        const results: Array<{
          title: string;
          url: string;
          topic: string;
          difficulty: string;
          leetcodeUrl?: string;
        }> = [];

        // Find all problem links in the table
        const links = document.querySelectorAll('a[href*="/problems/"]');

        links.forEach(link => {
          const href = link.getAttribute('href');
          const title = link.textContent?.trim();

          // Skip if already seen
          if (href && alreadySeen.includes(href)) {
            return;
          }

          if (href && title && href.includes('/question')) {
            // Find difficulty - look for Easy/Medium/Hard in nearby elements
            const row = link.closest('tr') || link.parentElement?.parentElement?.parentElement;
            let difficulty = 'medium';

            if (row) {
              const rowText = row.textContent || '';
              if (rowText.includes('Easy')) difficulty = 'easy';
              else if (rowText.includes('Hard')) difficulty = 'hard';
              else if (rowText.includes('Medium')) difficulty = 'medium';
            }

            // Find LeetCode URL
            const leetcodeLink = row?.querySelector('a[href*="leetcode.com"]');
            const leetcodeUrl = leetcodeLink?.getAttribute('href') || undefined;

            results.push({
              title,
              url: href,
              topic,
              difficulty,
              leetcodeUrl
            });
          }
        });

        return results;
      }, topicName, Array.from(seenUrls));

      // Add new problems and track their URLs
      for (const problem of problems) {
        if (!seenUrls.has(problem.url)) {
          seenUrls.add(problem.url);
          allProblems.push(problem);
        }
      }

      console.log(`  ${topicName}: ${problems.length} problems`);

      // Click again to collapse (to keep the page clean)
      await button.click();
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (e) {
      console.error(`Error processing topic ${topicName}:`, e);
    }
  }

  // Deduplicate by URL
  const uniqueProblems = Array.from(
    new Map(allProblems.map(p => [p.url, p])).values()
  );

  console.log(`\nTotal unique problems found: ${uniqueProblems.length}`);
  return uniqueProblems;
}

/**
 * Phase 2: Extract full problem content from a problem page
 */
async function extractProblemContent(page: Page, info: ProblemInfo): Promise<ExtractedProblem | null> {
  const fullUrl = `${NEETCODE_BASE_URL}${info.url}`;
  console.log(`  Scraping: ${info.title}`);

  try {
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Wait for content to load
    try {
      await page.waitForFunction(
        () => document.body.innerText.includes('Example') || document.body.innerText.includes('Input'),
        { timeout: 10000 }
      );
    } catch {
      console.log(`    Warning: Content may not be fully loaded`);
    }

    // Extract problem content
    const content = await page.evaluate(() => {
      const result = {
        description: '',
        examples: [] as Array<{ input: string; output: string; explanation?: string }>,
        constraints: [] as string[],
        hints: [] as string[]
      };

      // Get all text from the problem description area
      const main = document.querySelector('main') || document.body;
      const text = main.innerText;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);

      let currentSection = 'description';
      let currentExample: { input: string; output: string; explanation?: string } | null = null;
      const descriptionLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Section detection
        if (line.match(/^Example \d+:?$/)) {
          if (currentExample && currentExample.input) {
            result.examples.push(currentExample);
          }
          currentExample = { input: '', output: '' };
          currentSection = 'example';
          continue;
        }

        if (line === 'Constraints:') {
          if (currentExample && currentExample.input) {
            result.examples.push(currentExample);
            currentExample = null;
          }
          currentSection = 'constraints';
          continue;
        }

        if (line.startsWith('Recommended Time') || line.startsWith('Hint') || line === 'Company Tags') {
          if (currentExample && currentExample.input) {
            result.examples.push(currentExample);
            currentExample = null;
          }
          currentSection = 'other';
          continue;
        }

        // Process based on section
        if (currentSection === 'description') {
          descriptionLines.push(line);
        } else if (currentSection === 'example' && currentExample) {
          if (line.startsWith('Input:')) {
            currentExample.input = line.replace('Input:', '').trim();
          } else if (line.startsWith('Output:')) {
            currentExample.output = line.replace('Output:', '').trim();
          } else if (line.startsWith('Explanation:')) {
            currentExample.explanation = line.replace('Explanation:', '').trim();
          }
        } else if (currentSection === 'constraints') {
          if (line && !line.startsWith('Recommended') && !line.startsWith('Hint')) {
            result.constraints.push(line);
          }
        }
      }

      // Add last example if exists
      if (currentExample && currentExample.input) {
        result.examples.push(currentExample);
      }

      result.description = descriptionLines.join(' ').trim();

      return result;
    });

    // Extract starter code for Python (primary language)
    const starterCode: Record<string, string> = {};

    // Click Python language button if available
    try {
      const pythonClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const pythonBtn = buttons.find(b => b.textContent?.trim() === 'Python');
        if (pythonBtn) {
          pythonBtn.click();
          return true;
        }
        return false;
      });

      if (pythonClicked) {
        await new Promise(resolve => setTimeout(resolve, 500));

        const code = await page.evaluate(() => {
          const codeLines = document.querySelectorAll('.view-line');
          if (codeLines.length > 0) {
            return Array.from(codeLines).map(line => line.textContent || '').join('\n');
          }
          return '';
        });

        if (code) {
          starterCode['python'] = code.trim();
        }
      }
    } catch (e) {
      // Starter code extraction failed, continue without it
    }

    // Extract slug from URL
    const slugMatch = info.url.match(/\/problems\/([^/]+)/);
    const slug = slugMatch ? slugMatch[1] : info.title.toLowerCase().replace(/\s+/g, '-');

    // Extract LeetCode number from URL if available
    let leetcodeNumber: number | null = null;
    if (info.leetcodeUrl) {
      const match = info.leetcodeUrl.match(/problems\/([^/]+)/);
      // We can't easily get the number from the URL slug, so leave it null
    }

    return {
      title: info.title,
      slug,
      description: content.description,
      difficulty: info.difficulty,
      topic: info.topic,
      source: 'neetcode',
      source_url: fullUrl,
      leetcode_number: leetcodeNumber,
      examples: content.examples,
      metadata: {
        constraints: content.constraints,
        visible_test_cases: [],
        hidden_test_cases: [],
        starter_code: starterCode
      },
      hints: content.hints
    };
  } catch (error) {
    console.error(`    Error scraping ${info.title}:`, error);
    return null;
  }
}

async function saveToDatabase(problem: ExtractedProblem): Promise<boolean> {
  try {
    const topicId = await getTopicId(problem.topic);

    const { error } = await getSupabase()
      .from('questions')
      .upsert({
        title: problem.title,
        slug: problem.slug,
        description: problem.description,
        type: 'coding',
        difficulty: problem.difficulty,
        topic_id: topicId,
        source: problem.source,
        source_url: problem.source_url,
        leetcode_number: problem.leetcode_number,
        examples: problem.examples,
        metadata: problem.metadata,
        hints: problem.hints
      }, {
        onConflict: 'slug'
      });

    if (error) {
      console.error(`    Error saving ${problem.title}:`, error);
      return false;
    }

    console.log(`    Saved: ${problem.title}`);
    return true;
  } catch (error) {
    console.error(`    Error saving ${problem.title}:`, error);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('NeetCode 150 Scraper');
  console.log('========================================');
  console.log(`Mode: ${isTest ? 'TEST' : isDryRun ? 'DRY RUN' : 'FULL'}`);
  console.log(`Browser: ${isHeaded ? 'Visible' : 'Headless'}`);
  if (limit) console.log(`Limit: ${limit} problems`);
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
    // Phase 1: Extract problem URLs
    let problems = await extractProblemUrls(page);

    // Apply limit
    if (limit) {
      problems = problems.slice(0, limit);
      console.log(`\nLimited to ${problems.length} problems`);
    }

    // Phase 2: Scrape each problem
    console.log('\n========================================');
    console.log('Phase 2: Scraping problem content...');
    console.log('========================================\n');

    let successCount = 0;
    let failCount = 0;
    const results: ExtractedProblem[] = [];
    let currentPage = page;

    for (let i = 0; i < problems.length; i++) {
      const info = problems[i];
      console.log(`[${i + 1}/${problems.length}] ${info.title} (${info.topic})`);

      try {
        const problemData = await extractProblemContent(currentPage, info);

        if (problemData) {
          results.push(problemData);

          if (isDryRun) {
            console.log(`    [DRY RUN] Would save: ${problemData.title}`);
            console.log(`    - Description: ${problemData.description.substring(0, 80)}...`);
            console.log(`    - Examples: ${problemData.examples.length}`);
            console.log(`    - Constraints: ${problemData.metadata.constraints.length}`);
            successCount++;
          } else {
            const saved = await saveToDatabase(problemData);
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
          const problemData = await extractProblemContent(currentPage, info);
          if (problemData) {
            results.push(problemData);
            if (isDryRun) {
              console.log(`    [DRY RUN] Would save: ${problemData.title}`);
              successCount++;
            } else {
              const saved = await saveToDatabase(problemData);
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
      await new Promise(resolve => setTimeout(resolve, 1500));
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
