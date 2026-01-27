/**
 * Reference Solution Generation Service
 *
 * Generates high-quality reference solutions for system design questions using Opus 4.5.
 * Solutions are generated on-demand and cached in the database.
 */

import { generateText, type LLMMessage } from './llm.js'
import { supabase } from '../db/supabase.js'

export interface GeneratedReferenceSolution {
  content: string
  generated_at: string
  model: string
}

const REFERENCE_SOLUTION_PROMPT = `You are a senior staff engineer at a top tech company writing a comprehensive reference solution for a system design interview question.

Your solution should be structured as follows:

## 1. Requirements Clarification
- List the key functional requirements
- List the non-functional requirements (scale, latency, availability, consistency)
- Mention any assumptions you're making

## 2. High-Level Architecture
- Describe the main components of the system
- Explain how they interact
- Include a text-based diagram if helpful

## 3. Data Model
- Define the key entities and their relationships
- Discuss database choices (SQL vs NoSQL, specific technologies)
- Explain partitioning/sharding strategy if needed

## 4. API Design
- List the key API endpoints
- Show request/response formats for critical APIs
- Discuss authentication and rate limiting

## 5. Deep Dive: Core Components
- Pick 2-3 of the most critical components
- Explain them in detail including algorithms, data structures
- Discuss trade-offs and alternatives

## 6. Scalability & Performance
- How would this handle 10x, 100x the load?
- What are the bottlenecks and how to address them?
- Caching strategies, CDN usage, etc.

## 7. Reliability & Fault Tolerance
- How to handle failures?
- Replication, backups, disaster recovery
- Monitoring and alerting

## 8. Trade-offs & Alternatives
- What design decisions were made and why?
- What are the alternatives and their pros/cons?

Write in a clear, educational tone. This will be used as a learning resource for candidates to understand what a strong answer looks like.`

/**
 * Generate a reference solution using Opus 4.5
 */
export async function generateReferenceSolution(
  questionTitle: string,
  questionDescription: string,
  existingAnswerKey?: string
): Promise<string> {
  const messages: LLMMessage[] = [
    { role: 'system', content: REFERENCE_SOLUTION_PROMPT },
    {
      role: 'user',
      content: `Generate a comprehensive reference solution for the following system design interview question:

**Question: ${questionTitle}**

${questionDescription}

${existingAnswerKey ? `\n\nHere is some reference material that may be helpful:\n${existingAnswerKey.substring(0, 10000)}` : ''}

Write a detailed, well-structured reference solution that would serve as an excellent example for interview candidates to study.`,
    },
  ]

  // Use Opus 4.5 for high-quality generation
  const solution = await generateText(messages, {
    model: 'anthropic/claude-opus-4.5',
    maxTokens: 8000,
    temperature: 0.3,
  })

  return solution
}

/**
 * Get or generate reference solution for a question
 * Returns cached solution if available, otherwise generates new one
 */
export async function getOrGenerateReferenceSolution(
  questionId: string
): Promise<GeneratedReferenceSolution | null> {
  // First, fetch the question with its metadata
  const { data: question, error: fetchError } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single()

  if (fetchError || !question) {
    console.error('[ReferenceSolution] Question not found:', questionId)
    return null
  }

  // Check if we already have a generated solution
  const metadata = question.metadata as {
    reference_solutions?: {
      ai_generated_solution?: GeneratedReferenceSolution
      synthesized_answer_key?: string
      solutions?: Array<{ solution_text: string }>
    }
    key_considerations?: string[]
  } | null

  if (metadata?.reference_solutions?.ai_generated_solution) {
    console.log('[ReferenceSolution] Returning cached solution for', questionId)
    return metadata.reference_solutions.ai_generated_solution
  }

  // Generate new solution
  console.log('[ReferenceSolution] Generating new solution for', questionId)

  // Collect existing answer key material
  let existingAnswerKey = ''
  if (metadata?.reference_solutions?.synthesized_answer_key) {
    existingAnswerKey = metadata.reference_solutions.synthesized_answer_key
  } else if (metadata?.reference_solutions?.solutions) {
    existingAnswerKey = metadata.reference_solutions.solutions
      .map((s) => s.solution_text)
      .join('\n\n---\n\n')
  }

  try {
    const solutionContent = await generateReferenceSolution(
      question.title,
      question.description,
      existingAnswerKey
    )

    const generatedSolution: GeneratedReferenceSolution = {
      content: solutionContent,
      generated_at: new Date().toISOString(),
      model: 'anthropic/claude-opus-4.5',
    }

    // Save to database
    const updatedMetadata = {
      ...metadata,
      reference_solutions: {
        ...(metadata?.reference_solutions || {}),
        ai_generated_solution: generatedSolution,
      },
    }

    const { error: updateError } = await supabase
      .from('questions')
      .update({ metadata: updatedMetadata })
      .eq('id', questionId)

    if (updateError) {
      console.error('[ReferenceSolution] Failed to save solution:', updateError)
      // Still return the solution even if save failed
    } else {
      console.log('[ReferenceSolution] Saved generated solution for', questionId)
    }

    return generatedSolution
  } catch (error) {
    console.error('[ReferenceSolution] Generation failed:', error)
    return null
  }
}

/**
 * Force regenerate reference solution (even if one exists)
 */
export async function regenerateReferenceSolution(
  questionId: string
): Promise<GeneratedReferenceSolution | null> {
  // Fetch question
  const { data: question, error: fetchError } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single()

  if (fetchError || !question) {
    console.error('[ReferenceSolution] Question not found:', questionId)
    return null
  }

  const metadata = question.metadata as {
    reference_solutions?: {
      synthesized_answer_key?: string
      solutions?: Array<{ solution_text: string }>
    }
    key_considerations?: string[]
  } | null

  // Collect existing answer key material
  let existingAnswerKey = ''
  if (metadata?.reference_solutions?.synthesized_answer_key) {
    existingAnswerKey = metadata.reference_solutions.synthesized_answer_key
  } else if (metadata?.reference_solutions?.solutions) {
    existingAnswerKey = metadata.reference_solutions.solutions
      .map((s) => s.solution_text)
      .join('\n\n---\n\n')
  }

  console.log('[ReferenceSolution] Force regenerating solution for', questionId)

  try {
    const solutionContent = await generateReferenceSolution(
      question.title,
      question.description,
      existingAnswerKey
    )

    const generatedSolution: GeneratedReferenceSolution = {
      content: solutionContent,
      generated_at: new Date().toISOString(),
      model: 'anthropic/claude-opus-4.5',
    }

    // Save to database
    const updatedMetadata = {
      ...metadata,
      reference_solutions: {
        ...(metadata?.reference_solutions || {}),
        ai_generated_solution: generatedSolution,
      },
    }

    const { error: updateError } = await supabase
      .from('questions')
      .update({ metadata: updatedMetadata })
      .eq('id', questionId)

    if (updateError) {
      console.error('[ReferenceSolution] Failed to save solution:', updateError)
    } else {
      console.log('[ReferenceSolution] Saved regenerated solution for', questionId)
    }

    return generatedSolution
  } catch (error) {
    console.error('[ReferenceSolution] Regeneration failed:', error)
    return null
  }
}
