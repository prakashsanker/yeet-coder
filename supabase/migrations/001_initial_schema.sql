-- YeetCoder Database Schema
-- Run this migration in your Supabase SQL editor

-- profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    username TEXT UNIQUE,
    preferred_language TEXT DEFAULT 'python',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- topics (NeetCode roadmap categories)
CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    difficulty_order INT,
    parent_topic_id UUID REFERENCES topics(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_topic_progress
CREATE TABLE IF NOT EXISTS user_topic_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    interviews_attempted INT DEFAULT 0,
    interviews_passed INT DEFAULT 0,
    total_time_spent_seconds INT DEFAULT 0,
    average_score DECIMAL(5,2),
    last_attempted_at TIMESTAMPTZ,
    weakness_score DECIMAL(5,2) DEFAULT 100.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, topic_id)
);

-- interview_sessions
CREATE TABLE IF NOT EXISTS interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id),
    status TEXT CHECK (status IN ('in_progress', 'completed', 'abandoned')) DEFAULT 'in_progress',
    question_data JSONB NOT NULL,
    language TEXT NOT NULL,
    final_code TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    time_limit_seconds INT DEFAULT 3600,
    time_spent_seconds INT,
    run_count INT DEFAULT 0,
    submit_count INT DEFAULT 0,
    transcript JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- evaluations
CREATE TABLE IF NOT EXISTS evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE UNIQUE,
    test_case_coverage_score INT CHECK (test_case_coverage_score >= 0 AND test_case_coverage_score <= 100),
    thought_process_score INT CHECK (thought_process_score >= 0 AND thought_process_score <= 100),
    clarifying_questions_score INT CHECK (clarifying_questions_score >= 0 AND clarifying_questions_score <= 100),
    edge_case_score INT CHECK (edge_case_score >= 0 AND edge_case_score <= 100),
    time_management_score INT CHECK (time_management_score >= 0 AND time_management_score <= 100),
    complexity_analysis_score INT CHECK (complexity_analysis_score >= 0 AND complexity_analysis_score <= 100),
    code_quality_score INT CHECK (code_quality_score >= 0 AND code_quality_score <= 100),
    overall_score INT CHECK (overall_score >= 0 AND overall_score <= 100),
    verdict TEXT CHECK (verdict IN ('PASS', 'FAIL')),
    feedback JSONB,
    solution_code TEXT,
    solution_explanation JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- execution_results (for history/debugging)
CREATE TABLE IF NOT EXISTS execution_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE,
    execution_type TEXT CHECK (execution_type IN ('run', 'submit')),
    language TEXT NOT NULL,
    code TEXT NOT NULL,
    results JSONB,
    passed_count INT,
    total_count INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- conversation_messages (for AI interviewer)
CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'interviewer', 'system')),
    content TEXT NOT NULL,
    timestamp_ms BIGINT,
    is_voice BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_topic_progress_user ON user_topic_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_topic_progress_weakness ON user_topic_progress(user_id, weakness_score DESC);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user ON interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_topic ON interview_sessions(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_interview ON evaluations(interview_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_interview ON conversation_messages(interview_id);
CREATE INDEX IF NOT EXISTS idx_execution_results_interview ON execution_results(interview_id);

-- Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can manage own progress" ON user_topic_progress
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own interviews" ON interview_sessions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own evaluations" ON evaluations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM interview_sessions
            WHERE id = evaluations.interview_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view own execution results" ON execution_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM interview_sessions
            WHERE id = execution_results.interview_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own conversation messages" ON conversation_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM interview_sessions
            WHERE id = conversation_messages.interview_id
            AND user_id = auth.uid()
        )
    );

-- Topics are public (read-only for authenticated users)
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view topics" ON topics
    FOR SELECT TO authenticated USING (true);

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
