-- Add system design support to interview_sessions table

-- Add session_type column to distinguish coding vs system design interviews
ALTER TABLE interview_sessions
ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'coding';

-- Add check constraint for session_type
ALTER TABLE interview_sessions
DROP CONSTRAINT IF EXISTS interview_sessions_type_check;

ALTER TABLE interview_sessions
ADD CONSTRAINT interview_sessions_type_check
CHECK (session_type IN ('coding', 'system_design'));

-- Add drawing_data column for Excalidraw diagram (JSONB)
ALTER TABLE interview_sessions
ADD COLUMN IF NOT EXISTS drawing_data JSONB;

-- Add notes column for user's written notes (plain text)
ALTER TABLE interview_sessions
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Make language nullable (system design interviews don't need a language)
ALTER TABLE interview_sessions
ALTER COLUMN language DROP NOT NULL;

-- Create index for filtering by session type
CREATE INDEX IF NOT EXISTS idx_interview_sessions_type
ON interview_sessions(session_type);

-- Comments for documentation
COMMENT ON COLUMN interview_sessions.session_type IS 'Type of interview: coding (LeetCode-style) or system_design';
COMMENT ON COLUMN interview_sessions.drawing_data IS 'Excalidraw diagram JSON (elements array) for system design interviews';
COMMENT ON COLUMN interview_sessions.notes IS 'Plain text notes written by the user during the interview';

-- Update existing rows to have explicit session_type (they are all coding)
UPDATE interview_sessions
SET session_type = 'coding'
WHERE session_type IS NULL;
