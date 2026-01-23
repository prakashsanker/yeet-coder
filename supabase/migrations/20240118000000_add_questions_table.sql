-- Add type column to topics table to distinguish coding vs system design
ALTER TABLE topics ADD COLUMN type TEXT DEFAULT 'coding'
  CHECK (type IN ('coding', 'system_design'));

-- Update existing topics to be coding type (they already are by default, but explicit)
UPDATE topics SET type = 'coding' WHERE type IS NULL;

-- Add System Design topic
INSERT INTO topics (name, slug, description, difficulty_order, type) VALUES
('System Design', 'system-design', 'Design scalable systems and architectures', 18, 'system_design');

-- Create questions table
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core fields
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,

  -- Categorization
  type TEXT NOT NULL CHECK (type IN ('coding', 'system_design')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  topic_id UUID REFERENCES topics(id),

  -- Source tracking
  source TEXT,
  source_url TEXT,
  leetcode_number INT,

  -- Examples (for coding questions)
  examples JSONB DEFAULT '[]',

  -- Coding-specific metadata (null for system_design)
  -- Contains: constraints, visible_test_cases, hidden_test_cases, starter_code
  metadata JSONB,

  -- Hints and solutions
  hints JSONB DEFAULT '[]',
  solution_explanation TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_questions_type ON questions(type);
CREATE INDEX idx_questions_topic ON questions(topic_id);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_slug ON questions(slug);
CREATE INDEX idx_questions_leetcode_number ON questions(leetcode_number);

-- Enable RLS
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Questions are public read for authenticated users
CREATE POLICY "Questions are viewable by authenticated users"
  ON questions FOR SELECT
  TO authenticated
  USING (true);
