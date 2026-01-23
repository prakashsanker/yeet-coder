/**
 * AI-powered evaluation service for system design interviews.
 * Evaluates:
 * 1. Requirements gathering - Did they clarify requirements?
 * 2. System components - Correct high-level architecture?
 * 3. Scalability - Addressed scaling concerns?
 * 4. Data model - Good schema design?
 * 5. API design - Clean API contracts?
 * 6. Trade-offs - Discussed trade-offs?
 * 7. Communication - Clear explanation?
 */

import { llm, type LLMModel } from './llm.js'
import type { TranscriptEntry, ExcalidrawData, ExcalidrawElement, SystemDesignFeedback } from '../types/index.js'

export interface SystemDesignEvaluationInput {
  // Interview data
  interviewId: string
  questionTitle: string
  questionDescription: string
  questionDifficulty: 'easy' | 'medium' | 'hard'
  keyConsiderations?: string[]

  // User's work
  drawingData: ExcalidrawData | null
  notes: string | null
  transcript: TranscriptEntry[]

  // Time metrics
  timeSpentSeconds: number
  timeLimitSeconds: number
}

export interface SystemDesignEvaluationResult {
  // Individual scores (0-100)
  requirements_gathering_score: number
  system_components_score: number
  scalability_score: number
  data_model_score: number
  api_design_score: number
  trade_offs_score: number
  communication_score: number

  // Overall
  overall_score: number

  // Detailed feedback
  feedback: SystemDesignFeedback
}

// ============================================
// DIAGRAM SUMMARIZATION HELPERS
// ============================================

/**
 * Find text elements that are likely labels for a shape
 * (text that overlaps or is very close to the shape)
 */
function findLabelForShape(elements: ExcalidrawElement[], shape: ExcalidrawElement): string | null {
  const textElements = elements.filter(el => el.type === 'text')

  for (const text of textElements) {
    const textContent = (text.text || text.originalText || '') as string
    if (!textContent) continue

    // Check if text is inside or very close to the shape
    const shapeLeft = shape.x
    const shapeRight = shape.x + (shape.width || 0)
    const shapeTop = shape.y
    const shapeBottom = shape.y + (shape.height || 0)

    const textX = text.x
    const textY = text.y

    // Text is inside shape bounds (with some margin)
    const margin = 50
    if (textX >= shapeLeft - margin && textX <= shapeRight + margin &&
        textY >= shapeTop - margin && textY <= shapeBottom + margin) {
      return textContent
    }
  }

  return null
}

/**
 * Find what component an arrow is connected to
 */
function findConnectedComponent(
  elements: ExcalidrawElement[],
  arrow: ExcalidrawElement,
  end: 'start' | 'end'
): string | null {
  const binding = end === 'start' ? arrow.startBinding : arrow.endBinding
  if (!binding?.elementId) return null

  const connectedElement = elements.find(el => el.id === binding.elementId)
  if (!connectedElement) return null

  return findLabelForShape(elements, connectedElement)
}

/**
 * Summarize the diagram for the AI to understand
 */
function summarizeDiagram(elements: ExcalidrawElement[] | undefined): string {
  if (!elements || elements.length === 0) {
    return 'No diagram provided'
  }

  const components: string[] = []
  const connections: string[] = []
  const allLabels: string[] = []

  // Collect all text labels first
  for (const el of elements) {
    if (el.type === 'text') {
      const text = (el.text || el.originalText || '') as string
      if (text.trim()) {
        allLabels.push(text.trim())
      }
    }
  }

  // Find components (shapes with labels)
  for (const el of elements) {
    if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond') {
      const label = findLabelForShape(elements, el)
      if (label) {
        components.push(label)
      }
    }
  }

  // Find connections
  for (const el of elements) {
    if (el.type === 'arrow' || el.type === 'line') {
      const fromLabel = findConnectedComponent(elements, el, 'start')
      const toLabel = findConnectedComponent(elements, el, 'end')
      if (fromLabel && toLabel) {
        connections.push(`${fromLabel} → ${toLabel}`)
      }
    }
  }

  let summary = ''

  if (components.length > 0) {
    summary += `**Components identified:** ${components.join(', ')}\n\n`
  } else if (allLabels.length > 0) {
    // Fallback: just list all text labels
    summary += `**Labels found:** ${allLabels.join(', ')}\n\n`
  }

  if (connections.length > 0) {
    summary += `**Connections:** ${connections.join('; ')}\n\n`
  }

  const rectCount = elements.filter(e => e.type === 'rectangle').length
  const arrowCount = elements.filter(e => e.type === 'arrow').length
  const textCount = elements.filter(e => e.type === 'text').length

  summary += `**Total elements:** ${elements.length} (${rectCount} rectangles, ${arrowCount} arrows, ${textCount} text labels)`

  return summary
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  try {
    const totalSeconds = Math.floor(timestamp / 1000)
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const seconds = (totalSeconds % 60).toString().padStart(2, '0')
    return `${minutes}:${seconds}`
  } catch {
    return String(timestamp)
  }
}

