/**
 * Structured Conversation Memory Service
 *
 * Manages conversation context for system design interviews by categorizing
 * messages into topics and enabling selective retrieval for reduced latency.
 */

import { generateJSON, type LLMMessage } from './llm.js'
import { estimateTokens, type TranscriptEntry } from './conversationContext.js'

// Topic categories for system design interviews
export type SystemDesignTopic =
  | 'functional_requirements'
  | 'non_functional_requirements'
  | 'capacity_estimates'
  | 'database_design'
  | 'api_design'
  | 'component_architecture'
  | 'caching_strategy'
  | 'scaling_sharding'
  | 'failure_handling'
  | 'trade_offs'
  | 'general'

// Extended transcript entry with categorization
export interface CategorizedTranscriptEntry extends TranscriptEntry {
  primaryTopic: SystemDesignTopic
  secondaryTopics?: SystemDesignTopic[]
  classificationConfidence?: number
}

// Structured memory storage
export interface StructuredConversationMemory {
  // Messages organized by topic
  topicMessages: Map<SystemDesignTopic, CategorizedTranscriptEntry[]>
  // Last N messages in chronological order (always included)
  recentMessages: CategorizedTranscriptEntry[]
  // Summaries per topic (for topics with many messages)
  topicSummaries: Map<SystemDesignTopic, string>
  // Token counts per topic
  topicTokenCounts: Map<SystemDesignTopic, number>
  // Total tokens
  totalTokens: number
}

// Query classification result
export interface QueryClassification {
  primaryTopic: SystemDesignTopic
  relatedTopics: SystemDesignTopic[]
  confidence: number
}

// Configuration
const RECENT_MESSAGES_TO_KEEP = 4
const MAX_TOPIC_TOKENS = 2000
const MAX_RELATED_TOPIC_TOKENS = 500
// const TOPIC_SUMMARY_THRESHOLD = 1500 // TODO: Summarize topic when it exceeds this

// Keyword patterns for fast classification
const TOPIC_KEYWORDS: Record<SystemDesignTopic, string[]> = {
  functional_requirements: [
    'feature', 'user can', 'should be able', 'use case', 'functionality',
    'what if', 'should we support', 'do we need', 'requirement', 'scope',
    'must have', 'nice to have', 'mvp', 'core feature', 'user story'
  ],
  non_functional_requirements: [
    'users', 'scale', 'traffic', 'latency', 'availability', 'durability',
    'consistency', 'sla', 'uptime', 'performance', 'concurrent', 'requests per',
    'reliability', 'security', 'compliance', 'gdpr'
  ],
  capacity_estimates: [
    'qps', 'requests per second', 'storage', 'bandwidth', 'memory',
    'gigabytes', 'terabytes', 'million users', 'billion', 'calculate', 'estimate',
    'peak traffic', 'daily active', 'monthly active', 'data size'
  ],
  database_design: [
    'database', 'sql', 'nosql', 'postgres', 'mysql', 'mongodb', 'cassandra',
    'dynamodb', 'schema', 'table', 'index', 'primary key', 'foreign key',
    'partition key', 'sort key', 'denormalize', 'normalize', 'join'
  ],
  api_design: [
    'api', 'endpoint', 'rest', 'graphql', 'request', 'response', 'payload',
    'http', 'get', 'post', 'put', 'delete', 'authentication', 'rate limit',
    'pagination', 'versioning', 'idempotent'
  ],
  component_architecture: [
    'service', 'microservice', 'component', 'layer', 'architecture',
    'load balancer', 'gateway', 'queue', 'worker', 'cdn', 'proxy',
    'message broker', 'kafka', 'rabbitmq', 'pub sub'
  ],
  caching_strategy: [
    'cache', 'redis', 'memcached', 'ttl', 'invalidation', 'cache aside',
    'write through', 'eviction', 'hit rate', 'hot data', 'cold data',
    'cache miss', 'warm up'
  ],
  scaling_sharding: [
    'shard', 'partition', 'horizontal', 'vertical', 'replica', 'scale out',
    'scale up', 'consistent hashing', 'rebalance', 'distribute', 'replication',
    'leader', 'follower', 'master', 'slave'
  ],
  failure_handling: [
    'failure', 'fault', 'retry', 'timeout', 'circuit breaker', 'failover',
    'backup', 'recovery', 'disaster', 'redundancy', 'heartbeat', 'health check',
    'graceful degradation', 'fallback'
  ],
  trade_offs: [
    'trade-off', 'tradeoff', 'versus', 'pros and cons', 'alternatively',
    'downside', 'advantage', 'disadvantage', 'cap theorem', 'consistency vs',
    'latency vs', 'cost vs', 'complexity vs'
  ],
  general: []
}

