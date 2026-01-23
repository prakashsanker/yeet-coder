/**
 * AI-powered evaluation service for coding interviews.
 * Evaluates:
 * 1. Solution correctness (test case pass/fail)
 * 2. User-created test cases (quality, edge case coverage)
 * 3. Transcript analysis (thought process, Big O discussion, clarity)
 */

import { llm, type LLMModel } from './llm'
import type { TranscriptEntry, TestCase, EvaluationFeedback } from '../types'

export interface EvaluationInput {
  // Interview data
  interviewId: string
  questionTitle: string
  questionDescription: string
  questionConstraints: string[]
  questionDifficulty: 'easy' | 'medium' | 'hard'

  // User's solution
  finalCode: string
  language: string

  // Test results
  testResults: {
    visible: { passed: number; total: number }
    hidden: { passed: number; total: number }
  }

  // User's custom test cases
  userTestCases: TestCase[]

  // Transcript of user talking through the problem
  transcript: TranscriptEntry[]

  // Time metrics
  timeSpentSeconds: number
  timeLimitSeconds: number
  runCount: number
  submitCount: number
}

export interface EvaluationResult {
  // Individual scores (0-100)
  test_case_coverage_score: number // Hidden test pass rate
  thought_process_score: number // Quality of verbal problem-solving
  clarifying_questions_score: number // Did they ask good questions?
  edge_case_score: number // Quality of user-created test cases
  time_management_score: number // Efficient use of time
  complexity_analysis_score: number // Did they discuss Big O correctly?
  code_quality_score: number // Clean, readable code

  // Overall
  overall_score: number
  verdict: 'PASS' | 'FAIL'

  // Detailed feedback
  feedback: EvaluationFeedback
}

const EVALUATION_SYSTEM_PROMPT = `You are an expert coding interview evaluator. You assess candidates based on their problem-solving approach, communication, and code quality.

You will evaluate a candidate's performance on a coding interview. Consider:

1. **Test Case Coverage** (based on hidden test results)
   - What percentage of hidden test cases passed?
   - Score is directly proportional to pass rate

2. **Thought Process** (from transcript)
   - Did they verbalize their thinking clearly?
   - Did they break down the problem systematically?
   - Did they consider multiple approaches before coding?

3. **Clarifying Questions** (from transcript)
   - Did they ask about edge cases, constraints, or requirements?
   - Did they confirm their understanding before coding?

4. **Edge Case Awareness** (from user-created test cases)
   - Did they create test cases for edge cases?
   - Quality: empty inputs, single elements, boundary values, negative numbers, etc.
   - More diverse test cases = higher score

5. **Time Management**
   - Did they use their time efficiently?
   - Did they avoid getting stuck for too long?
   - Consider time spent vs difficulty

6. **Complexity Analysis** (from transcript)
   - Did they discuss time complexity (Big O)?
   - Did they discuss space complexity?
   - Was their analysis correct?

7. **Code Quality**
   - Is the code clean and readable?
   - Good variable names?
   - Proper structure?

Return a JSON object with this exact structure:
{
  "test_case_coverage_score": <0-100>,
  "thought_process_score": <0-100>,
  "clarifying_questions_score": <0-100>,
  "edge_case_score": <0-100>,
  "time_management_score": <0-100>,
  "complexity_analysis_score": <0-100>,
  "code_quality_score": <0-100>,
  "overall_score": <0-100>,
  "verdict": "PASS" | "FAIL",
  "feedback": {
    "strengths": ["strength 1", "strength 2", ...],
    "improvements": ["area for improvement 1", "area for improvement 2", ...],
    "detailed_notes": "Comprehensive feedback paragraph..."
  }
}

SCORING GUIDELINES:
- PASS verdict requires overall_score >= 70
- Test case coverage is weighted heavily (40% of overall)
- Empty transcript = 50 for thought_process, clarifying_questions, complexity_analysis
- No user test cases = 50 for edge_case_score
- Be encouraging but honest in feedback

CRITICAL JSON FORMATTING:
- Return ONLY valid JSON
- Use double quotes for strings
- Escape special characters
- No trailing commas`

