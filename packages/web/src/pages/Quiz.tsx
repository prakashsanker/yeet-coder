import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppHeader from '../components/common/AppHeader'
import { api, type QuizSession, type QuizQuestion } from '../lib/api'

export default function Quiz() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<QuizSession | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [lastResult, setLastResult] = useState<{
    is_correct: boolean
    correct_answer: string
    explanation: string
    wrong_explanations: Record<string, string>
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSession() {
      if (!id) return
      setIsLoading(true)
      try {
        const { session } = await api.quiz.getSession(id)
        setSession(session)

        // Find the first unanswered question
        const questions = session.questions || []
        const firstUnanswered = questions.findIndex((q: QuizQuestion) => q.user_answer === null || q.user_answer === undefined)
        if (firstUnanswered >= 0) {
          setCurrentQuestionIndex(firstUnanswered)
        } else if (questions.length > 0) {
          // All answered, show the last one
          setCurrentQuestionIndex(questions.length - 1)
        }
      } catch (err) {
        console.error('Failed to load quiz session:', err)
        setError('Failed to load quiz')
      } finally {
        setIsLoading(false)
      }
    }
    loadSession()
  }, [id])

  const currentQuestion = session?.questions?.[currentQuestionIndex]
  const isAnswered = currentQuestion?.user_answer !== null && currentQuestion?.user_answer !== undefined
  const totalAnswered = session?.questions?.filter(q => q.user_answer !== null && q.user_answer !== undefined).length || 0
  const isComplete = session?.completed_at !== null && session?.completed_at !== undefined

  const handleSubmitAnswer = async () => {
    if (!session || !currentQuestion || !selectedAnswer || isSubmitting) return

    setIsSubmitting(true)
    try {
      const { result } = await api.quiz.submitAnswer(session.id, {
        question_id: currentQuestion.id,
        answer: selectedAnswer,
      })

      setLastResult(result)
      setShowResult(true)

      // Refresh session to get updated data
      const { session: updatedSession } = await api.quiz.getSession(session.id)
      setSession(updatedSession)
    } catch (err) {
      console.error('Failed to submit answer:', err)
      setError('Failed to submit answer')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNextQuestion = () => {
    setShowResult(false)
    setSelectedAnswer(null)
    setLastResult(null)

    if (currentQuestionIndex < (session?.questions?.length || 0) - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handleFinish = () => {
    navigate('/dashboard?tab=practice')
  }

  const getOptionStyle = (option: { text: string; is_correct: boolean }) => {
    if (!showResult && !isAnswered) {
      // Not answered yet
      return selectedAnswer === option.text
        ? 'border-[var(--accent-purple)] bg-[#F3E5F5]'
        : 'border-[rgba(0,0,0,0.1)] bg-white hover:border-[var(--accent-purple)]'
    }

    // Show result
    const userAnswer = isAnswered ? currentQuestion?.user_answer : selectedAnswer
    const isCorrectAnswer = option.is_correct
    const isUserSelected = option.text === userAnswer

    if (isCorrectAnswer) {
      return 'border-[#4CAF50] bg-[#E8F5E9]'
    }
    if (isUserSelected && !isCorrectAnswer) {
      return 'border-[#F44336] bg-[#FFEBEE]'
    }
    return 'border-[rgba(0,0,0,0.1)] bg-[var(--bg-section)]'
  }

  if (isLoading) {
    return (
      <div className="app-page">
        <AppHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="spinner w-8 h-8 mx-auto mb-4"></div>
            <p className="text-[var(--text-muted)]">Loading quiz...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="app-page">
        <AppHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-[var(--text-muted)] mb-4">{error || 'Quiz not found'}</p>
            <button
              onClick={() => navigate('/dashboard?tab=practice')}
              className="btn-primary"
            >
              Back to Practice
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-page">
      <AppHeader />

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              {session.topic}
            </h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              {session.difficulty.charAt(0).toUpperCase() + session.difficulty.slice(1)} - {session.question_type.replace('_', ' ')}
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard?tab=practice')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-[var(--text-muted)]">
              Question {currentQuestionIndex + 1} of {session.total_questions}
            </span>
            <span className="text-[var(--text-muted)]">
              {session.correct_count} / {totalAnswered} correct
            </span>
          </div>
          <div className="h-2 bg-[rgba(0,0,0,0.08)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent-purple)] transition-all"
              style={{ width: `${((currentQuestionIndex + 1) / session.total_questions) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        {currentQuestion && (
          <div className="card p-6 mb-6">
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-6">
              {currentQuestion.question_text}
            </h2>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => !showResult && !isAnswered && setSelectedAnswer(option.text)}
                  disabled={showResult || isAnswered}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${getOptionStyle(option)}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-sm font-medium">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="text-[var(--text-primary)]">{option.text}</span>
                    {(showResult || isAnswered) && option.is_correct && (
                      <svg className="w-5 h-5 text-[#4CAF50] ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {(showResult || isAnswered) && !option.is_correct && option.text === (isAnswered ? currentQuestion.user_answer : selectedAnswer) && (
                      <svg className="w-5 h-5 text-[#F44336] ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Explanation Card (shown after answer) */}
        {(showResult || isAnswered) && (lastResult || currentQuestion?.explanation) && (
          <div className={`card p-6 mb-6 ${
            (lastResult?.is_correct ?? currentQuestion?.is_correct) ? 'bg-[#E8F5E9]' : 'bg-[#FFF3E0]'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {(lastResult?.is_correct ?? currentQuestion?.is_correct) ? (
                <>
                  <svg className="w-5 h-5 text-[#4CAF50]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium text-[#2E7D32]">Correct!</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-[#F57C00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-medium text-[#E65100]">Not quite</span>
                </>
              )}
            </div>
            <p className="text-[var(--text-primary)]">
              {lastResult?.explanation || currentQuestion?.explanation}
            </p>

            {/* Wrong answer explanation */}
            {!(lastResult?.is_correct ?? currentQuestion?.is_correct) && (
              <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.1)]">
                <p className="text-sm text-[var(--text-muted)] mb-1">Why your answer was incorrect:</p>
                <p className="text-[var(--text-secondary)]">
                  {(lastResult?.wrong_explanations || currentQuestion?.wrong_explanations)?.[
                    (isAnswered ? currentQuestion?.user_answer : selectedAnswer) || ''
                  ] || 'This option doesn\'t correctly address the question.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {!showResult && !isAnswered ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={!selectedAnswer || isSubmitting}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="spinner w-4 h-4"></div>
                  Submitting...
                </span>
              ) : (
                'Submit Answer'
              )}
            </button>
          ) : isComplete || currentQuestionIndex >= session.total_questions - 1 ? (
            <button onClick={handleFinish} className="btn-primary">
              Finish Quiz
            </button>
          ) : (
            <button onClick={handleNextQuestion} className="btn-primary">
              Next Question
            </button>
          )}
        </div>

        {/* Quiz Complete Summary */}
        {isComplete && (
          <div className="mt-8 card p-6 text-center">
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              Quiz Complete!
            </h3>
            <p className="text-4xl font-bold text-[var(--accent-purple)] mb-2">
              {session.correct_count} / {session.total_questions}
            </p>
            <p className="text-[var(--text-muted)]">
              {Math.round((session.correct_count / session.total_questions) * 100)}% correct
            </p>
            <div className="mt-6">
              <button onClick={handleFinish} className="btn-primary">
                Back to Practice
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