// Topic display names
const TOPIC_NAMES: Record<SystemDesignTopic, string> = {
  functional_requirements: 'Functional Requirements',
  non_functional_requirements: 'Non-Functional Requirements',
  capacity_estimates: 'Capacity Estimates',
  database_design: 'Database Design',
  api_design: 'API Design',
  component_architecture: 'Component Architecture',
  caching_strategy: 'Caching Strategy',
  scaling_sharding: 'Scaling & Sharding',
  failure_handling: 'Failure Handling',
  trade_offs: 'Trade-offs',
  general: 'General Discussion'
}

// Related topics for context expansion
const RELATED_TOPICS: Record<SystemDesignTopic, SystemDesignTopic[]> = {
  functional_requirements: ['non_functional_requirements', 'api_design'],
  non_functional_requirements: ['functional_requirements', 'capacity_estimates', 'scaling_sharding'],
  capacity_estimates: ['non_functional_requirements', 'database_design', 'scaling_sharding'],
  database_design: ['api_design', 'scaling_sharding', 'caching_strategy'],
  api_design: ['database_design', 'component_architecture'],
  component_architecture: ['api_design', 'caching_strategy', 'scaling_sharding'],
  caching_strategy: ['database_design', 'scaling_sharding', 'failure_handling'],
  scaling_sharding: ['database_design', 'caching_strategy', 'capacity_estimates'],
  failure_handling: ['scaling_sharding', 'caching_strategy', 'component_architecture'],
  trade_offs: ['scaling_sharding', 'database_design', 'caching_strategy'],
  general: []
}

/**
 * Create an empty structured memory instance
 */
export function createEmptyStructuredMemory(): StructuredConversationMemory {
  const memory: StructuredConversationMemory = {
    topicMessages: new Map(),
    recentMessages: [],
    topicSummaries: new Map(),
    topicTokenCounts: new Map(),
    totalTokens: 0
  }

  // Initialize all topic buckets
  const topics: SystemDesignTopic[] = [
    'functional_requirements', 'non_functional_requirements', 'capacity_estimates',
    'database_design', 'api_design', 'component_architecture', 'caching_strategy',
    'scaling_sharding', 'failure_handling', 'trade_offs', 'general'
  ]
  for (const topic of topics) {
    memory.topicMessages.set(topic, [])
    memory.topicTokenCounts.set(topic, 0)
  }

  return memory
}

/**
 * Classify a message using keyword matching (fast path)
 */
function classifyByKeywords(text: string): { topic: SystemDesignTopic; confidence: number } {
  const lowerText = text.toLowerCase()
  const scores: Record<string, number> = {}

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (topic === 'general') continue
    let matches = 0
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        matches++
      }
    }
    if (matches > 0) {
      scores[topic] = matches / keywords.length
    }
  }

  // Find best match
  let bestTopic: SystemDesignTopic = 'general'
  let bestScore = 0

  for (const [topic, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score
      bestTopic = topic as SystemDesignTopic
    }
  }

  // Confidence based on keyword match density
  const confidence = Math.min(bestScore * 5, 1) // Scale up, cap at 1

  return { topic: bestTopic, confidence }
}

/**
 * Classify a message using LLM (slow path, more accurate)
 */
