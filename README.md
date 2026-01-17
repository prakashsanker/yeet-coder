# YeetCoder

AI-powered coding interview practice tool with voice interaction, dynamic question generation, and performance evaluation.

## Tech Stack

| Component | Choice |
|-----------|--------|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express + TypeScript |
| Code Editor | Monaco Editor |
| Code Execution | Judge0 API (pay-per-use) |
| Voice STT | WhisperFlow |
| Voice TTS | Cartesia |
| Database | Supabase (Postgres + Auth) |
| LLM | Multi-provider (Claude, GPT-4) |
| Styling | Tailwind CSS |
| State | Zustand + React Query |

---

## Project Structure

```
/athens
├── /packages
│   ├── /web                          # React frontend
│   │   ├── /src
│   │   │   ├── /components
│   │   │   │   ├── /landing
│   │   │   │   │   ├── TopicSelectModal.tsx
│   │   │   │   │   └── WeaknessSelectModal.tsx
│   │   │   │   ├── /interview
│   │   │   │   │   ├── InterviewLayout.tsx
│   │   │   │   │   ├── QuestionPanel.tsx
│   │   │   │   │   ├── CodeEditor.tsx
│   │   │   │   │   ├── TestCasesPanel.tsx
│   │   │   │   │   ├── InterviewTimer.tsx
│   │   │   │   │   └── VoiceAvatar.tsx
│   │   │   │   ├── /evaluation
│   │   │   │   │   ├── EvaluationReport.tsx
│   │   │   │   │   └── MetricCard.tsx
│   │   │   │   └── /solution
│   │   │   │       ├── SolutionWalkthrough.tsx
│   │   │   │       ├── VariableInspector.tsx
│   │   │   │       ├── AlgorithmDiagram.tsx
│   │   │   │       └── StepControls.tsx
│   │   │   ├── /contexts
│   │   │   │   └── AuthContext.tsx
│   │   │   ├── /hooks
│   │   │   │   ├── useTimer.ts
│   │   │   │   ├── useCodeEditor.ts
│   │   │   │   └── useVoiceInteraction.ts
│   │   │   ├── /lib
│   │   │   │   ├── api.ts
│   │   │   │   └── supabase.ts
│   │   │   ├── /pages
│   │   │   │   ├── Landing.tsx
│   │   │   │   ├── Interview.tsx
│   │   │   │   ├── Evaluation.tsx
│   │   │   │   └── Solution.tsx
│   │   │   ├── /store
│   │   │   │   └── interviewStore.ts
│   │   │   └── /types
│   │   │       └── index.ts
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tailwind.config.js
│   │
│   └── /server                       # Express backend
│       ├── /src
│       │   ├── /routes
│       │   │   ├── auth.ts
│       │   │   ├── topics.ts
│       │   │   ├── interviews.ts
│       │   │   ├── questions.ts
│       │   │   ├── execution.ts
│       │   │   ├── evaluation.ts
│       │   │   └── voice.ts
│       │   ├── /services
│       │   │   ├── llm.ts
│       │   │   ├── judge0.ts
│       │   │   ├── cartesia.ts
│       │   │   ├── questionGenerator.ts
│       │   │   ├── evaluator.ts
│       │   │   └── interviewer.ts
│       │   ├── /websocket
│       │   │   ├── index.ts
│       │   │   ├── voiceHandler.ts
│       │   │   └── interviewSync.ts
│       │   ├── /middleware
│       │   │   ├── auth.ts
│       │   │   └── rateLimit.ts
│       │   ├── /db
│       │   │   └── supabase.ts
│       │   ├── /types
│       │   │   └── index.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── /supabase
│   ├── config.toml
│   ├── /migrations
│   │   └── 20240117000000_initial_schema.sql
│   └── /seed
│       └── topics.sql
│
├── package.json                      # Workspace root
├── .env.example
└── README.md
```

---

## Implementation Phases

### Phase 1: Project Setup
**Status:** 🟢 Complete

| Task | Status |
|------|--------|
| Initialize monorepo with npm workspaces | ✅ |
| Set up Vite + React + TypeScript (`/packages/web`) | ✅ |
| Set up Express + TypeScript (`/packages/server`) | ✅ |
| Configure Tailwind CSS | ✅ |
| Create database migration file | ✅ |
| Set up environment variable templates | ✅ |
| Set up Supabase CLI | ✅ |

**Files:**
- `package.json` (root)
- `packages/web/package.json`
- `packages/web/vite.config.ts`
- `packages/web/tailwind.config.js`
- `packages/server/package.json`
- `packages/server/tsconfig.json`
- `packages/server/src/index.ts`
- `packages/server/src/db/supabase.ts`
- `supabase/config.toml`
- `supabase/migrations/20240117000000_initial_schema.sql`
- `supabase/seed/topics.sql`

---

### Phase 2: Landing Page & Topics
**Status:** 🔴 Not Started

