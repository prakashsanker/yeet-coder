/**
 * Quiz generation service for system design concept practice.
 *
 * Generates AI-powered questions to help users strengthen their
 * understanding of system design concepts they struggled with.
 */

import { llm, type LLMModel } from './llm.js'
import crypto from 'crypto'

export type QuestionType = 'multiple_choice' | 'true_false' | 'scenario'
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'

export interface QuizQuestion {
  question_text: string
  question_type: QuestionType
  options: Array<{ text: string; is_correct: boolean }>
  correct_answer: string
  explanation: string
  wrong_explanations: Record<string, string>
  content_hash: string
}

export interface GenerateQuestionsInput {
  topic: string
  difficulty: DifficultyLevel
  questionType: QuestionType
  count: number
  existingHashes?: string[] // Hashes of questions to avoid
}

// Topic descriptions for better question generation
const TOPIC_CONTEXT: Record<string, string> = {
  // Pattern 1
  'hashing': 'Consistent hashing, hash functions, collision handling, distributed hashing',
  'id-generation': 'UUID, Snowflake IDs, Base62 encoding, distributed ID generation, KGS',
  // Pattern 2
  'caching': 'Cache strategies, cache invalidation, LRU/LFU eviction, write-through vs write-back, CDN caching',
  'cache-invalidation': 'TTL, event-based invalidation, cache-aside pattern, write-through',
  // Pattern 3
  'message-queues': 'Producer-consumer, at-least-once delivery, exactly-once, dead letter queues, backpressure',
  'async-processing': 'Job schedulers, task queues, event-driven architecture',
  // Pattern 4
  'rate-limiting': 'Token bucket, leaky bucket, sliding window, fixed window, distributed rate limiting',
  // Pattern 5
  'real-time': 'WebSockets, long polling, Server-Sent Events, presence, heartbeats',
  'pub-sub': 'Publish-subscribe pattern, topics, subscriptions, fan-out',
  // Pattern 6
  'feed-generation': 'Fan-out on write, fan-out on read, hybrid approaches, timeline ranking',
  // Pattern 7
  'counting': 'HyperLogLog, Count-Min Sketch, approximate counting, materialized views',
  // Pattern 8
  'time-series': 'Time-series databases, downsampling, rollups, retention policies',
  // Pattern 9
  'event-streaming': 'Kafka, event sourcing, CQRS, partitioning, consumer groups',
  // Pattern 10
  'search': 'Inverted index, Elasticsearch, autocomplete, typeahead, BM25 ranking',
  // Pattern 11
  'blob-storage': 'Object storage, chunking, delta sync, CDN edge caching',
  // Pattern 12
  'collaborative-editing': 'Operational transformation, CRDTs, version vectors, conflict resolution',
  // Pattern 13
  'geo-spatial': 'Geohashing, quadtrees, R-trees, proximity search',
  // Pattern 14
  'booking': 'Distributed locking, optimistic concurrency, double-booking prevention',
  // Pattern 15
  'transactions': 'ACID, saga pattern, two-phase commit, compensating transactions',
  // Pattern 16
  'event-triggers': 'Rule engines, threshold monitoring, event-condition-action',
  // Pattern 17
  'authentication': 'JWT, OAuth, session stores, refresh tokens, MFA',
  // Pattern 18
  'ab-testing': 'Feature flags, percentage rollouts, user bucketing, statistical significance',
  // Pattern 19
  'distributed-coordination': 'Leader election, distributed locks, Raft, Paxos, ZooKeeper',
  // Pattern 20
  'batch-processing': 'MapReduce, ETL, checkpointing, idempotent migrations',
  // Generic fallbacks
  'database': 'SQL vs NoSQL, indexing, sharding, replication, consistency models',
  'scalability': 'Horizontal vs vertical scaling, load balancing, partitioning',
  'availability': 'Redundancy, failover, health checks, circuit breakers',
  'cap-theorem': 'Consistency, Availability, Partition tolerance, trade-offs',
}

function getTopicContext(topic: string): string {
  // Try exact match first
  const normalized = topic.toLowerCase().replace(/\s+/g, '-')
  if (TOPIC_CONTEXT[normalized]) {
    return TOPIC_CONTEXT[normalized]
  }

  // Try partial match
  for (const [key, value] of Object.entries(TOPIC_CONTEXT)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value
    }
  }

  // Return the topic itself as context
  return topic
}

