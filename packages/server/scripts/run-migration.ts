/**
 * Run migration script using Supabase client
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running migration...\n');

  // Step 1: Add type column to topics table
  console.log('1. Adding type column to topics table...');
  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE topics ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'coding' CHECK (type IN ('coding', 'system_design'));`
  }).single();

  if (alterError) {
    // Try direct approach - the column might already exist
    console.log('   Column may already exist, continuing...');
  } else {
    console.log('   Done');
  }

  // Step 2: Update existing topics
  console.log('2. Updating existing topics to coding type...');
  const { error: updateError } = await supabase
    .from('topics')
    .update({ type: 'coding' })
    .is('type', null);

  if (updateError) {
    console.log('   Warning:', updateError.message);
  } else {
    console.log('   Done');
  }

  // Step 3: Check if System Design topic exists
  console.log('3. Adding System Design topic...');
  const { data: existingTopic } = await supabase
    .from('topics')
    .select('id')
    .eq('slug', 'system-design')
    .single();

  if (!existingTopic) {
    const { error: insertError } = await supabase
      .from('topics')
      .insert({
        name: 'System Design',
        slug: 'system-design',
        description: 'Design scalable systems and architectures',
        difficulty_order: 18,
        type: 'system_design'
      });

    if (insertError) {
      console.log('   Warning:', insertError.message);
    } else {
      console.log('   Done');
    }
  } else {
    console.log('   Already exists');
  }

  // Step 4: Check if questions table exists
  console.log('4. Checking questions table...');
  const { data: tables, error: tablesError } = await supabase
    .from('questions')
    .select('id')
    .limit(1);

  if (tablesError && tablesError.code === '42P01') {
    console.log('   Questions table does not exist. Please run the SQL migration manually:');
    console.log('   Go to: https://supabase.com/dashboard/project/ijkyigjgauiovhalpgcm/sql');
    console.log('   And run the SQL from: supabase/migrations/20240118000000_add_questions_table.sql');
    return false;
  } else if (tablesError) {
    console.log('   Error checking table:', tablesError.message);
    return false;
  } else {
    console.log('   Questions table exists');
  }

  console.log('\nMigration check complete!');
  return true;
}

runMigration().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
