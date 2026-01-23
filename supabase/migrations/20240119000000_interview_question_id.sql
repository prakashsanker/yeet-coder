-- Migration: Change interview_sessions to use question_id instead of question_data JSONB
-- This normalizes the data model now that questions are stored in the questions table

-- Add question_id column (nullable initially for backward compatibility)
ALTER TABLE interview_sessions
ADD COLUMN IF NOT EXISTS question_id UUID REFERENCES questions(id);

-- Make question_data nullable (was NOT NULL before)
-- This allows creating interviews with just question_id
ALTER TABLE interview_sessions
ALTER COLUMN question_data DROP NOT NULL;

-- Create index for question lookups
CREATE INDEX IF NOT EXISTS idx_interview_sessions_question ON interview_sessions(question_id);

-- Note: Existing interviews with question_data will continue to work
-- The application will check for question_id first, then fall back to question_data
-- After migration is complete and all interviews use question_id,
-- we can drop the question_data column in a future migration