async function classifyByLLM(
  text: string,
  recentContext?: CategorizedTranscriptEntry[]
): Promise<{ topic: SystemDesignTopic; confidence: number }> {
  const contextStr = recentContext
    ? recentContext.slice(-3).map(m => `${m.speaker}: ${m.text}`).join('\n')
    : ''

  const prompt = `Classify this system design interview message into ONE of these topics:
- functional_requirements (features, use cases, scope)
- non_functional_requirements (scale, latency, availability)
- capacity_estimates (QPS, storage, bandwidth calculations)
- database_design (schema, SQL/NoSQL, indexing)
- api_design (endpoints, REST, authentication)
- component_architecture (services, queues, load balancers)
- caching_strategy (Redis, TTL, invalidation)
- scaling_sharding (horizontal scaling, partitioning)
- failure_handling (retries, circuit breakers, failover)
- trade_offs (pros/cons, alternatives)
- general (greetings, clarifications, other)

${contextStr ? `Recent context:\n${contextStr}\n\n` : ''}Message to classify: "${text}"

Respond with JSON: {"topic": "topic_name", "confidence": 0.0-1.0}`

  try {
    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ]

    const result = await generateJSON<{ topic: string; confidence: number }>(messages, {
      model: 'llama-3.1-8b-instant',
      temperature: 0.1,
      maxTokens: 50
    })

    const validTopics = Object.keys(TOPIC_KEYWORDS)
    if (validTopics.includes(result.topic)) {
      return {
        topic: result.topic as SystemDesignTopic,
        confidence: result.confidence
      }
    }
  } catch (error) {
    console.error('[StructuredMemory] LLM classification failed:', error)
  }

  return { topic: 'general', confidence: 0.3 }
}

/**
 * Classify a message using hybrid approach (keyword first, LLM fallback)
 */
export async function classifyMessage(
  text: string,
  recentContext?: CategorizedTranscriptEntry[]
): Promise<{ topic: SystemDesignTopic; confidence: number }> {
  // Try keyword classification first
  const keywordResult = classifyByKeywords(text)

  if (keywordResult.confidence >= 0.4) {
    console.log(`[StructuredMemory] Keyword classification: ${keywordResult.topic} (${(keywordResult.confidence * 100).toFixed(0)}%)`)
    return keywordResult
  }

  // Fall back to LLM for ambiguous cases
  console.log(`[StructuredMemory] Using LLM classification (keyword confidence too low: ${(keywordResult.confidence * 100).toFixed(0)}%)`)
  const llmResult = await classifyByLLM(text, recentContext)
  console.log(`[StructuredMemory] LLM classification: ${llmResult.topic} (${(llmResult.confidence * 100).toFixed(0)}%)`)

  return llmResult
}

/**
 * Add a message to structured memory
 */
export async function addToStructuredMemory(
  memory: StructuredConversationMemory,
  speaker: 'user' | 'interviewer',
  text: string
): Promise<CategorizedTranscriptEntry> {
  // Classify the message
  const { topic, confidence } = await classifyMessage(text, memory.recentMessages)

  // Create categorized entry
  const entry: CategorizedTranscriptEntry = {
    timestamp: Date.now(),
    speaker,
    text,
    estimatedTokens: estimateTokens(text),
    primaryTopic: topic,
    classificationConfidence: confidence
  }

  // Add to topic bucket
  const topicMessages = memory.topicMessages.get(topic) || []
  topicMessages.push(entry)
  memory.topicMessages.set(topic, topicMessages)

  // Update topic token count
  const currentTopicTokens = memory.topicTokenCounts.get(topic) || 0
  memory.topicTokenCounts.set(topic, currentTopicTokens + (entry.estimatedTokens || 0))

  // Add to recent messages (keep last N)
  memory.recentMessages.push(entry)
  if (memory.recentMessages.length > RECENT_MESSAGES_TO_KEEP * 2) {
    memory.recentMessages = memory.recentMessages.slice(-RECENT_MESSAGES_TO_KEEP * 2)
  }

  // Update total tokens
  memory.totalTokens += entry.estimatedTokens || 0

  console.log(`[StructuredMemory] Added to ${topic}: "${text.substring(0, 50)}..." (${entry.estimatedTokens} tokens)`)

  return entry
}

/**
 * Classify a query to determine relevant topics
 */