function formatTranscript(transcript: TranscriptEntry[]): string {
  if (!transcript || transcript.length === 0) {
    return '(No transcript available - user did not speak during the interview)'
  }

  return transcript
    .map((entry) => `[${formatTimestamp(entry.timestamp)}] ${entry.speaker.toUpperCase()}: ${entry.text}`)
    .join('\n\n')
}

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_DESIGN_EVALUATION_PROMPT = `You are an expert system design coach helping candidates improve their interview skills.
You are evaluating a practice system design interview to provide constructive feedback.

Your evaluation must be:
1. THOROUGH - Consider all aspects of system design
2. FAIR - Give credit for good ideas even if presentation was imperfect
3. CONSTRUCTIVE - Focus on helping them improve, not judging them
4. ENCOURAGING - Highlight what they did well while being honest about areas to improve
5. ACTIONABLE - Provide specific, concrete feedback they can act on

You will receive:
1. The system design question (title, description, key considerations)
2. The candidate's diagram (as JSON elements - rectangles are components, arrows are connections, text labels)
3. A summary of the diagram components and connections
4. The candidate's written notes
5. The transcript of the verbal discussion with the interviewer
6. Time spent and time limit

IMPORTANT GUIDELINES FOR INTERPRETING THE DIAGRAM:
- Rectangles/boxes typically represent system components (services, databases, caches)
- Arrows represent data flow or connections between components
- Text elements are labels or annotations
- Look for component names, not just shapes
- A simple diagram with correct components is better than a complex incorrect one

IMPORTANT GUIDELINES FOR INTERPRETING THE TRANSCRIPT:
- The transcript shows the conversation between candidate and AI interviewer
- Look for: clarifying questions, explanations, responses to probing questions
- Consider both what they said AND what they drew/wrote
- Give credit for verbal explanations even if not in the diagram

EVALUATION CRITERIA (score each 0-100):

1. REQUIREMENTS GATHERING (10% weight)
   - Did they clarify functional requirements?
   - Did they identify non-functional requirements (scale, latency, availability)?
   - Did they establish scope and make explicit assumptions?
   Scoring: 90-100 = comprehensive, asked insightful questions | 70-89 = good coverage | 50-69 = basic | 30-49 = minimal | 0-29 = none

2. SYSTEM COMPONENTS (20% weight)
   - Are the right components present for this problem?
   - Is the architecture coherent and appropriate?
   - Are responsibilities clearly defined?
   - Look for: Load balancers, app servers, databases, caches, queues, CDN, etc.
   Scoring: 90-100 = all critical components, well-organized | 70-89 = most present | 50-69 = some missing | 30-49 = major gaps | 0-29 = incomplete

3. SCALABILITY (20% weight)
   - Did they address horizontal scaling?
   - Did they discuss caching, load balancing, database scaling?
   - Did they estimate capacity requirements?
   - Look for: sharding, replication, read replicas, async processing
   Scoring: 90-100 = comprehensive with estimates | 70-89 = several strategies | 50-69 = basic "add servers" | 30-49 = minimal | 0-29 = none

4. DATA MODEL (15% weight)
   - Did they design appropriate schemas?
   - Did they justify database choices (SQL vs NoSQL)?
   - Did they consider indexing, partitioning?
   Scoring: 90-100 = well-designed, justified | 70-89 = good model | 50-69 = basic schema | 30-49 = minimal | 0-29 = none

5. API DESIGN (10% weight)
   - Did they define clear API contracts?
   - Did they consider authentication, rate limiting?
   Scoring: 90-100 = well-defined, security considered | 70-89 = clear structure | 50-69 = basic endpoints | 30-49 = minimal | 0-29 = none

6. TRADE-OFFS (15% weight)
   - Did they discuss trade-offs (consistency vs availability, cost vs performance)?
   - Did they justify their decisions?
   - Did they acknowledge limitations?
   Scoring: 90-100 = multiple trade-offs, well-justified | 70-89 = several mentioned | 50-69 = some acknowledged | 30-49 = minimal | 0-29 = none

7. COMMUNICATION (10% weight)
   - Was the explanation clear and structured?
   - Did they use the diagram effectively?
   - Did they respond well to questions?
   Scoring: 90-100 = excellent, logical flow | 70-89 = clear | 50-69 = adequate | 30-49 = unclear | 0-29 = poor

OVERALL SCORE CALCULATION:
overall = requirements*0.10 + components*0.20 + scalability*0.20 + data_model*0.15 + api*0.10 + tradeoffs*0.15 + communication*0.10

FEEDBACK PHILOSOPHY:
- Focus on LEARNING, not judgment
- Be encouraging while being honest
- Provide SPECIFIC, ACTIONABLE feedback
- Highlight what was done well to reinforce good habits
- Frame improvements as opportunities, not failures

OUTPUT FORMAT:
You must respond with valid JSON only, no other text. Use this exact structure:

{
  "requirements_gathering_score": <0-100>,
  "system_components_score": <0-100>,
  "scalability_score": <0-100>,
  "data_model_score": <0-100>,
  "api_design_score": <0-100>,
  "trade_offs_score": <0-100>,
  "communication_score": <0-100>,
  "overall_score": <0-100>,
  "feedback": {
    "summary": "<1-2 sentence overall assessment, balanced and constructive>",
    "good_points": [
      "<specific thing done well 1>",
      "<specific thing done well 2>",
      "<specific thing done well 3>"
    ],
    "areas_for_improvement": [
      "<specific, actionable improvement 1>",
      "<specific, actionable improvement 2>",
      "<specific, actionable improvement 3>"
    ],
    "detailed_notes": {
      "requirements": "<feedback on requirements gathering>",
      "architecture": "<feedback on system components>",
      "scalability": "<feedback on scalability>",
      "data_model": "<feedback on data model>",
      "api_design": "<feedback on API design>",
      "trade_offs": "<feedback on trade-offs>",
      "communication": "<feedback on communication>"
    },
    "missed_components": ["<component they should have included>"],
    "study_recommendations": ["<specific topic/resource to study>"],
    "key_takeaway": "<single most important thing to focus on for next time>"
  }
}

CRITICAL JSON FORMATTING:
- Return ONLY valid JSON
- Use double quotes for strings
- Escape special characters
- No trailing commas`