**Landing Page Design:**
```
┌─────────────────────────────────┐
│                                 │
│          YeetCoder              │
│                                 │
│   ┌─────────────────────────┐   │
│   │      Pick Topic         │   │
│   └─────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │   Test My Weaknesses    │   │
│   └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

| Task | Status |
|------|--------|
| Build Landing page (two buttons) | ⬜ |
| Build TopicSelectModal (list of all topics) | ⬜ |
| Build WeaknessSelectModal (top 3 weak topics) | ⬜ |
| Implement GET /api/topics endpoint | ⬜ |
| Implement GET /api/topics/weakest endpoint | ⬜ |
| Seed topics table with NeetCode data | ⬜ |

**Files:**
- `packages/web/src/pages/Landing.tsx`
- `packages/web/src/components/landing/TopicSelectModal.tsx`
- `packages/web/src/components/landing/WeaknessSelectModal.tsx`
- `packages/server/src/routes/topics.ts`
- `supabase/seed/topics.sql`

---

### Phase 3: Code Editor & Execution
**Status:** 🟢 Complete

| Task | Status |
|------|--------|
| Integrate Monaco Editor | ✅ |
| Build InterviewLayout (split pane) | ✅ |
| Build TestCasesPanel | ✅ |
| Build InterviewTimer (1 hour countdown) | ✅ |
| Implement Judge0 service | ✅ |
| Implement POST /api/execute endpoint | ✅ |

**Files:**
- `packages/web/src/components/interview/CodeEditor.tsx`
- `packages/web/src/components/interview/InterviewLayout.tsx`
- `packages/web/src/components/interview/TestCasesPanel.tsx`
- `packages/web/src/components/interview/InterviewTimer.tsx`
- `packages/web/src/components/interview/QuestionPanel.tsx`
- `packages/web/src/hooks/useCodeEditor.ts`
- `packages/web/src/hooks/useTimer.ts`
- `packages/web/src/pages/Interview.tsx`
- `packages/server/src/services/judge0.ts`
- `packages/server/src/routes/execution.ts`

---

### Phase 4: Question Generation
**Status:** 🔴 Not Started

| Task | Status |
|------|--------|
| Implement multi-provider LLM client | ⬜ |
| Build questionGenerator service | ⬜ |
| Implement POST /api/questions/generate | ⬜ |
| Build QuestionPanel component | ⬜ |

**Files:**
- `packages/server/src/services/llm.ts`
- `packages/server/src/services/questionGenerator.ts`
- `packages/server/src/routes/questions.ts`
- `packages/web/src/components/interview/QuestionPanel.tsx`

---

### Phase 5: Voice Integration
**Status:** 🔴 Not Started

| Task | Status |
|------|--------|
| Set up WebSocket server | ⬜ |
| Implement WhisperFlow voice handler | ⬜ |
| Implement Cartesia TTS service | ⬜ |
| Build AI interviewer service | ⬜ |
| Build VoiceAvatar component | ⬜ |
| Build useVoiceInteraction hook | ⬜ |

**Files:**
- `packages/server/src/websocket/index.ts`
- `packages/server/src/websocket/voiceHandler.ts`
- `packages/server/src/services/cartesia.ts`
- `packages/server/src/services/interviewer.ts`
- `packages/server/src/routes/voice.ts`
- `packages/web/src/components/interview/VoiceAvatar.tsx`
- `packages/web/src/hooks/useVoiceInteraction.ts`

---

### Phase 6: Interview Flow
**Status:** 🔴 Not Started

| Task | Status |
|------|--------|
| Implement interview CRUD endpoints | ⬜ |
| Build interviewStore (Zustand) | ⬜ |
| Build Interview page | ⬜ |
| Track metrics (run_count, transcript) | ⬜ |
| Implement Submit and Give Up flows | ⬜ |

**Files:**
- `packages/server/src/routes/interviews.ts`
- `packages/web/src/store/interviewStore.ts`
- `packages/web/src/pages/Interview.tsx`
- `packages/web/src/contexts/InterviewContext.tsx`

---

### Phase 7: Evaluation System
**Status:** 🔴 Not Started

| Task | Status |
|------|--------|
| Build evaluator service (AI scoring) | ⬜ |
| Implement POST /api/interviews/:id/evaluate | ⬜ |
| Build EvaluationReport component | ⬜ |
| Build MetricCard component | ⬜ |
| Build Evaluation page | ⬜ |
| Update user_topic_progress on completion | ⬜ |

**Scoring Dimensions:**
- Test case coverage
- Thought process clarity
- Clarifying questions asked
- Edge case consideration
- Time management
- Complexity analysis
- Code quality

**Files:**
- `packages/server/src/services/evaluator.ts`
- `packages/server/src/routes/evaluation.ts`
- `packages/web/src/pages/Evaluation.tsx`
- `packages/web/src/components/evaluation/EvaluationReport.tsx`
- `packages/web/src/components/evaluation/MetricCard.tsx`

---

### Phase 8: Solution Walkthrough
**Status:** 🔴 Not Started

| Task | Status |
|------|--------|
| Build solutionExplainer service | ⬜ |
| Build SolutionWalkthrough component | ⬜ |
| Build VariableInspector component | ⬜ |
| Build AlgorithmDiagram component | ⬜ |
| Build StepControls component | ⬜ |
| Build Solution page | ⬜ |

**Files:**
- `packages/server/src/services/solutionExplainer.ts`
- `packages/web/src/pages/Solution.tsx`
- `packages/web/src/components/solution/SolutionWalkthrough.tsx`
- `packages/web/src/components/solution/VariableInspector.tsx`
- `packages/web/src/components/solution/AlgorithmDiagram.tsx`
- `packages/web/src/components/solution/StepControls.tsx`

---

## API Endpoints

### Topics
```
GET    /api/topics                    # List all topics
GET    /api/topics/:id/progress       # User progress for topic
GET    /api/topics/weakest            # Get user's 3 weakest topics
```

### Questions
```
POST   /api/questions/generate        # Generate question for topic
```

### Interviews
```
POST   /api/interviews                # Start new interview
GET    /api/interviews/:id            # Get interview state
PATCH  /api/interviews/:id            # Update code, increment run count
POST   /api/interviews/:id/submit     # Submit solution (run all tests)
POST   /api/interviews/:id/end        # End interview (give up/timeout)
GET    /api/interviews                # List user's interviews
```

### Code Execution
```
POST   /api/execute                   # Run code against test cases
```

### Evaluation
```
POST   /api/interviews/:id/evaluate   # Generate AI evaluation
GET    /api/interviews/:id/evaluation # Get evaluation
```

### Voice
```
POST   /api/voice/synthesize          # Cartesia TTS
POST   /api/voice/respond             # AI interviewer response
```

### WebSocket
```
ws://server/interview/:id
  → audio_chunk                       # Client sends audio
  ← transcript                        # Server sends transcription
  ← interviewer_response              # AI response to speak
  → code_update                       # Client syncs code
  ← interview_state                   # Server syncs state
