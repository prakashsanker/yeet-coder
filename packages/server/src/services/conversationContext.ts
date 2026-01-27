/**
 * Conversation Context Management Service
 *
 * Handles token estimation and compaction for long conversations.
 * Used to manage context window limits for the Realtime API.
 */

import { generateText, type LLMMessage } from './llm.js'

export interface TranscriptEntry {
  timestamp: number
  speaker: 'user' | 'interviewer'
  text: string
  estimatedTokens?: number
}

export interface ConversationContext {
  // Summarized history (older messages compacted)
  summary?: string
  summaryTokens?: number
  // Recent messages kept verbatim
  recentMessages: TranscriptEntry[]
  recentTokens: number
  // Total estimated tokens
  totalTokens: number
}

// Token thresholds for the Realtime API
// Model has 128K context, but we reserve space for:
// - System instructions (~3K tokens)
// - Problem description (~1K tokens)
// - Current code context (~2K tokens)
// - Response generation (~2K tokens)
// So we target ~8K for conversation history
const MAX_CONVERSATION_TOKENS = 8000
const COMPACT_THRESHOLD = 6000 // Start compacting at 75% capacity
const RECENT_MESSAGES_TO_KEEP = 8 // Keep last N messages verbatim

/**
 * Estimate token count for a string
 * Uses a simple heuristic: ~4 characters per token for English text
 * This is reasonably accurate for conversational text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  // More accurate: count words and punctuation
  // Average English word is ~4-5 chars, plus spaces, ~1.3 tokens per word
  const words = text.split(/\s+/).filter(w => w.length > 0)
  return Math.ceil(words.length * 1.3)
}

/**
 * Calculate total tokens in a transcript
 */
export function calculateTranscriptTokens(transcript: TranscriptEntry[]): number {
  return transcript.reduce((sum, entry) => {
    const tokens = entry.estimatedTokens ?? estimateTokens(entry.text)
    return sum + tokens
  }, 0)
}

/**
 * Build conversation context with compaction if needed
 * Returns a context object with summary + recent messages
 */
export async function buildConversationContext(
  transcript: TranscriptEntry[]
): Promise<ConversationContext> {
  if (!transcript || transcript.length === 0) {
    return {
      recentMessages: [],
      recentTokens: 0,
      totalTokens: 0,
    }
  }

  // Add token estimates to entries that don't have them
  const entriesWithTokens = transcript.map(entry => ({
    ...entry,
    estimatedTokens: entry.estimatedTokens ?? estimateTokens(entry.text),
  }))

  const totalTokens = entriesWithTokens.reduce((sum, e) => sum + (e.estimatedTokens || 0), 0)

  // If under threshold, return all messages as recent
  if (totalTokens < COMPACT_THRESHOLD) {
    return {
      recentMessages: entriesWithTokens,
      recentTokens: totalTokens,
      totalTokens,
    }
  }

  // Need to compact - split into older (to summarize) and recent (keep verbatim)
  const recentMessages = entriesWithTokens.slice(-RECENT_MESSAGES_TO_KEEP)
  const olderMessages = entriesWithTokens.slice(0, -RECENT_MESSAGES_TO_KEEP)

  if (olderMessages.length === 0) {
    // All messages are recent
    const recentTokens = calculateTranscriptTokens(recentMessages)
    return {
      recentMessages,
      recentTokens,
      totalTokens: recentTokens,
    }
  }

  // Summarize older messages
  const summary = await summarizeConversation(olderMessages)
  const summaryTokens = estimateTokens(summary)
  const recentTokens = calculateTranscriptTokens(recentMessages)

  return {
    summary,
    summaryTokens,
    recentMessages,
    recentTokens,
    totalTokens: summaryTokens + recentTokens,
  }
}

/**
 * Summarize older conversation messages into a compact format
 * Preserves key information: requirements discussed, decisions made, issues raised
 */
async function summarizeConversation(messages: TranscriptEntry[]): Promise<string> {
  if (messages.length === 0) return ''

  // Format messages for summarization
  const formattedConversation = messages
    .map(m => `${m.speaker === 'user' ? 'Candidate' : 'Interviewer'}: ${m.text}`)
    .join('\n')

  const prompt = `Summarize this interview conversation excerpt into a concise bullet-point format.
Focus on:
- Requirements/constraints clarified
- Key design decisions discussed
- Technical trade-offs mentioned
- Any issues or concerns raised

Keep it brief - each bullet should be one line.
Do NOT include greetings or filler conversation.

Conversation:
${formattedConversation}

Summary (bullet points only):`

  try {
    const llmMessages: LLMMessage[] = [
      { role: 'system', content: 'You are a technical summarizer. Create concise bullet-point summaries.' },
      { role: 'user', content: prompt },
    ]

    const summary = await generateText(llmMessages, {
      maxTokens: 500,
      temperature: 0.3, // Low temperature for consistent summaries
    })

    return summary.trim()
  } catch (error) {
    console.error('[ConversationContext] Failed to summarize:', error)
    // Fallback: just list the last few points
    return messages
      .slice(-5)
      .map(m => `- ${m.speaker === 'user' ? 'Candidate' : 'Interviewer'}: ${m.text.substring(0, 100)}...`)
      .join('\n')
  }
}

/**
 * Format conversation context for inclusion in Realtime API instructions
 */
export function formatContextForInstructions(context: ConversationContext): string {
  const parts: string[] = []

  if (context.summary) {
    parts.push('CONVERSATION HISTORY (summarized):')
    parts.push(context.summary)
    parts.push('')
  }

  if (context.recentMessages.length > 0) {
    parts.push('RECENT CONVERSATION:')
    for (const msg of context.recentMessages) {
      const speaker = msg.speaker === 'user' ? 'Candidate' : 'Interviewer'
      parts.push(`${speaker}: ${msg.text}`)
    }
  }

  return parts.join('\n')
}

/**
 * Check if compaction is needed based on token count
 */
export function needsCompaction(transcript: TranscriptEntry[]): boolean {
  const tokens = calculateTranscriptTokens(transcript)
  return tokens >= COMPACT_THRESHOLD
}

/**
 * Get token stats for debugging/monitoring
 */
export function getTokenStats(transcript: TranscriptEntry[]): {
  totalTokens: number
  messageCount: number
  needsCompaction: boolean
  percentUsed: number
} {
  const totalTokens = calculateTranscriptTokens(transcript)
  return {
    totalTokens,
    messageCount: transcript.length,
    needsCompaction: totalTokens >= COMPACT_THRESHOLD,
    percentUsed: Math.round((totalTokens / MAX_CONVERSATION_TOKENS) * 100),
  }
}
