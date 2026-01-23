import type { TestCase, ExecutionResult } from '../types/index.js'

// Judge0 language IDs
const LANGUAGE_IDS: Record<string, number> = {
  python: 71, // Python 3.8.1
  javascript: 63, // JavaScript (Node.js 12.14.0)
  typescript: 74, // TypeScript 3.7.4
  java: 62, // Java (OpenJDK 13.0.1)
  cpp: 54, // C++ (GCC 9.2.0)
  go: 60, // Go 1.13.5
}

interface Judge0Submission {
  source_code: string
  language_id: number
  stdin: string
  expected_output?: string
  cpu_time_limit?: number
  memory_limit?: number
}

interface Judge0Response {
  token: string
}

interface Judge0Result {
  stdout: string | null
  stderr: string | null
  compile_output: string | null
  message: string | null
  status: {
    id: number
    description: string
  }
  time: string | null
  memory: number | null
}

// Status IDs from Judge0
const STATUS = {
  IN_QUEUE: 1,
  PROCESSING: 2,
  ACCEPTED: 3,
  WRONG_ANSWER: 4,
  TIME_LIMIT_EXCEEDED: 5,
  COMPILATION_ERROR: 6,
  RUNTIME_ERROR_SIGSEGV: 7,
  RUNTIME_ERROR_SIGXFSZ: 8,
  RUNTIME_ERROR_SIGFPE: 9,
  RUNTIME_ERROR_SIGABRT: 10,
  RUNTIME_ERROR_NZEC: 11,
  RUNTIME_ERROR_OTHER: 12,
  INTERNAL_ERROR: 13,
  EXEC_FORMAT_ERROR: 14,
}

function getJudge0Url(): string {
  return process.env.JUDGE0_URL || 'https://judge0-ce.p.rapidapi.com'
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // RapidAPI authentication
  if (process.env.RAPIDAPI_KEY) {
    headers['X-RapidAPI-Key'] = process.env.RAPIDAPI_KEY
    headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com'
  }

  return headers
}

function mapStatusToResult(statusId: number): ExecutionResult['status'] {
  switch (statusId) {
    case STATUS.ACCEPTED:
      return 'Accepted'
    case STATUS.WRONG_ANSWER:
      return 'Wrong Answer'
    case STATUS.TIME_LIMIT_EXCEEDED:
      return 'Time Limit Exceeded'
    case STATUS.COMPILATION_ERROR:
      return 'Compilation Error'
    default:
      if (statusId >= STATUS.RUNTIME_ERROR_SIGSEGV && statusId <= STATUS.RUNTIME_ERROR_OTHER) {
        return 'Runtime Error'
      }
      return 'Runtime Error'
  }
}

async function submitCode(submission: Judge0Submission): Promise<string> {
  const url = `${getJudge0Url()}/submissions?base64_encoded=true&wait=false`

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      ...submission,
      source_code: Buffer.from(submission.source_code).toString('base64'),
      stdin: Buffer.from(submission.stdin).toString('base64'),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Judge0 submission failed: ${error}`)
  }

  const result = (await response.json()) as Judge0Response
  return result.token
}

async function getResult(token: string): Promise<Judge0Result> {
  const url = `${getJudge0Url()}/submissions/${token}?base64_encoded=true`

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Judge0 result fetch failed: ${error}`)
  }

  const result = (await response.json()) as Judge0Result

  // Decode base64 outputs
  if (result.stdout) {
    result.stdout = Buffer.from(result.stdout, 'base64').toString('utf-8')
  }
  if (result.stderr) {
    result.stderr = Buffer.from(result.stderr, 'base64').toString('utf-8')
  }
  if (result.compile_output) {
    result.compile_output = Buffer.from(result.compile_output, 'base64').toString('utf-8')
  }

  return result
}

async function waitForResult(token: string, maxAttempts = 20, delayMs = 500): Promise<Judge0Result> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getResult(token)

    // Check if processing is complete
    if (result.status.id !== STATUS.IN_QUEUE && result.status.id !== STATUS.PROCESSING) {
      return result
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  throw new Error('Execution timed out waiting for result')
}

