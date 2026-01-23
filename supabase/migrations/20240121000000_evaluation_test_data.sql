-- Add fields to evaluations table for storing test results and user test cases

-- Add test_results column to store the execution results
ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS test_results JSONB;

-- Add user_test_cases column to store test cases the user created
ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS user_test_cases JSONB;

-- Comment on the new columns
COMMENT ON COLUMN evaluations.test_results IS 'JSON containing visible and hidden test results: { visible: { passed, total }, hidden: { passed, total } }';
COMMENT ON COLUMN evaluations.user_test_cases IS 'Array of test cases the user created during the interview: [{ input, expected_output }]';
