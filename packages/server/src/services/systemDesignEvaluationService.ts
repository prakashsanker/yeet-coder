/**
 * AI-powered evaluation service for system design interviews.
 *
 * Evaluation focuses on two dimensions:
 *
 * 1. STYLE - How they approached the problem:
 *    - Clarity of thought
 *    - Structure and organization
 *    - Diagram quality
 *    - Trade-off consideration
 *
 * 2. COMPLETENESS - What they covered vs the answer key:
 *    - Did they hit the key features?
 *    - Are there major gaps?
 *    - Was each feature explored with enough detail?
 *
 * Feedback is long-form with specific examples and actionable recommendations.
 */

import { llm, type LLMModel } from './llm.js'
import {
  SYSTEM_DESIGN_PERSONA,
  buildEvaluationInstructions,
} from './interviewerPersona.js'
import type {
  TranscriptEntry,
  ExcalidrawData,
  ExcalidrawElement,
  SystemDesignFeedback,
  SystemDesignReferenceSolutions,
} from '../types/index.js'

export interface SystemDesignEvaluationInput {
  interviewId: string
  questionTitle: string
  questionDescription: string
  questionDifficulty: 'easy' | 'medium' | 'hard'
  keyConsiderations?: string[]
  referenceSolutions?: SystemDesignReferenceSolutions
  drawingData: ExcalidrawData | null
  notes: string | null
  transcript: TranscriptEntry[]
  timeSpentSeconds: number
  timeLimitSeconds: number
}

export interface SystemDesignEvaluationResult {
  // Style and Completeness ratings
  style_rating: 'strong' | 'adequate' | 'needs_improvement'
  completeness_rating: 'comprehensive' | 'adequate' | 'incomplete'

  // Legacy numeric scores for backward compatibility
  clarity_score: number
  structure_score: number
  correctness_score: number
  requirements_gathering_score: number
  system_components_score: number
  scalability_score: number
  data_model_score: number
  api_design_score: number
  trade_offs_score: number
  communication_score: number
  overall_score: number

  feedback: SystemDesignFeedback
}

// ============================================
// DIAGRAM HELPERS
// ============================================

function findLabelForShape(elements: ExcalidrawElement[], shape: ExcalidrawElement): string | null {
  const textElements = elements.filter(el => el.type === 'text')
  for (const text of textElements) {
    const textContent = (text.text || text.originalText || '') as string
    if (!textContent) continue
    const margin = 50
    if (text.x >= shape.x - margin && text.x <= shape.x + (shape.width || 0) + margin &&
        text.y >= shape.y - margin && text.y <= shape.y + (shape.height || 0) + margin) {
      return textContent
    }
  }
  return null
}

function summarizeDiagram(elements: ExcalidrawElement[] | undefined): string {
  if (!elements || elements.length === 0) {
    return 'No diagram provided'
  }

  const components: string[] = []
  const allLabels: string[] = []

  for (const el of elements) {
    if (el.type === 'text') {
      const text = (el.text || el.originalText || '') as string
      if (text.trim()) allLabels.push(text.trim())
    }
  }

  for (const el of elements) {
    if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond') {
      const label = findLabelForShape(elements, el)
      if (label) components.push(label)
    }
  }

  let summary = ''
  if (components.length > 0) {
    summary += `Components: ${components.join(', ')}\n`
  } else if (allLabels.length > 0) {
    summary += `Labels: ${allLabels.join(', ')}\n`
  }

  const rectCount = elements.filter(e => e.type === 'rectangle').length
  const arrowCount = elements.filter(e => e.type === 'arrow').length
  summary += `(${rectCount} boxes, ${arrowCount} arrows, ${elements.length} total elements)`

  return summary
}