// Wrap user code with boilerplate to read stdin, call solution, and print output
function wrapCode(code: string, language: string, _testInput: string): string {

  switch (language) {
    case 'javascript':
      return `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
const inputLines = [];

rl.on('line', (line) => inputLines.push(line));
rl.on('close', () => {
  ${code}

  // Parse inputs
  const args = inputLines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return isNaN(Number(line)) ? line : Number(line);
    }
  });

  // Call solution with parsed args
  const result = solution(...args);
  console.log(JSON.stringify(result));
});
`

    case 'typescript':
      return `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
const inputLines: string[] = [];

rl.on('line', (line: string) => inputLines.push(line));
rl.on('close', () => {
  ${code}

  // Parse inputs
  const args = inputLines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return isNaN(Number(line)) ? line : Number(line);
    }
  });

  // Call solution with parsed args
  const result = solution(...args);
  console.log(JSON.stringify(result));
});
`

    case 'python':
      return `
import sys
import json

${code}

# Read all input lines
input_lines = sys.stdin.read().strip().split('\\n')

# Parse inputs
args = []
for line in input_lines:
    try:
        args.append(json.loads(line))
    except:
        try:
            args.append(int(line))
        except:
            try:
                args.append(float(line))
            except:
                args.append(line)

# Call solution and print result
result = solution(*args)
print(json.dumps(result))
`

    case 'java':
      return `
import java.util.*;
import java.io.*;

${code}

class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        List<String> lines = new ArrayList<>();
        String line;
        while ((line = br.readLine()) != null && !line.isEmpty()) {
            lines.add(line);
        }

        Solution sol = new Solution();
        // This is a simplified version - Java would need more complex parsing
        System.out.println(Arrays.toString(sol.solution(parseIntArray(lines.get(0)))));
    }

    static int[] parseIntArray(String s) {
        s = s.replaceAll("[\\\\[\\\\]]", "");
        String[] parts = s.split(",");
        int[] result = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            result[i] = Integer.parseInt(parts[i].trim());
        }
        return result;
    }
}
`

    case 'cpp':
      return `
#include <iostream>
#include <vector>
#include <string>
#include <sstream>
using namespace std;

${code}

int main() {
    string line;
    vector<string> lines;
    while (getline(cin, line)) {
        lines.push_back(line);
    }

    Solution sol;
    // Simplified - would need more complex parsing for production
    cout << "[]" << endl;
    return 0;
}
`

    case 'go':
      return `
package main

import (
    "bufio"
    "encoding/json"
    "fmt"
    "os"
)

${code}

func main() {
    scanner := bufio.NewScanner(os.Stdin)
    var lines []string
    for scanner.Scan() {
        lines = append(lines, scanner.Text())
    }

    // Parse first line as int array
    var nums []int
    json.Unmarshal([]byte(lines[0]), &nums)

    result := solution(nums)
    output, _ := json.Marshal(result)
    fmt.Println(string(output))
}
`

    default:
      return code
  }
}

export async function executeCode(
  code: string,
  language: string,
  testCases: TestCase[],
): Promise<ExecutionResult[]> {
  const languageId = LANGUAGE_IDS[language]
  if (!languageId) {
    throw new Error(`Unsupported language: ${language}`)
  }

  const results: ExecutionResult[] = []

  // Execute each test case
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]

    try {
      // Wrap the code with boilerplate
      const wrappedCode = wrapCode(code, language, testCase.input)

      // Submit the code
      const token = await submitCode({
        source_code: wrappedCode,
        language_id: languageId,
        stdin: testCase.input,
        cpu_time_limit: 5, // 5 seconds
        memory_limit: 128000, // 128MB
      })

      // Wait for result
      const judge0Result = await waitForResult(token)

      // Parse output and compare
      const actualOutput = (judge0Result.stdout || '').trim()
      const expectedOutput = testCase.expected_output.trim()
      const passed = actualOutput === expectedOutput

      // Build result
      const status: ExecutionResult['status'] =
        judge0Result.status.id === STATUS.ACCEPTED
          ? passed
            ? 'Accepted'
            : 'Wrong Answer'
          : mapStatusToResult(judge0Result.status.id)

      results.push({
        test_case_index: i,
        status,
        actual_output: actualOutput,
        expected_output: expectedOutput,
        execution_time_ms: judge0Result.time ? parseFloat(judge0Result.time) * 1000 : undefined,
        memory_kb: judge0Result.memory || undefined,
        error:
          judge0Result.stderr ||
          judge0Result.compile_output ||
          (judge0Result.status.id > STATUS.WRONG_ANSWER ? judge0Result.message || undefined : undefined),
      })
    } catch (error) {
      results.push({
        test_case_index: i,
        status: 'Runtime Error',
        expected_output: testCase.expected_output,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return results
}

export function isConfigured(): boolean {
  return Boolean(process.env.RAPIDAPI_KEY)
}