function buildQuestionPrompt(input: GenerateQuestionsInput): string {
  const topicContext = getTopicContext(input.topic)

  const difficultyGuidelines = {
    beginner: 'Focus on basic definitions, core concepts, and simple "what is" questions. Assume the user is learning these concepts for the first time.',
    intermediate: 'Focus on when/why to use certain approaches, comparing alternatives, and applying concepts. Assume basic familiarity with the concepts.',
    advanced: 'Focus on trade-offs, edge cases, failure scenarios, and combining multiple concepts. Assume strong understanding of basics.',
  }

  const typeGuidelines = {
    multiple_choice: `Generate multiple choice questions with exactly 4 options (A, B, C, D). Only one option should be correct.

CRITICAL: All options must be semantically consistent with what the question asks:
- If asking for a "trade-off" or "disadvantage", ALL options must be trade-offs/disadvantages (not benefits)
- If asking for a "benefit" or "advantage", ALL options must be benefits (not drawbacks)
- If asking "when to use X", ALL options must be valid scenarios (not definitions)

Wrong options should be plausible alternatives that require real understanding to distinguish from the correct answer. A test-taker should not be able to eliminate options just because they're in the wrong category.

Example of BAD options for "What is a trade-off of caching?":
- A) Faster response times (WRONG - this is a benefit, not trade-off)
- B) Memory overhead (correct trade-off)

Example of GOOD options for "What is a trade-off of caching?":
- A) Cache invalidation complexity (plausible trade-off)
- B) Memory overhead (correct trade-off)
- C) Increased storage costs (plausible trade-off)
- D) Potential for stale data (plausible trade-off)`,
    true_false: `Generate true/false questions. Make the statements specific enough that they are clearly true or false, not ambiguous. Include common misconceptions as false statements.`,
    scenario: `Generate scenario-based questions that describe a real-world situation and ask what the best approach would be. Include 4 options (A, B, C, D) representing different approaches. All options should be valid approaches - the question tests which is BEST, not which is obviously wrong.`,
  }

  return `You are an expert system design interviewer creating practice questions.

## Topic
${input.topic}

## Topic Context
${topicContext}

## Difficulty Level
${input.difficulty}
${difficultyGuidelines[input.difficulty]}

## Question Type
${input.questionType}
${typeGuidelines[input.questionType]}

## Requirements
1. Generate ${input.count} unique questions about "${input.topic}"
2. Each question should test a different aspect of the topic
3. Questions should be practical and relevant to system design interviews
4. Explanations should be educational and help the user learn
5. Wrong answer explanations should explain WHY that answer is incorrect

## Output Format
Return valid JSON with the following structure:

{
  "questions": [
    {
      "question_text": "The question text",
      "options": [
        { "text": "Option A text", "is_correct": false },
        { "text": "Option B text", "is_correct": true },
        { "text": "Option C text", "is_correct": false },
        { "text": "Option D text", "is_correct": false }
      ],
      "correct_answer": "Option B text",
      "explanation": "Detailed explanation of why this is correct and what the user should learn from this",
      "wrong_explanations": {
        "Option A text": "Why this option is wrong",
        "Option C text": "Why this option is wrong",
        "Option D text": "Why this option is wrong"
      }
    }
  ]
}

${input.questionType === 'true_false' ? `
For true/false questions, use only two options:
{ "text": "True", "is_correct": true/false },
{ "text": "False", "is_correct": false/true }
` : ''}

Generate ${input.count} questions now:`
}

function generateContentHash(question: { question_text: string; topic: string }): string {
  const content = `${question.topic}:${question.question_text}`.toLowerCase()
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 16)
}

export async function generateQuizQuestions(
  input: GenerateQuestionsInput,
  options: { model?: LLMModel } = {}
): Promise<QuizQuestion[]> {
  // Use Groq with Llama for fast question generation
  const { model = 'llama-3.3-70b-versatile' } = options

  console.log(`[QUIZ] Generating ${input.count} ${input.difficulty} ${input.questionType} questions about "${input.topic}"`)

  const prompt = buildQuestionPrompt(input)

  try {
    const result = await llm.generateJSON<{
      questions: Array<{
        question_text: string
        options: Array<{ text: string; is_correct: boolean }>
        correct_answer: string
        explanation: string
        wrong_explanations: Record<string, string>
      }>
    }>(
      [
        { role: 'system', content: 'You are a system design expert creating educational quiz questions. Always return valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { model, temperature: 0.7, maxTokens: 8000 }
    )

    // Process and hash questions
    const questions: QuizQuestion[] = result.questions.map(q => {
      const hash = generateContentHash({ question_text: q.question_text, topic: input.topic })
      return {
        question_text: q.question_text,
        question_type: input.questionType,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        wrong_explanations: q.wrong_explanations || {},
        content_hash: hash,
      }
    })

    // Filter out questions with hashes that already exist
    const existingHashSet = new Set(input.existingHashes || [])
    const uniqueQuestions = questions.filter(q => !existingHashSet.has(q.content_hash))

    console.log(`[QUIZ] Generated ${uniqueQuestions.length} unique questions (${questions.length - uniqueQuestions.length} duplicates filtered)`)

    return uniqueQuestions
  } catch (error) {
    console.error('[QUIZ] Error generating questions:', error)
    throw error
  }
}

export const quizService = {
  generateQuestions: generateQuizQuestions,
}
