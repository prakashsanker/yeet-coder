-- Quiz Feature: Tables for AI-generated quizzes and tracking weak areas
-- This enables users to practice system design concepts through generated questions

-- Add weak_areas column to evaluations to track concepts user struggled with
ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS weak_areas JSONB;

COMMENT ON COLUMN evaluations.weak_areas IS 'Array of concepts the user struggled with during this evaluation, detected by AI';

-- Quiz sessions - tracks each quiz attempt
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  pattern_id INTEGER,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'scenario')),
  total_questions INTEGER NOT NULL CHECK (total_questions > 0),
  correct_count INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX idx_quiz_sessions_topic ON quiz_sessions(topic);
CREATE INDEX idx_quiz_sessions_created_at ON quiz_sessions(created_at DESC);

COMMENT ON TABLE quiz_sessions IS 'Tracks individual quiz attempts by users';

-- Quiz questions - stores generated questions and user answers
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'scenario')),
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  wrong_explanations JSONB,
  content_hash TEXT,
  user_answer TEXT,
  is_correct BOOLEAN,
  answered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_quiz_questions_session_id ON quiz_questions(session_id);
CREATE INDEX idx_quiz_questions_content_hash ON quiz_questions(content_hash);

COMMENT ON TABLE quiz_questions IS 'Individual quiz questions with answers and explanations';

-- User quiz performance - aggregates performance by topic for recommendations
CREATE TABLE IF NOT EXISTS user_quiz_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  total_questions INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  last_practiced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, topic)
);

CREATE INDEX idx_user_quiz_performance_user_id ON user_quiz_performance(user_id);
CREATE INDEX idx_user_quiz_performance_topic ON user_quiz_performance(topic);

COMMENT ON TABLE user_quiz_performance IS 'Aggregated quiz performance per user per topic';

-- Enable RLS on new tables
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quiz_performance ENABLE ROW LEVEL SECURITY;

-- RLS policies for quiz_sessions
CREATE POLICY quiz_sessions_select ON quiz_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY quiz_sessions_insert ON quiz_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY quiz_sessions_update ON quiz_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for quiz_questions
CREATE POLICY quiz_questions_select ON quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quiz_sessions
      WHERE quiz_sessions.id = quiz_questions.session_id
      AND quiz_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY quiz_questions_insert ON quiz_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_sessions
      WHERE quiz_sessions.id = quiz_questions.session_id
      AND quiz_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY quiz_questions_update ON quiz_questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM quiz_sessions
      WHERE quiz_sessions.id = quiz_questions.session_id
      AND quiz_sessions.user_id = auth.uid()
    )
  );

-- RLS policies for user_quiz_performance
CREATE POLICY user_quiz_performance_select ON user_quiz_performance
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_quiz_performance_insert ON user_quiz_performance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_quiz_performance_update ON user_quiz_performance
  FOR UPDATE USING (auth.uid() = user_id);