function formatTranscript(transcript: TranscriptEntry[]): string {
  if (!transcript || transcript.length === 0) {
    return '(No transcript available - user did not speak during the interview)'
  }

  return transcript
    .map((entry) => `[${entry.speaker.toUpperCase()}]: ${entry.text}`)
    .join('\n')
}

function formatUserTestCases(testCases: TestCase[]): string {
  if (!testCases || testCases.length === 0) {
    return '(User did not create any custom test cases)'
  }

  return testCases
    .map((tc, i) => `Test ${i + 1}:\n  Input: ${tc.input}\n  Expected: ${tc.expected_output}`)
    .join('\n\n')
}

export async function evaluateInterview(
  input: EvaluationInput,
  options: { model?: LLMModel } = {}
): Promise<EvaluationResult> {
  const { model = 'llama-3.3-70b-versatile' } = options

  const totalTests = input.testResults.visible.total + input.testResults.hidden.total
  const totalPassed = input.testResults.visible.passed + input.testResults.hidden.passed
  const passRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0

  const userPrompt = `Evaluate this coding interview performance:

## PROBLEM
Title: ${input.questionTitle}
Difficulty: ${input.questionDifficulty}
Description: ${input.questionDescription.slice(0, 500)}...
Constraints: ${input.questionConstraints.join(', ')}

## TEST RESULTS
Visible Tests: ${input.testResults.visible.passed}/${input.testResults.visible.total} passed
Hidden Tests: ${input.testResults.hidden.passed}/${input.testResults.hidden.total} passed
Overall Pass Rate: ${passRate.toFixed(1)}%

## USER'S CODE (${input.language})
\`\`\`${input.language}
${input.finalCode || '(No code submitted)'}
\`\`\`

## USER'S CUSTOM TEST CASES
${formatUserTestCases(input.userTestCases)}

## INTERVIEW TRANSCRIPT
${formatTranscript(input.transcript)}

## TIME METRICS
- Time spent: ${Math.floor(input.timeSpentSeconds / 60)}m ${input.timeSpentSeconds % 60}s
- Time limit: ${Math.floor(input.timeLimitSeconds / 60)}m
- Run attempts: ${input.runCount}
- Submit attempts: ${input.submitCount}

Based on all this information, provide a comprehensive evaluation.`

  try {
    const result = await llm.generateJSON<EvaluationResult>(
      [
        { role: 'system', content: EVALUATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { model, temperature: 0.3, maxTokens: 2000 }
    )

    // Validate and clamp scores
    const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)))

    return {
      test_case_coverage_score: clampScore(result.test_case_coverage_score),
      thought_process_score: clampScore(result.thought_process_score),
      clarifying_questions_score: clampScore(result.clarifying_questions_score),
      edge_case_score: clampScore(result.edge_case_score),
      time_management_score: clampScore(result.time_management_score),
      complexity_analysis_score: clampScore(result.complexity_analysis_score),
      code_quality_score: clampScore(result.code_quality_score),
      overall_score: clampScore(result.overall_score),
      verdict: result.overall_score >= 70 ? 'PASS' : 'FAIL',
      feedback: {
        strengths: result.feedback?.strengths || [],
        improvements: result.feedback?.improvements || [],
        detailed_notes: result.feedback?.detailed_notes || '',
      },
    }
  } catch (error) {
    console.error('[EVALUATION] Error generating evaluation:', error)

    // Return a basic evaluation based on test results
    const basicScore = Math.round(passRate)

    return {
      test_case_coverage_score: basicScore,
      thought_process_score: 50,
      clarifying_questions_score: 50,
      edge_case_score: input.userTestCases.length > 0 ? 60 : 40,
      time_management_score: 50,
      complexity_analysis_score: 50,
      code_quality_score: input.finalCode ? 60 : 30,
      overall_score: basicScore,
      verdict: basicScore >= 70 ? 'PASS' : 'FAIL',
      feedback: {
        strengths: totalPassed > 0 ? ['Some test cases passed'] : [],
        improvements: ['Unable to generate detailed feedback'],
        detailed_notes: 'Automatic evaluation based on test results only.',
      },
    }
  }
}

export const evaluationService = {
  evaluate: evaluateInterview,
}
