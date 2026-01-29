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
    multiple_choice: `Generate multiple choice questions with exactly 4 options (A, B, C, D). Only one option should be correct. Make the wrong options plausible but clearly incorrect to someone who understands the concept.`,
    true_false: `Generate true/false questions. Make the statements specific enough that they are clearly true or false, not ambiguous. Include common misconceptions as false statements.`,
    scenario: `Generate scenario-based questions that describe a real-world situation and ask what the best approach would be. Include 4 options (A, B, C, D) representing different approaches.`,
  }

  return `Generate ${input.count} ${input.difficulty} ${input.questionType.replace('_', ' ')} questions about "${input.topic}" for system design interview practice.

Topic context: ${topicContext}

Difficulty: ${input.difficulty} - ${difficultyGuidelines[input.difficulty]}

Question type: ${typeGuidelines[input.questionType]}

Requirements:
- Each question tests a different aspect of the topic
- Questions are practical and interview-relevant
- Explanations are educational
- Wrong answer explanations explain WHY that answer is incorrect

CRITICAL: Respond with ONLY valid JSON. No markdown, no explanation, no text before or after. Start with { and end with }.

JSON schema:
{"questions":[{"question_text":"string","options":[{"text":"string","is_correct":boolean}],"correct_answer":"string","explanation":"string","wrong_explanations":{"option_text":"why_wrong"}}]}

${input.questionType === 'true_false' ? 'For true/false: use only "True" and "False" as option texts.' : 'Include exactly 4 options per question.'}

Output ONLY the JSON object:`
}

function generateContentHash(question: { question_text: string; topic: string }): string {
  const content = `${question.topic}:${question.question_text}`.toLowerCase()
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 16)
}

const MAX_JSON_RETRIES = 3

export async function generateQuizQuestions(
  input: GenerateQuestionsInput,
  options: { model?: LLMModel } = {}
): Promise<QuizQuestion[]> {
  // Use Groq with Llama for fast question generation
  const { model = 'llama-3.3-70b-versatile' } = options

  console.log(`[QUIZ] Generating ${input.count} ${input.difficulty} ${input.questionType} questions about "${input.topic}"`)

  const prompt = buildQuestionPrompt(input)

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_JSON_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[QUIZ] Retry attempt ${attempt}/${MAX_JSON_RETRIES}`)
      }

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
          {
            role: 'system',
            content: 'You are a system design quiz generator. Output ONLY valid JSON with no markdown formatting, no code blocks, no explanatory text. Start your response with { and end with }.'
          },
          { role: 'user', content: prompt },
        ],
        { model, temperature: 0.5, maxTokens: 8000 }
      )

      // Validate the response structure
      if (!result || !Array.isArray(result.questions) || result.questions.length === 0) {
        throw new Error('Invalid response structure: missing or empty questions array')
      }

      // Validate each question has required fields
      for (const q of result.questions) {
        if (!q.question_text || !Array.isArray(q.options) || !q.correct_answer || !q.explanation) {
          throw new Error('Invalid question structure: missing required fields')
        }
      }

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
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`[QUIZ] Attempt ${attempt} failed:`, lastError.message)

      // If it's a JSON parsing or validation error, retry
      const isRetryable =
        lastError.message.includes('JSON') ||
        lastError.message.includes('parse') ||
        lastError.message.includes('Invalid') ||
        lastError.message.includes('missing')

      if (!isRetryable || attempt === MAX_JSON_RETRIES) {
        break
      }
    }
  }

  console.error('[QUIZ] All retries failed')
  throw lastError || new Error('Failed to generate quiz questions')
}

export const quizService = {
  generateQuestions: generateQuizQuestions,
}
