import { generateText, generateJSON, type LLMMessage } from './llm'

interface TranscriptEntry {
  timestamp: number
  speaker: 'user' | 'interviewer'
  text: string
}

export type ResponseDecision = 'RESPOND' | 'DONT_RESPOND'

const SHOULD_RESPOND_PROMPT = `You are analyzing a coding interview conversation. The candidate just said something and paused.
Decide if the interviewer should respond now, or stay silent and let the candidate continue.

RESPOND ONLY when:
- The candidate asks a direct question (contains "?", "what", "how", "why", "can you", "could you", "is it", "should I", etc.)
- The candidate explicitly requests help or clarification

DONT_RESPOND for everything else, including:
- Thinking out loud or explaining their approach
- Saying they're done or finished (wait for them to ask for feedback)
- Making statements or observations
- Pausing while working through the problem
- Self-talk or mumbling while problem-solving
- Incomplete or trailing off statements
- Errors or mistakes (let them discover it themselves)

Be strict: if there's no clear question mark or question word, default to DONT_RESPOND.

Output ONLY "RESPOND" or "DONT_RESPOND" with no other text.`

const INTERVIEWER_SYSTEM_PROMPT = `You are an experienced technical interviewer at a top tech company conducting a coding interview. Your role is to:

1. Be professional, encouraging, and supportive while maintaining interview standards
2. Help the candidate think through problems by asking clarifying questions
3. Provide hints when the candidate is stuck, but don't give away the solution
4. Ask about time and space complexity when they propose or complete a solution
5. Probe their understanding of edge cases
6. Keep responses concise and conversational (1-3 sentences typically)
7. Use natural speech patterns since your response will be converted to audio

Key behaviors:
- When the candidate asks clarifying questions, answer them clearly
- When they explain their approach, acknowledge it and ask probing questions
- When they're stuck, offer gentle hints (e.g., "What data structure might help here?")
- When they complete the solution, ask about complexity and potential improvements
- If they make an error, guide them to discover it rather than pointing it out directly

Remember: You're having a verbal conversation. Keep it natural and avoid overly technical language unless discussing the algorithm directly.`

const GREETING_PROMPT = `Generate a brief, warm greeting to start the coding interview. Mention you'll present a problem and encourage them to think out loud. Keep it to 2-3 sentences.`

/**
 * Determine if the interviewer should respond to the user's latest statement.
 * Uses a fast LLM call to decide based on conversational context.
 */
export async function shouldRespond(
  transcript: TranscriptEntry[],
  latestUserText: string
): Promise<ResponseDecision> {
  // Always respond if this is the first interaction
  if (transcript.length <= 1) {
    console.log('[SHOULD_RESPOND] First interaction, responding')
    return 'RESPOND'
  }

  // Build recent context (last 4 exchanges max for speed)
  const recentContext = transcript
    .slice(-4)
    .map((t) => `${t.speaker === 'user' ? 'Candidate' : 'Interviewer'}: ${t.text}`)
    .join('\n')

  const prompt = `Recent conversation:
${recentContext}

The candidate just said: "${latestUserText}"

Should the interviewer respond now?`

  try {
    console.log('[SHOULD_RESPOND] Checking if response needed for:', latestUserText.slice(0, 50))
    const startTime = Date.now()

    const response = await generateText(
      [
        { role: 'system', content: SHOULD_RESPOND_PROMPT },
        { role: 'user', content: prompt },
      ],
      {
        maxTokens: 10, // Only need one word
        temperature: 0.1, // Low temperature for consistent decisions
      }
    )

    const elapsed = Date.now() - startTime
    const decision = response.trim().toUpperCase().includes('DONT_RESPOND') ? 'DONT_RESPOND' : 'RESPOND'
    console.log(`[SHOULD_RESPOND] Decision: ${decision} (${elapsed}ms)`)

    return decision
  } catch (error) {
    console.error('[SHOULD_RESPOND] Error, defaulting to RESPOND:', error)
    // Default to responding on error
    return 'RESPOND'
  }
}

