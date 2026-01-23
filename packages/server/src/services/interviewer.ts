import { generateText, generateJSON, type LLMMessage } from './llm.js'

interface TranscriptEntry {
  timestamp: number
  speaker: 'user' | 'interviewer'
  text: string
}

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

export async function getInterviewerResponse(
  transcript: TranscriptEntry[],
  currentQuestion: string,
  userCode: string
): Promise<string> {
  // If no transcript, generate initial greeting
  if (transcript.length === 0) {
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

  try {
    const response = await generateText(messages, {
      maxTokens: 256,
      temperature: 0.7,
    })

    return response
  } catch (error) {
    console.error('Failed to generate interviewer response:', error)
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
