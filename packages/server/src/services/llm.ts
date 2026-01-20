import OpenAI from 'openai'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

export type LLMModel =
  | 'anthropic/claude-opus-4'
  | 'anthropic/claude-sonnet-4'
  | 'openai/gpt-4o'
  | 'openai/gpt-4o-mini'
  | 'google/gemini-2.0-flash-exp:free'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMOptions {
  model?: LLMModel
  temperature?: number
  maxTokens?: number
}

const DEFAULT_MODEL: LLMModel = 'anthropic/claude-opus-4'

function getClient(): OpenAI {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set')
  }

  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': 'https://yeetcoder.com',
      'X-Title': 'YeetCoder',
    },
  })
}

export async function generateText(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<string> {
  const client = getClient()
  const { model = DEFAULT_MODEL, temperature = 0.7, maxTokens = 4096 } = options

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No content in LLM response')
  }

  return content
}

/**
 * Strip markdown code blocks from a string
 * Handles ```json ... ``` and ``` ... ``` formats
 */
function stripMarkdownCodeBlocks(content: string): string {
  let stripped = content.trim()

  // Handle ```json\n...\n``` format
  if (stripped.startsWith('```json')) {
    stripped = stripped.slice(7)
  } else if (stripped.startsWith('```')) {
    stripped = stripped.slice(3)
  }

  if (stripped.endsWith('```')) {
    stripped = stripped.slice(0, -3)
  }

  return stripped.trim()
}

export async function generateJSON<T>(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<T> {
  const client = getClient()
  const { model = DEFAULT_MODEL, temperature = 0.3, maxTokens = 4096 } = options

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No content in LLM response')
  }

  // Strip markdown code blocks if present (LLMs sometimes wrap despite instructions)
  const jsonContent = stripMarkdownCodeBlocks(content)

  try {
    return JSON.parse(jsonContent) as T
  } catch (error) {
    // Log the problematic JSON for debugging
    console.error('Failed to parse JSON from LLM. Raw content:')
    console.error(jsonContent.slice(0, 500) + '...')
    throw error
  }
}

export const llm = {
  generateText,
  generateJSON,
}
