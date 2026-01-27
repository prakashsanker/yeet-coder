import OpenAI from 'openai'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY

// OpenRouter models
export type OpenRouterModel =
  | 'anthropic/claude-opus-4'
  | 'anthropic/claude-opus-4.5'
  | 'anthropic/claude-sonnet-4'
  | 'openai/gpt-4o'
  | 'openai/gpt-4o-mini'
  | 'google/gemini-2.0-flash-exp:free'

// Groq models (fast inference)
export type GroqModel =
  | 'llama-3.1-8b-instant'
  | 'llama-3.1-70b-versatile'
  | 'llama-3.3-70b-versatile'
  | 'mixtral-8x7b-32768'

export type LLMModel = OpenRouterModel | GroqModel

// Check if a model is a Groq model
function isGroqModel(model: LLMModel): model is GroqModel {
  return [
    'llama-3.1-8b-instant',
    'llama-3.1-70b-versatile',
    'llama-3.3-70b-versatile',
    'mixtral-8x7b-32768',
  ].includes(model)
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMOptions {
  model?: LLMModel
  temperature?: number
  maxTokens?: number
}

const DEFAULT_MODEL: LLMModel = 'llama-3.1-8b-instant'

function getOpenRouterClient(): OpenAI {
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

function getGroqClient(): OpenAI {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set')
  }

  return new OpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: GROQ_API_KEY,
  })
}

function getClient(model: LLMModel): OpenAI {
  if (isGroqModel(model)) {
    return getGroqClient()
  }
  return getOpenRouterClient()
}

export async function generateText(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<string> {
  const { model = DEFAULT_MODEL, temperature = 0.7, maxTokens = 4096 } = options
  const client = getClient(model)
  const provider = isGroqModel(model) ? 'Groq' : 'OpenRouter'

  console.log(`[LLM] ${provider} request started | model: ${model}`)
  const startTime = Date.now()

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  })

  const elapsed = Date.now() - startTime
  console.log(`[LLM] ${provider} response received | model: ${model} | ${elapsed}ms`)

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No content in LLM response')
  }

  return content
}

/**
 * Extract JSON from LLM response
 * Handles various formats:
 * - Pure JSON
 * - JSON wrapped in ```json ... ```
 * - Text followed by JSON (common with Claude)
 * - JSON embedded in text
 */
function extractJSON(content: string): string {
  let stripped = content.trim()

  // First, try to find JSON in markdown code blocks
  const codeBlockMatch = stripped.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    stripped = codeBlockMatch[1].trim()
  } else {
    // Handle simple ```json at start
    if (stripped.startsWith('```json')) {
      stripped = stripped.slice(7)
    } else if (stripped.startsWith('```')) {
      stripped = stripped.slice(3)
    }
    if (stripped.endsWith('```')) {
      stripped = stripped.slice(0, -3)
    }
  }

  // If still not valid JSON, try to find JSON object/array in the text
  stripped = stripped.trim()
  if (!stripped.startsWith('{') && !stripped.startsWith('[')) {
    // Try to find a JSON object
    const jsonObjectMatch = stripped.match(/(\{[\s\S]*\})/)
    if (jsonObjectMatch) {
      stripped = jsonObjectMatch[1]
    } else {
      // Try to find a JSON array
      const jsonArrayMatch = stripped.match(/(\[[\s\S]*\])/)
      if (jsonArrayMatch) {
        stripped = jsonArrayMatch[1]
      }
    }
  }

  return stripped.trim()
}

/**
 * Sanitize JSON string by escaping control characters inside string values
 * This fixes common issues with LLMs outputting raw newlines/tabs in strings
 */
function sanitizeJsonString(content: string): string {
  // Replace control characters (except already escaped ones) inside string values
  // This regex finds strings and replaces unescaped control chars within them
  return content.replace(/"([^"\\]|\\.)*"/g, (match) => {
    return match
      .replace(/[\x00-\x1F\x7F]/g, (char) => {
        // Don't double-escape if already part of an escape sequence
        const code = char.charCodeAt(0)
        switch (code) {
          case 0x08: return '\\b'
          case 0x09: return '\\t'
          case 0x0a: return '\\n'
          case 0x0c: return '\\f'
          case 0x0d: return '\\r'
          default: return `\\u${code.toString(16).padStart(4, '0')}`
        }
      })
  })
}

export async function generateJSON<T>(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<T> {
  const { model = DEFAULT_MODEL, temperature = 0.3, maxTokens = 4096 } = options
  const client = getClient(model)
  const provider = isGroqModel(model) ? 'Groq' : 'OpenRouter'

  console.log(`[LLM] ${provider} JSON request started | model: ${model}`)
  const startTime = Date.now()

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  })

  const elapsed = Date.now() - startTime
  const usage = response.usage
  const finishReason = response.choices[0]?.finish_reason
  console.log(
    `[LLM] ${provider} JSON response received | model: ${model} | ${elapsed}ms` +
      (usage ? ` | tokens: ${usage.prompt_tokens} in / ${usage.completion_tokens} out` : '') +
      ` | finish_reason: ${finishReason}`
  )

  if (finishReason === 'length') {
    console.warn(`[LLM] WARNING: Response was truncated due to max_tokens limit!`)
  }

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No content in LLM response')
  }

  // Extract JSON from response (handles text before JSON, markdown blocks, etc.)
  let jsonContent = extractJSON(content)

  // Sanitize control characters in string values (common issue with smaller models)
  jsonContent = sanitizeJsonString(jsonContent)

  try {
    return JSON.parse(jsonContent) as T
  } catch (error) {
    // Log the problematic JSON for debugging
    console.error('[LLM] Failed to parse JSON from LLM. Raw content:')
    console.error(jsonContent.slice(0, 500) + '...')
    throw error
  }
}

export const llm = {
  generateText,
  generateJSON,
}
