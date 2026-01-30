-- Add Google-style hiring rating system for system design interviews
-- Adds level-based evaluation (L4/L5/L6) and hiring ratings

-- Add target_level to interview_sessions (candidate's target level for evaluation)
ALTER TABLE interview_sessions
ADD COLUMN IF NOT EXISTS target_level TEXT;

-- Add check constraint for target_level values
ALTER TABLE interview_sessions
ADD CONSTRAINT interview_sessions_target_level_check
CHECK (target_level IS NULL OR target_level IN ('L4', 'L5', 'L6'));

COMMENT ON COLUMN interview_sessions.target_level IS 'Target level for system design evaluation: L4 (Junior), L5 (Mid-Level), L6 (Senior)';

-- Add hiring_rating and target_level to evaluations table
ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS hiring_rating TEXT;

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS target_level TEXT;

-- Add check constraint for hiring_rating values
ALTER TABLE evaluations
ADD CONSTRAINT eval_hiring_rating_values
CHECK (hiring_rating IS NULL OR hiring_rating IN ('strong_hire', 'hire', 'leaning_hire', 'leaning_no_hire', 'no_hire'));

-- Add check constraint for target_level values
ALTER TABLE evaluations
ADD CONSTRAINT eval_target_level_values
CHECK (target_level IS NULL OR target_level IN ('L4', 'L5', 'L6'));

-- Comments for documentation
COMMENT ON COLUMN evaluations.hiring_rating IS 'Google-style hiring rating: strong_hire, hire, leaning_hire, leaning_no_hire, no_hire';
COMMENT ON COLUMN evaluations.target_level IS 'Level the candidate was evaluated at: L4 (Junior), L5 (Mid-Level), L6 (Senior)';
