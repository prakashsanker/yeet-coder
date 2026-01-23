-- Fix: Make question_data nullable so we can use question_id instead
-- This is needed because the previous migration added question_id but didn't make question_data nullable

ALTER TABLE interview_sessions
ALTER COLUMN question_data DROP NOT NULL;
