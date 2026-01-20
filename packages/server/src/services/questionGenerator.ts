import { llm, type LLMModel } from './llm'
import type { QuestionData } from '../types'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface GenerateQuestionOptions {
  topic: string
  difficulty: Difficulty
  model?: LLMModel
}

const SYSTEM_PROMPT = `You are an expert coding interview question generator for a LeetCode-style practice platform.

Generate a coding interview question based on the given topic and difficulty level.

IMPORTANT RULES:
1. The question must be original and not a direct copy of existing LeetCode/HackerRank problems
2. The question should test the specified topic/algorithm
3. Include realistic test cases with edge cases
4. Constraints should be appropriate for the difficulty level
5. Examples should be clear and helpful
6. Starter code must be complete function signatures that users can fill in

Difficulty guidelines:
- Easy: Simple applications of the concept, O(n) or O(n log n) solutions, small input sizes
- Medium: Requires combining concepts, may need optimization, moderate input sizes
- Hard: Complex problem-solving, requires optimal algorithms, large input sizes

Return a JSON object with this exact structure:
{
  "title": "Short descriptive title",
  "description": "Full problem description. Include the problem statement, what the function should return, and any important notes.",
  "examples": [
    {
      "input": "Clear input description",
      "output": "Expected output",
      "explanation": "Optional explanation of how to get the output"
    }
  ],
  "constraints": [
    "Constraint 1 (e.g., 1 <= n <= 10^5)",
    "Constraint 2"
  ],
  "visible_test_cases": [
    {
      "input": "actual input value as string (e.g., '[1,2,3]\\n5' for array and target)",
      "expected_output": "actual expected output as string"
    }
  ],
  "hidden_test_cases": [
    {
      "input": "edge case or larger test input",
      "expected_output": "expected output"
    }
  ],
  "starter_code": {
    "python": "def solution(nums: List[int], target: int) -> int:\\n    # Your code here\\n    pass",
    "javascript": "function solution(nums, target) {\\n  // Your code here\\n}",
    "typescript": "function solution(nums: number[], target: number): number {\\n  // Your code here\\n}",
    "java": "class Solution {\\n    public int solution(int[] nums, int target) {\\n        // Your code here\\n        return 0;\\n    }\\n}",
    "cpp": "class Solution {\\npublic:\\n    int solution(vector<int>& nums, int target) {\\n        // Your code here\\n        return 0;\\n    }\\n};"
  }
}

IMPORTANT:
- Include at least 2 visible test cases and 3 hidden test cases
- Hidden test cases should include edge cases and larger inputs
- Starter code must have proper function signatures matching the problem
- For Python, include type hints and import List from typing if needed
- For test cases, the input format should match what the starter code expects

CRITICAL JSON FORMATTING RULES:
- Return ONLY valid JSON, no markdown code blocks, no explanatory text
- NO trailing commas after the last item in arrays or objects
- All strings must use double quotes, not single quotes
- NEVER put actual line breaks inside string values - always use the escape sequence \\n
- Escape special characters: \\n for newlines, \\t for tabs, \\" for quotes, \\\\ for backslash
- Control characters (ASCII 0-31) are FORBIDDEN inside strings - use escape sequences instead
- Do NOT include comments in the JSON
- Keep code in starter_code on a SINGLE LINE using \\n for line breaks
- Verify your JSON is valid before responding`

export async function generateQuestion(
  options: GenerateQuestionOptions
): Promise<QuestionData> {
  const { topic, difficulty, model } = options

  const userPrompt = `Generate a ${difficulty} difficulty coding interview question about: ${topic}

The question should thoroughly test understanding of ${topic} concepts.

Remember to include starter code for all 5 languages: python, javascript, typescript, java, cpp.`

  const response = await llm.generateJSON<QuestionData>(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    { model, temperature: 0.8 }
  )

  // Validate the response structure
  if (!response.title || !response.description || !response.examples || !response.constraints) {
    throw new Error('Invalid question structure returned from LLM')
  }

  if (!response.visible_test_cases?.length || !response.hidden_test_cases?.length) {
    throw new Error('Question must have test cases')
  }

  if (!response.starter_code) {
    throw new Error('Question must have starter code')
  }

  return response
}

export const questionGenerator = {
  generate: generateQuestion,
}