export async function evaluateSystemDesignInterview(
  input: SystemDesignEvaluationInput,
  options: { model?: LLMModel } = {}
): Promise<SystemDesignEvaluationResult> {
  const { model = 'anthropic/claude-sonnet-4' } = options

  const diagramSummary = summarizeDiagram(input.drawingData?.elements)

  const userPrompt = `## System Design Question

**Title:** ${input.questionTitle}
**Difficulty:** ${input.questionDifficulty}

**Description:**
${input.questionDescription}

${input.keyConsiderations && input.keyConsiderations.length > 0
  ? `**Key Considerations:**\n${input.keyConsiderations.map(c => `- ${c}`).join('\n')}`
  : ''}

---

## Candidate's Diagram

**Diagram Summary:**
${diagramSummary}

**Raw Excalidraw Elements (for reference):**
\`\`\`json
${JSON.stringify(input.drawingData?.elements || [], null, 2)}
\`\`\`

---

## Candidate's Notes

${input.notes || 'No notes provided'}

---

## Interview Transcript

${formatTranscript(input.transcript)}

---

## Session Info

- **Time Spent:** ${Math.floor(input.timeSpentSeconds / 60)} minutes ${input.timeSpentSeconds % 60} seconds
- **Time Limit:** ${Math.floor(input.timeLimitSeconds / 60)} minutes

---

Please evaluate this system design interview and provide your assessment in the JSON format specified.`

  try {
    const result = await llm.generateJSON<SystemDesignEvaluationResult>(
      [
        { role: 'system', content: SYSTEM_DESIGN_EVALUATION_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { model, temperature: 0.3, maxTokens: 4000 }
    )

    // Validate and clamp scores
    const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)))

    // Calculate overall if missing
    let overallScore = result.overall_score
    if (typeof overallScore !== 'number') {
      overallScore = Math.round(
        result.requirements_gathering_score * 0.10 +
        result.system_components_score * 0.20 +
        result.scalability_score * 0.20 +
        result.data_model_score * 0.15 +
        result.api_design_score * 0.10 +
        result.trade_offs_score * 0.15 +
        result.communication_score * 0.10
      )
    }

    return {
      requirements_gathering_score: clampScore(result.requirements_gathering_score),
      system_components_score: clampScore(result.system_components_score),
      scalability_score: clampScore(result.scalability_score),
      data_model_score: clampScore(result.data_model_score),
      api_design_score: clampScore(result.api_design_score),
      trade_offs_score: clampScore(result.trade_offs_score),
      communication_score: clampScore(result.communication_score),
      overall_score: clampScore(overallScore),
      feedback: {
        summary: result.feedback?.summary || 'Evaluation completed.',
        good_points: result.feedback?.good_points || [],
        areas_for_improvement: result.feedback?.areas_for_improvement || [],
        detailed_notes: result.feedback?.detailed_notes || {
          requirements: '',
          architecture: '',
          scalability: '',
          data_model: '',
          api_design: '',
          trade_offs: '',
          communication: '',
        },
        missed_components: result.feedback?.missed_components || [],
        study_recommendations: result.feedback?.study_recommendations || [],
        key_takeaway: result.feedback?.key_takeaway || 'Keep practicing!',
      },
    }
  } catch (error) {
    console.error('[SYSTEM_DESIGN_EVALUATION] Error generating evaluation:', error)

    // Return a basic evaluation
    const hasDrawing = input.drawingData && input.drawingData.elements.length > 0
    const hasNotes = input.notes && input.notes.length > 0
    const hasTranscript = input.transcript && input.transcript.length > 0

    const baseScore = 50
    const drawingBonus = hasDrawing ? 10 : 0
    const notesBonus = hasNotes ? 5 : 0
    const transcriptBonus = hasTranscript ? 5 : 0

    const basicScore = baseScore + drawingBonus + notesBonus + transcriptBonus

    return {
      requirements_gathering_score: basicScore,
      system_components_score: basicScore,
      scalability_score: basicScore,
      data_model_score: basicScore,
      api_design_score: basicScore,
      trade_offs_score: basicScore,
      communication_score: basicScore,
      overall_score: basicScore,
      feedback: {
        summary: 'Unable to generate detailed AI feedback. Basic evaluation provided.',
        good_points: hasDrawing ? ['Created a system diagram'] : [],
        areas_for_improvement: ['Unable to generate detailed feedback'],
        detailed_notes: {
          requirements: 'Evaluation unavailable',
          architecture: 'Evaluation unavailable',
          scalability: 'Evaluation unavailable',
          data_model: 'Evaluation unavailable',
          api_design: 'Evaluation unavailable',
          trade_offs: 'Evaluation unavailable',
          communication: 'Evaluation unavailable',
        },
        missed_components: [],
        study_recommendations: ['Practice more system design problems'],
        key_takeaway: 'Keep practicing and try again!',
      },
    }
  }
}

export const systemDesignEvaluationService = {
  evaluate: evaluateSystemDesignInterview,
}
