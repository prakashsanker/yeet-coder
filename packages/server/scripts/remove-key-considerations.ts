/**
 * Remove Key Considerations from System Design Questions
 *
 * This script removes the "Key considerations:" section from
 * system design question descriptions.
 *
 * Usage:
 *   npx tsx scripts/remove-key-considerations.ts
 *   npx tsx scripts/remove-key-considerations.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const isDryRun = process.argv.includes('--dry-run')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  console.log('========================================')
  console.log('Remove Key Considerations from System Design Questions')
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('========================================\n')

  // Fetch all system design questions
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, title, description')
    .eq('type', 'system_design')

  if (error) {
    console.error('Error fetching questions:', error)
    process.exit(1)
  }

  console.log(`Found ${questions.length} system design questions\n`)

  let updatedCount = 0

  for (const question of questions) {
    const { id, title, description } = question

    // Check if description contains "Key considerations:"
    if (!description || !description.includes('Key considerations:')) {
      continue
    }

    // Remove everything from "Key considerations:" onwards
    const cleanedDescription = description.split('\n\nKey considerations:')[0].trim()

    console.log(`[${title}]`)
    console.log(`  Before: ${description.length} chars`)
    console.log(`  After:  ${cleanedDescription.length} chars`)

    if (!isDryRun) {
      const { error: updateError } = await supabase
        .from('questions')
        .update({ description: cleanedDescription, hints: [] })
        .eq('id', id)

      if (updateError) {
        console.error(`  Error updating: ${updateError.message}`)
      } else {
        console.log(`  ✓ Updated`)
        updatedCount++
      }
    } else {
      console.log(`  [DRY RUN] Would update`)
      updatedCount++
    }
  }

  console.log('\n========================================')
  console.log(`Updated ${updatedCount} questions`)
  console.log('========================================')
}

main().catch(console.error)