export async function classifyQuery(text: string): Promise<QueryClassification> {
  const { topic, confidence } = await classifyMessage(text)

  // Get related topics
  const relatedTopics = RELATED_TOPICS[topic] || []

  return {
    primaryTopic: topic,
    relatedTopics,
    confidence
  }
}

/**
 * Format messages for inclusion in context
 */
function formatMessages(messages: CategorizedTranscriptEntry[]): string {
  return messages
    .map(m => `${m.speaker === 'user' ? 'Candidate' : 'Interviewer'}: ${m.text}`)
    .join('\n')
}

/**
 * Format messages within a token budget
 */
function formatMessagesWithinBudget(
  messages: CategorizedTranscriptEntry[],
  maxTokens: number
): string {
  let totalTokens = 0
  const selected: CategorizedTranscriptEntry[] = []

  // Take from most recent, working backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const tokens = msg.estimatedTokens || estimateTokens(msg.text)
    if (totalTokens + tokens > maxTokens) break
    selected.unshift(msg)
    totalTokens += tokens
  }

  return formatMessages(selected)
}

/**
 * Retrieve relevant context based on query classification
 */
export function retrieveRelevantContext(
  memory: StructuredConversationMemory,
  classification: QueryClassification
): string {
  const parts: string[] = []

  // 1. Primary topic context
  const primaryMessages = memory.topicMessages.get(classification.primaryTopic) || []
  if (primaryMessages.length > 0) {
    parts.push(`[${TOPIC_NAMES[classification.primaryTopic]}]`)

    // Check if we have a summary for this topic
    const summary = memory.topicSummaries.get(classification.primaryTopic)
    if (summary && primaryMessages.length > 10) {
      parts.push(summary)
      // Add last 3 messages from this topic
      parts.push('\nRecent:')
      parts.push(formatMessages(primaryMessages.slice(-3)))
    } else {
      // Include messages within budget
      parts.push(formatMessagesWithinBudget(primaryMessages, MAX_TOPIC_TOKENS))
    }
  }

  // 2. Related topic context (abbreviated)
  for (const relatedTopic of classification.relatedTopics.slice(0, 2)) {
    const relatedMessages = memory.topicMessages.get(relatedTopic) || []
    if (relatedMessages.length > 0) {
      parts.push('')
      parts.push(`[${TOPIC_NAMES[relatedTopic]} - Key Points]`)

      const summary = memory.topicSummaries.get(relatedTopic)
      if (summary) {
        parts.push(summary)
      } else {
        // Just last 2 messages
        parts.push(formatMessagesWithinBudget(relatedMessages, MAX_RELATED_TOPIC_TOKENS))
      }
    }
  }

  // 3. Recent conversation (always include for flow)
  const recentForContext = memory.recentMessages.slice(-RECENT_MESSAGES_TO_KEEP)
  if (recentForContext.length > 0) {
    parts.push('')
    parts.push('[Recent Conversation]')
    parts.push(formatMessages(recentForContext))
  }

  const context = parts.join('\n')
  const tokens = estimateTokens(context)
  console.log(`[StructuredMemory] Retrieved context: ${tokens} tokens (primary: ${classification.primaryTopic}, related: ${classification.relatedTopics.join(', ')})`)

  return context
}

/**
 * Get memory statistics for debugging
 */
export function getMemoryStats(memory: StructuredConversationMemory): {
  totalTokens: number
  topicCounts: Record<string, number>
  recentCount: number
} {
  const topicCounts: Record<string, number> = {}
  for (const [topic, messages] of memory.topicMessages) {
    topicCounts[topic] = messages.length
  }

  return {
    totalTokens: memory.totalTokens,
    topicCounts,
    recentCount: memory.recentMessages.length
  }
}

/**
 * Migrate existing transcript to structured memory
 */
export async function migrateToStructuredMemory(
  memory: StructuredConversationMemory,
  transcript: TranscriptEntry[]
): Promise<void> {
  console.log(`[StructuredMemory] Migrating ${transcript.length} messages to structured memory`)

  for (const entry of transcript) {
    await addToStructuredMemory(memory, entry.speaker, entry.text)
  }

  console.log(`[StructuredMemory] Migration complete. Stats:`, getMemoryStats(memory))
}