```

---

## Database Schema

```sql
-- profiles (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    username TEXT UNIQUE,
    preferred_language TEXT DEFAULT 'python',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- topics (NeetCode roadmap)
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    difficulty_order INT,
    parent_topic_id UUID REFERENCES topics(id)
);

-- user_topic_progress
CREATE TABLE user_topic_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    topic_id UUID REFERENCES topics(id),
    interviews_attempted INT DEFAULT 0,
    interviews_passed INT DEFAULT 0,
    weakness_score DECIMAL(5,2),
    UNIQUE(user_id, topic_id)
);

-- interview_sessions
CREATE TABLE interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    topic_id UUID REFERENCES topics(id),
    status TEXT CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    question_data JSONB NOT NULL,
    language TEXT NOT NULL,
    final_code TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    time_spent_seconds INT,
    run_count INT DEFAULT 0,
    submit_count INT DEFAULT 0,
    transcript JSONB DEFAULT '[]'
);

-- evaluations
CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID REFERENCES interview_sessions(id) UNIQUE,
    test_case_coverage_score INT,
    thought_process_score INT,
    clarifying_questions_score INT,
    edge_case_score INT,
    time_management_score INT,
    complexity_analysis_score INT,
    code_quality_score INT,
    overall_score INT,
    verdict TEXT CHECK (verdict IN ('PASS', 'FAIL')),
    feedback JSONB,
    solution_code TEXT,
    solution_explanation JSONB
);
```

---

## Environment Variables

### Backend (`packages/server/.env`)
```
PORT=3001
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
RAPIDAPI_KEY=
WHISPERFLOW_URL=
CARTESIA_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

### Frontend (`packages/web/.env`)
```
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

## Getting Started

```bash
# Install dependencies
yarn

# Start development servers
yarn dev

# Run backend only
yarn dev:server

# Run frontend only
yarn dev:web
```

## Database Setup (Supabase)

1. Create a project at [supabase.com](https://supabase.com)
2. Link your project:
   ```bash
   supabase link --project-ref <your-project-ref>
   # Enter your database password when prompted
   ```
3. Push migrations:
   ```bash
   yarn db:push
   ```
4. Seed the topics table (run in Supabase Dashboard → SQL Editor):
   - Copy contents of `supabase/seed/topics.sql` and execute

5. Set environment variables (see `.env.example`)

---

## Verification Checklist

- [ ] Backend health check: `GET /api/health` returns 200
- [ ] Topics load on landing page
- [ ] Question generates when topic selected
- [ ] Code executes and shows test results
- [ ] WebSocket connects for voice
- [ ] Full interview flow works end-to-end
- [ ] Evaluation report generates after submission
- [ ] Solution walkthrough steps through correctly