export async function getInterviewerResponse(
  transcript: TranscriptEntry[],
  currentQuestion: string,
  userCode: string
): Promise<string> {
  console.log('[INTERVIEWER] ====== GENERATING RESPONSE ======')
  console.log('[INTERVIEWER] Transcript entries:', transcript.length)

  // If no transcript, generate initial greeting
  if (transcript.length === 0) {
    console.log('[INTERVIEWER] No transcript, generating greeting')
    return generateGreeting()
  }

  // Build conversation context
  const messages: LLMMessage[] = [
    { role: 'system', content: INTERVIEWER_SYSTEM_PROMPT },
    {
      role: 'system',
      content: `Current coding problem:\n${currentQuestion || 'No problem presented yet.'}\n\nCandidate's current code:\n\`\`\`\n${userCode || 'No code written yet.'}\n\`\`\``,
    },
    ...transcript.map((entry) => ({
      role: (entry.speaker === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: entry.text,
    })),
  ]

  // Log the messages being sent
  console.log('[INTERVIEWER] Messages to LLM:')
  messages.forEach((msg, i) => {
    const preview = msg.content.length > 150 ? msg.content.slice(0, 150) + '...' : msg.content
    console.log(`[INTERVIEWER]   [${i}] ${msg.role}: ${preview}`)
  })

  try {
    const startTime = Date.now()
    const response = await generateText(messages, {
      maxTokens: 256,
      temperature: 0.7,
    })
    const elapsed = Date.now() - startTime

    console.log(`[INTERVIEWER] Response generated in ${elapsed}ms`)
    console.log('[INTERVIEWER] ================================')

    return response
  } catch (error) {
    console.error('[INTERVIEWER] Failed to generate response:', error)
    // Fallback responses
    return getFallbackResponse(transcript)
  }
}

async function generateGreeting(): Promise<string> {
  try {
    const response = await generateText(
      [
        { role: 'system', content: INTERVIEWER_SYSTEM_PROMPT },
        { role: 'user', content: GREETING_PROMPT },
      ],
      { maxTokens: 128, temperature: 0.8 }
    )
    return response
  } catch (error) {
    console.error('Failed to generate greeting:', error)
    return "Hi! Welcome to your coding interview. I'll present you with a problem, and I'd like you to think out loud as you work through it. Feel free to ask any clarifying questions."
  }
}

function getFallbackResponse(transcript: TranscriptEntry[]): string {
  const lastUserMessage = [...transcript].reverse().find((t) => t.speaker === 'user')

  if (!lastUserMessage) {
    return "I'm here to help you work through this problem. What are your initial thoughts?"
  }

  const text = lastUserMessage.text.toLowerCase()

  // Question detection
  if (text.includes('?')) {
    return "That's a good question. Let me clarify - could you be more specific about what you're asking?"
  }

  // Stuck indicators
  if (text.includes("don't know") || text.includes('stuck') || text.includes('not sure')) {
    return "No problem, let's break this down. What's the simplest case you can think of? Start there."
  }

  // Solution discussion
  if (text.includes('hash') || text.includes('array') || text.includes('loop')) {
    return 'Interesting approach. Can you walk me through the time complexity of that solution?'
  }

  // Default encouraging response
  return "I see. Can you tell me more about your thought process there?"
}

export async function generateHint(
  currentQuestion: string,
  userCode: string,
  transcript: TranscriptEntry[]
): Promise<string> {
  const hintPrompt = `Based on the problem and the candidate's current progress, generate a helpful hint that guides them toward the solution without giving it away. The hint should be 1-2 sentences.

Problem: ${currentQuestion}

Current code:
\`\`\`
${userCode}
\`\`\`

Recent conversation:
${transcript
  .slice(-4)
  .map((t) => `${t.speaker}: ${t.text}`)
  .join('\n')}`

  try {
    const response = await generateText(
      [
        { role: 'system', content: INTERVIEWER_SYSTEM_PROMPT },
        { role: 'user', content: hintPrompt },
      ],
      { maxTokens: 128, temperature: 0.7 }
    )
    return response
  } catch (error) {
    console.error('Failed to generate hint:', error)
    return 'Think about what data structure would help you look up values quickly.'
  }
}

interface ApproachAnalysis {
  isCorrectApproach: boolean
  feedback: string
  suggestedFollowUp: string
}

export async function analyzeApproach(
  currentQuestion: string,
  userCode: string,
  explanation: string
): Promise<ApproachAnalysis> {
  const analysisPrompt = `Analyze the candidate's approach to this coding problem.

Problem: ${currentQuestion}

Their code:
\`\`\`
${userCode}
\`\`\`

Their explanation: ${explanation}

Provide a brief analysis in JSON format:
{
  "isCorrectApproach": boolean,
  "feedback": "1-2 sentence assessment",
  "suggestedFollowUp": "A question to probe deeper or guide correction"
}`

  try {
    const result = await generateJSON<ApproachAnalysis>(
      [
        { role: 'system', content: INTERVIEWER_SYSTEM_PROMPT },
        { role: 'user', content: analysisPrompt },
      ],
      { maxTokens: 256, temperature: 0.5 }
    )
    return result
  } catch (error) {
    console.error('Failed to analyze approach:', error)
    return {
      isCorrectApproach: true,
      feedback: 'Your approach looks reasonable.',
      suggestedFollowUp: 'What would be the time complexity of your solution?',
    }
  }
}