function formatTimestamp(timestamp: number): string {
  const totalSeconds = Math.floor(timestamp / 1000)
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function formatTranscript(transcript: TranscriptEntry[]): string {
  if (!transcript || transcript.length === 0) {
    return '(No transcript - candidate did not speak)'
  }
  return transcript
    .map((entry) => `[${formatTimestamp(entry.timestamp)}] ${entry.speaker.toUpperCase()}: ${entry.text}`)
    .join('\n\n')
}

function formatReferenceSolutions(solutions?: SystemDesignReferenceSolutions): string {
  // If we have a synthesized answer key, prefer that (it's curated and well-structured)
  if (solutions?.synthesized_answer_key) {
    return solutions.synthesized_answer_key
  }

  // Fallback to raw scraped solutions
  if (!solutions?.solutions || solutions.solutions.length === 0) {
    return '(No reference solution available)'
  }
  return solutions.solutions
    .map(s => `### Source: ${s.source_label}\n\n${s.solution_text}`)
    .join('\n\n---\n\n')
}

// ============================================
// EVALUATION PROMPT
// ============================================

// Build the evaluation prompt by combining the persona's grading philosophy
// with the specific output format requirements
function buildSystemDesignEvaluationPrompt(referenceSolutionText?: string): string {
  // Start with the persona's evaluation instructions (the "who" and "how")
  const personaInstructions = buildEvaluationInstructions(
    SYSTEM_DESIGN_PERSONA,
    referenceSolutionText
  )

  // Add the specific output format requirements
  const outputFormat = `

## CRITICAL CHECKLIST - EVALUATE THESE FIRST

Before rating, check if the candidate covered these MANDATORY topics:

### 0. REQUIREMENTS GATHERING (MUST DO FIRST - Skipping = "needs_improvement")

**Functional Requirements** - What the system should DO:
- [ ] Did they ask clarifying questions about features?
- [ ] Did they identify core features vs nice-to-haves?
- [ ] Did they define the scope (what's in, what's out)?
Examples: "Should users be able to edit pastes?" "Do we need user accounts?" "Should links expire?"

**Non-Functional Requirements** - HOW the system should perform:
- [ ] Did they ask about scale? (users, requests, data volume)
- [ ] Did they discuss latency requirements? (read latency, write latency)
- [ ] Did they mention availability/durability requirements? (99.9%? 99.99%?)
- [ ] Did they consider consistency vs availability trade-offs?
Examples: "How many users?" "What's acceptable latency?" "How important is data durability?"

**CRITICAL**: If they jumped straight into design without clarifying requirements → "needs_improvement" for style. No exceptions. A senior engineer ALWAYS clarifies requirements first.

Rate requirements gathering:
- "thorough": Asked about both functional AND non-functional, defined scope clearly
- "partial": Asked some questions but missed key areas (e.g., no scale discussion)
- "skipped": Jumped straight into design without clarifying

### 1. CAPACITY ESTIMATES (Required for "strong"/"comprehensive")
Search the transcript for ANY numbers related to:
- [ ] QPS/Traffic estimates (reads per second, writes per second)
- [ ] Storage estimates (GB/TB, growth rate)
- [ ] Bandwidth estimates (MB/s ingress/egress)
- [ ] Memory/Cache sizing

If they have ZERO numbers → Cannot be "comprehensive". If they only have numbers because interviewer prompted → "adequate" at best.

### 2. ID/KEY GENERATION (Required for URL shorteners, pastebins, etc.)
- [ ] Did they explain HOW unique IDs are generated?
- [ ] Did they address collision handling?
- [ ] Did they discuss trade-offs (sequential vs random, length, encoding)?

If they just said "use UUID" or "S3 handles it" without explaining → This is a gap. Probe depth.

### 3. DATABASE CHOICE JUSTIFICATION
- [ ] Did they choose a specific database?
- [ ] Did they explain WHY (not just name-drop)?
- [ ] Did they discuss alternatives and trade-offs?

### 4. SCALING STRATEGY
- [ ] Specific scaling mechanisms (not just "add servers")
- [ ] Sharding strategy if applicable
- [ ] Caching strategy with invalidation

### 5. FAILURE HANDLING
- [ ] What happens when components fail?
- [ ] Replication strategy
- [ ] Data durability approach

## FEEDBACK GUIDELINES

Your feedback must be:
1. **HARSH** - If they missed something, call it out clearly. Don't soften.
2. **SPECIFIC** - Quote their transcript: "You said X, but you should have said Y"
3. **COMPARATIVE** - Compare explicitly to the answer key: "The answer key covers X, but you missed it"
4. **QUANTITATIVE** - Count what % of the answer key they covered

For each gap, be explicit:
- "You never mentioned capacity estimates. A strong candidate would have said: 'If we have 1M users doing 10 pastes/day, that's 115 writes/sec...'"
- "You said 'just use S3' for storage but didn't explain how IDs are generated or how you'd handle the key space."

## CRITICAL: DETAILED GAP ANALYSIS

The "gaps" array is the MOST IMPORTANT part of your evaluation. For EVERY major topic in the answer key that the candidate missed or covered poorly:

1. **Quote what they said** - Copy their exact words from the transcript. If they never mentioned it, write "Not mentioned".

2. **Copy from the answer key** - In "answer_key_excerpt", DIRECTLY COPY the relevant section from the reference solution. Don't paraphrase - use the actual text so the candidate can see exactly what they missed.

3. **Give a speakable example** - In "example_good_response", write what a strong candidate would actually SAY in the interview. Make it conversational, like: "So for ID generation, I'd use a combination of timestamp and random bits - specifically a 41-bit timestamp gives us 69 years of IDs, plus a 10-bit machine ID and 12-bit sequence number. This gives us 4096 IDs per millisecond per machine with no coordination needed."

The goal is to show the candidate EXACTLY what they should have said, not just tell them they missed something.

## OUTPUT FORMAT

Return valid JSON:

{
  "style": {
    "rating": "strong" | "adequate" | "needs_improvement",
    "assessment": "<2-3 paragraph assessment - be harsh if they needed prompting or skipped structure>",
    "requirements_gathering": "thorough" | "partial" | "skipped",
    "functional_requirements_covered": true | false,
    "non_functional_requirements_covered": true | false,
    "did_capacity_estimates": true | false,
    "capacity_estimates_prompted": true | false,
    "strengths": [
      {
        "point": "<what they did well>",
        "example": "<quote from their transcript>"
      }
    ],
    "improvements": [
      {
        "point": "<what to improve>",
        "what_they_did": "<exact quote or 'They never mentioned X'>",
        "what_would_be_better": "<specific example from answer key>"
      }
    ]
  },

  "completeness": {
    "rating": "comprehensive" | "adequate" | "incomplete",
    "assessment": "<2-3 paragraph assessment - list specific topics from answer key they missed>",
    "answer_key_coverage_percent": <number 0-100>,
    "covered_well": [
      {
        "topic": "<feature/topic from answer key>",
        "detail": "<how well they covered it vs answer key>"
      }
    ],
    "gaps": [
      {
        "topic": "<feature/topic from answer key they missed>",
        "importance": "critical" | "important" | "minor",
        "what_candidate_said": "<exact quote from transcript, or 'Not mentioned' if they never addressed it>",
        "what_was_missing": "<1-2 sentence summary of the gap>",
        "answer_key_excerpt": "<DIRECT QUOTE from the answer key showing what they should have covered - copy the actual text>",
        "example_good_response": "<Concrete example of what a strong candidate would SAY in the interview, written as if they were speaking>"
      }
    ]
  },

  "recommendations": [
    {
      "title": "<short title>",
      "explanation": "<detailed explanation with specific example from answer key>",
      "example": "<concrete example of what to say>"
    }
  ],

  "summary": "<1-2 paragraph summary - be direct about whether they would pass at Google>"
}

## RATING DECISION TREE

STYLE:
- If requirements_gathering = "skipped" → "needs_improvement" (AUTOMATIC)
- If requirements_gathering = "partial" (missing functional OR non-functional) → Cannot be "strong"
- If they did NO capacity estimates → Cannot be "strong"
- If they needed prompting for capacity estimates → "adequate" at best
- If they drove the conversation unprompted with thorough requirements AND structure → Consider "strong"

COMPLETENESS:
- If answer_key_coverage_percent < 50% → "incomplete"
- If answer_key_coverage_percent 50-75% → "adequate"
- If answer_key_coverage_percent > 75% with depth → "comprehensive"
- If they missed ANY critical topic (ID generation, DB choice, caching) → Cannot be "comprehensive"

REQUIREMENTS GATHERING IS NON-NEGOTIABLE:
- A candidate who jumps into design without clarifying requirements is showing a red flag.
- Even if their design is technically correct, skipping requirements = "needs_improvement" for style.
- This is how senior engineers work - they ALWAYS clarify before designing.

DEFAULT TO LOWER RATINGS. "strong" and "comprehensive" are RARE. Most candidates are "adequate" or worse.

Remember: You're ${SYSTEM_DESIGN_PERSONA.name}, a ${SYSTEM_DESIGN_PERSONA.role} at ${SYSTEM_DESIGN_PERSONA.company}. Grade like you're deciding whether to hire this person for your team.`

  return personaInstructions + outputFormat
}

export async function evaluateSystemDesignInterview(
  input: SystemDesignEvaluationInput,
  options: { model?: LLMModel } = {}
): Promise<SystemDesignEvaluationResult> {
  const { model = 'anthropic/claude-sonnet-4' } = options

  const diagramSummary = summarizeDiagram(input.drawingData?.elements)
  const referenceSolutionText = formatReferenceSolutions(input.referenceSolutions)
  const hasReference = input.referenceSolutions?.solutions && input.referenceSolutions.solutions.length > 0

  // Build the system prompt with persona and reference solution
  const systemPrompt = buildSystemDesignEvaluationPrompt(
    hasReference ? referenceSolutionText : undefined
  )

  const userPrompt = `## QUESTION

**${input.questionTitle}** (${input.questionDifficulty})

${input.questionDescription}

${input.keyConsiderations?.length ? `**Key Considerations:**\n${input.keyConsiderations.map(c => `- ${c}`).join('\n')}` : ''}

---

## CANDIDATE'S TRANSCRIPT

${formatTranscript(input.transcript)}

---

## CANDIDATE'S DIAGRAM

${diagramSummary}

Raw elements:
\`\`\`json
${JSON.stringify(input.drawingData?.elements || [], null, 2)}
\`\`\`

---

## CANDIDATE'S NOTES

${input.notes || '(No notes)'}

---

## TIME

Spent: ${Math.floor(input.timeSpentSeconds / 60)}m ${input.timeSpentSeconds % 60}s / Limit: ${Math.floor(input.timeLimitSeconds / 60)}m

---

Please provide detailed feedback on this candidate's system design interview, evaluating their STYLE and COMPLETENESS.`

  try {
    const result = await llm.generateJSON<{
      style: SystemDesignFeedback['style'] & {
        requirements_gathering?: 'thorough' | 'partial' | 'skipped'
        functional_requirements_covered?: boolean
        non_functional_requirements_covered?: boolean
        did_capacity_estimates?: boolean
        capacity_estimates_prompted?: boolean
      }
      completeness: SystemDesignFeedback['completeness'] & {
        answer_key_coverage_percent?: number
      }
      recommendations: SystemDesignFeedback['recommendations']
      summary: string
    }>(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { model, temperature: 0.3, maxTokens: 8000 }
    )

    // Convert ratings to numeric scores for backward compatibility
    // STRICT SCORING: "adequate" is passing but not impressive, "needs_improvement" is failing
    const styleScore = result.style.rating === 'strong' ? 85 :
                       result.style.rating === 'adequate' ? 55 : 35
    const completenessScore = result.completeness.rating === 'comprehensive' ? 85 :
                              result.completeness.rating === 'adequate' ? 55 : 35
    // Completeness weighted more heavily (70%) - what you cover matters more than how you say it
    const overallScore = Math.round(styleScore * 0.3 + completenessScore * 0.7)

    // Build legacy detailed_notes from the new assessment
    const legacyNotes = {
      requirements: result.style.assessment.substring(0, 200) + '...',
      architecture: result.completeness.assessment.substring(0, 200) + '...',
      scalability: '',
      data_model: '',
      api_design: '',
      trade_offs: '',
      communication: result.style.assessment.substring(0, 200) + '...',
    }

    const feedback: SystemDesignFeedback = {
      style: {
        rating: result.style?.rating || 'adequate',
        assessment: result.style?.assessment || '',
        requirements_gathering: result.style?.requirements_gathering ?? 'skipped',
        functional_requirements_covered: result.style?.functional_requirements_covered ?? false,
        non_functional_requirements_covered: result.style?.non_functional_requirements_covered ?? false,
        did_capacity_estimates: result.style?.did_capacity_estimates ?? false,
        capacity_estimates_prompted: result.style?.capacity_estimates_prompted ?? false,
        strengths: result.style?.strengths || [],
        improvements: result.style?.improvements || []
      },
      completeness: {
        rating: result.completeness?.rating || 'adequate',
        assessment: result.completeness?.assessment || '',
        answer_key_coverage_percent: result.completeness?.answer_key_coverage_percent ?? 50,
        covered_well: result.completeness?.covered_well || [],
        // Map gaps to ensure all new fields are present
        gaps: (result.completeness?.gaps || []).map(gap => ({
          topic: gap.topic || '',
          importance: gap.importance || 'important',
          what_candidate_said: gap.what_candidate_said || 'Not mentioned',
          what_was_missing: gap.what_was_missing || '',
          answer_key_excerpt: gap.answer_key_excerpt || '',
          example_good_response: gap.example_good_response || ''
        }))
      },
      recommendations: result.recommendations || [],
      summary: result.summary || 'Evaluation completed.',

      // Legacy fields
      good_points: result.style?.strengths?.map(s => s.point) || [],
      areas_for_improvement: result.completeness?.gaps?.map(g => g.topic) || [],
      detailed_notes: legacyNotes,
      missed_components: result.completeness?.gaps?.map(g => g.topic) || [],
      study_recommendations: result.recommendations?.map(r => r.title) || [],
    }

    return {
      style_rating: result.style?.rating || 'adequate',
      completeness_rating: result.completeness?.rating || 'adequate',

      // Numeric scores for backward compatibility
      clarity_score: styleScore,
      structure_score: styleScore,
      correctness_score: completenessScore,
      requirements_gathering_score: styleScore,
      system_components_score: completenessScore,
      scalability_score: completenessScore,
      data_model_score: completenessScore,
      api_design_score: completenessScore,
      trade_offs_score: styleScore,
      communication_score: styleScore,
      overall_score: overallScore,

      feedback,
    }
  } catch (error) {
    console.error('[SYSTEM_DESIGN_EVALUATION] Error:', error)

    // Fallback evaluation
    const hasContent = (input.drawingData?.elements?.length || 0) > 0 ||
                       (input.notes?.length || 0) > 0 ||
                       (input.transcript?.length || 0) > 0

    return {
      style_rating: 'adequate',
      completeness_rating: 'adequate',
      clarity_score: 50,
      structure_score: 50,
      correctness_score: 50,
      requirements_gathering_score: 50,
      system_components_score: 50,
      scalability_score: 50,
      data_model_score: 50,
      api_design_score: 50,
      trade_offs_score: 50,
      communication_score: 50,
      overall_score: 50,
      feedback: {
        style: {
          rating: 'adequate',
          assessment: 'Unable to generate detailed feedback due to an error.',
          strengths: hasContent ? [{ point: 'Submitted work', example: 'Diagram and/or notes were provided' }] : [],
          improvements: []
        },
        completeness: {
          rating: 'adequate',
          assessment: 'Unable to compare against reference solution.',
          covered_well: [],
          gaps: []
        },
        recommendations: [
          {
            title: 'Try again',
            explanation: 'We encountered an error generating feedback. Please try submitting again.'
          }
        ],
        summary: 'Evaluation could not be completed. Please try again.',
        good_points: [],
        areas_for_improvement: [],
        detailed_notes: {
          requirements: '',
          architecture: '',
          scalability: '',
          data_model: '',
          api_design: '',
          trade_offs: '',
          communication: '',
        },
        missed_components: [],
        study_recommendations: [],
      },
    }
  }
}

export const systemDesignEvaluationService = {
  evaluate: evaluateSystemDesignInterview,
}
