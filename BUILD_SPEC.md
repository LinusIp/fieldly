# Build Spec — Adaptive Practice Platform for College Subjects

> **Working title:** Stepwise (defined once in `src/config.ts` — rename freely).
> **Audience:** the coding agent that will build this platform.
> **Status:** this document is the single source of truth. Read it fully before writing any code.

---

## Table of contents

0. Instructions for the coding agent
1. Product summary
2. Learning design
3. Adaptive engine
4. Hosting & technical constraints (GitHub Pages)
5. Tech stack
6. Repository structure & scripts
7. Content model (schemas + complete reference lesson)
8. Lesson player behaviour
9. Interactive challenge framework & challenge catalog
10. UI: pages, layout, design
11. Accessibility
12. Progress storage
13. Testing & content validation
14. Build phases (do them in order)
15. Content authoring rules
16. Syllabi for every subject
17. Final acceptance checklist

---

## 0. Instructions for the coding agent

1. **Read the whole document first.**
   - Sections 1–13 describe the product and engineering.
   - Section 14 is the build order.
   - Section 15 sets the content quality rules.
   - Section 16 is the syllabus for every subject.
2. **Build in the phase order of Section 14.**
   - Every phase ends with a working site deployed to GitHub Pages.
   - Do not start a phase until the previous phase's acceptance criteria pass.
3. **Hard constraints. Never violate these:**
   - Static site only, hosted on GitHub Pages.
   - No server, no database, no login, no paid services, no API keys.
   - All progress lives in the browser (`localStorage`), with export/import as a JSON file.
   - Every numeric answer and distractor is computed from expressions and verified by the content validator. Never hand-type a computed number into an answer option.
   - Every interactive challenge variant ships with a machine-checkable `solution`. The validator proves it passes the check for every parameter set.
   - All math is rendered with KaTeX.
4. **Ambiguity.** Choose the simplest option consistent with this document, implement it, and record it in `DECISIONS.md` (one line each: date, decision, reason).
5. **Commits.** Keep them small and phase-labelled, e.g. `phase-2: hint ladder`.
6. **Content is the product.**
   - Follow Section 15 strictly.
   - A lesson is not done until `npm run content:check` passes with zero errors.
   - Use Section 7.7 as the quality bar for every lesson.
7. **No extra features.** Do not add features outside this spec unless a phase asks for them: no social features, leaderboards, AI chat, or accounts.

---

## 1. Product summary

A **practice-first** learning platform for college subjects:

- Calculus I & II
- Physics I (Mechanics) & II (E&M)
- Linear Algebra
- Discrete Mathematics
- Data Structures & Algorithms
- Probability & Statistics

Students learn mainly by **solving problems**, not by reading.

**Core ideas**

- **Lesson shape:** short intro → chain of linked multiple-choice problems → interactive challenge → summary.
- **Chained problems.** Questions in a lesson are linked:
  - An earlier question contains a clue that helps with a later one.
  - A later question asks something *different* but uses an earlier answer as one of its parts.
  - A student who thinks critically can use the context of the whole chain to reason toward answers.
- **Explanation after every problem.** Each problem has a full written explanation, shown right after answering. All explanations are also collected in the lesson's **Explanations** tab.
- **Adaptive difficulty.** The engine aims for 70–85% success:
  - never so easy that the student is bored,
  - never so hard that they get frustrated.
  - Difficulty rises over time, across lessons and units.
- **Interactive challenges.** Hands-on tasks checked automatically: build a circuit, drag a tangent line, step through an algorithm, write code.
- **Diagnostic wrong answers.** Every wrong option corresponds to a named misconception. The platform tracks which misconceptions a student hits and shows targeted remediation.

**Target users:** first- and second-year university students studying alongside their courses. Interface language is English; SI units throughout.

---

## 2. Learning design

### 2.1 Lesson flow

```
Intro  (≤ 300 words + 1 worked example)
  ↓
Practice chain  (6 core steps; each step picks an easier/standard/harder variant adaptively)
  • after each answer → explanation panel
  • after 2 misses in a row → remediation step (if the lesson has one)
  • after 3 strong answers in a row → optional bonus step (if the lesson has one)
  ↓
Interactive challenge  (1 per lesson, 3 difficulty variants)
  ↓
Summary  (score, stars, misconceptions met, key takeaways, next lesson)

Explanations tab — available at any time; shows explanations for every step already answered.
```

### 2.2 How chains work: `uses`, `clueFor`, `establishes`

| Field | Meaning | Effect in the UI |
|---|---|---|
| `uses: [s1, s3]` | This step needs the answer or insight of earlier steps. | Shows a "↩ builds on Q1, Q3" chip. Tier-2 hint points back to those steps. |
| `clueFor: [s4]` | This step's prompt or explanation contains a clue for a later step. | Authoring aid only; checked by the validator. Not shown to students. |
| `establishes: "…"` | A short fact the step establishes. | Added to the **Facts panel** once the step is answered (right or wrong). |

**The Facts panel**
- Stays visible during the whole lesson.
- Shows lines like "Single resistor: I = 2 A through 3 Ω at 6 V".
- Students reason from established facts instead of memorising them.

Previously answered questions stay visible (collapsed, expandable) above the current question, so the student can always re-read the context.

**Chain rules** (enforced by the validator):
- Every lesson has ≥ 2 `uses` links and ≥ 1 `clueFor` link.
- The last core step uses ≥ 2 earlier steps.
- `uses` only points backwards; `clueFor` only points forwards.

### 2.3 Answering a question

- Multiple choice: **exactly 4 options, exactly 1 correct**.
- **Up to 2 attempts.**
- After a wrong first attempt:
  - the chosen option is disabled,
  - the misconception's one-line `short` text is shown (e.g. "This is what you get by multiplying V and R."),
  - the student may try again or open a hint.
- After a correct answer, or a second wrong attempt:
  - the correct option is highlighted,
  - the full explanation is shown,
  - the Facts panel updates,
  - a **Continue** button appears.
- **Hint ladder:**
  1. `nudge` — authored. Points in the right direction without formulas plus numbers.
  2. `buildsOn` — auto-generated from `uses` plus the Facts panel, e.g. "This builds on Q1: I = 2 A". An authored override is allowed.
  3. `partial` — authored. Does about half the work.
- **Keyboard:** `1`–`4` select an option, `Enter` submits or continues, `H` opens the next hint.

### 2.4 Scoring per step

| Outcome | Score |
|---|---|
| Correct on first try, no hints | 1.0 |
| Correct on first try after tier-1 hint | 0.8 |
| Correct on first try after tier-2 hint | 0.6 |
| Correct on second try, or after tier-3 hint | 0.3 |
| Wrong twice | 0.0 |

### 2.5 Difficulty bands

| Band | Meaning | Typical use |
|---|---|---|
| 1 | Recall or a single definition | `easier` variant of an early step |
| 2 | One-step application with a small twist | early chain steps |
| 3 | Two steps; combines an earlier answer | middle of chain |
| 4 | Multi-step; needs a non-obvious insight from the chain | late chain |
| 5 | Novel situation or synthesis across lessons | `harder` variants, bonus steps |

**Rules**
- For every core step: `easier.difficulty < standard.difficulty < harder.difficulty`.
- `standard` difficulty is always between 2 and 4.
- Within a lesson, `standard` difficulties are non-decreasing, roughly `2, 2, 3, 3, 4, 4`.
- Each unit has a `baseDifficulty` (2–4), which rises through a subject. A lesson's mean `standard` difficulty must be within ±0.5 of its unit's `baseDifficulty` (validator warning).
- **Net effect: the material gets harder over time, and the adaptive engine moves each student up or down within that.**

---

## 3. Adaptive engine

All engine code lives in `src/engine/` as pure, unit-tested TypeScript functions with no React imports.

### 3.1 Ratings (Elo-style)

**Student ratings**
- Each student has a rating per **concept** (slugs like `ohms-law`) and per **subject**.
- Initial subject rating: 1000.
- A new concept's rating starts at the student's current subject rating.

**Question rating** comes from its band: `D = 700 + 150 × difficulty`.
- band 1 → 850
- band 3 → 1150
- band 5 → 1450

**Expected success:** `p = 1 / (1 + 10^((D − R) / 400))`

**Update after each step** (score from §2.4):
- `R_concept ← R_concept + K × (score − p)`
  - `K = 40` for the first 10 answers in that concept, then `K = 20`.
- `R_subject ← R_subject + (K / 2) × (score − p)`

### 3.2 Variant selection

Each core step has three variants (`easier`, `standard`, `harder`). They share the same scenario, the same role in the chain, and the same `establishes` fact.

**Choose the variant whose `p` is closest to the current target:**

| Situation | Target `p` |
|---|---|
| Default | 0.78 |
| Last 2 steps both scored < 0.5 | 0.90 (and insert the remediation step for the missed step, if one exists) |
| Last 3 steps all scored ≥ 0.8 | 0.65 (and offer the bonus step, if one exists; the student may skip it) |
| Very first lesson a student opens in a subject | Force `standard` for step 1 |

Store chosen variant ids and the parameter seed in the attempt state, so a page refresh never changes the numbers or the variants.

The challenge variant is chosen by the same rule, using the challenge's `concept`.

### 3.3 Review (spaced repetition)

**Leitner boxes**
- Any step scoring < 0.6 enters box 1.
- Intervals: box 1 → 1 day, box 2 → 3 days, box 3 → 7 days, box 4 → 14 days, box 5 → 30 days, then retired.
- Review score ≥ 0.8 moves the item up a box; anything lower sends it back to box 1.

**A review session**
- Up to 10 due items, oldest first, across all subjects.
- Parameterised questions get a **new seed**, so the numbers change and the student can't answer from memory.
- Questions appear standalone, preceded by their step's `standaloneContext`. This is required for every step that has `uses`.

### 3.4 Completion, stars, mastery

- **Lesson completed:** all core steps answered and the challenge attempted.
- **Stars:**
  - ★ completed
  - ★★ mean core score ≥ 0.7
  - ★★★ mean core score ≥ 0.9 and challenge solved without the tier-3 hint
- **Concept status on the profile** (shown only after ≥ 3 answers in that concept):

  | Rating | Label |
  |---|---|
  | ≥ 1250 | Strong |
  | 1050–1249 | Developing |
  | < 1050 | Needs work |

- **Unlocking is soft.** If a lesson's prerequisites aren't completed, show a "Recommended first: …" notice with links, but keep the lesson open.

### 3.5 What "evolves over time" means on a static site

1. **Per student:**
   - concept ratings drive variant choice,
   - units get harder through the subject,
   - the review queue resurfaces weak items.
2. **Per question:** parameterised questions produce fresh numbers on every attempt and review.
3. **Content:**
   - New lessons and questions are added to the repo over time.
   - Each question has a `version`; when it increases, that question's stored history for the student is reset.
4. **Future, not v1:** cross-student analytics.
   - Implement an `AnalyticsAdapter` interface (`track(event: AnalyticsEvent): void`) with a **no-op default**, and call it at:
     - question answered,
     - hint opened,
     - challenge checked,
     - lesson completed.
   - A future backend could use these events to recalibrate question difficulty and flag confusing questions.
   - Ship v1 with the no-op only.

---

## 4. Hosting & technical constraints (GitHub Pages)

- **Hosting:** GitHub Pages, deployed with GitHub Actions on every push to `main` (workflow in §6.3).
- **Base path:**
  - The site must work as a project page at `https://<user>.github.io/<repo>/`.
  - Vite's `base` comes from the `BASE_PATH` environment variable (default `/`).
  - If the repo itself is `<user>.github.io`, `BASE_PATH` is `/`.
- **Routing:** use `HashRouter` so deep links and page refreshes work without server rewrites.
- **Shared origin:**
  - All of a user's project pages share the origin `<user>.github.io`, so `localStorage` is shared with the user's other sites.
  - Prefix **every** storage key with `APP_KEY` (e.g. `stepwise:`).
- **No secrets.** All content, including answers, ships to the client. That is acceptable for a self-study tool.
- **Performance budget:**
  - Initial JS ≤ 250 KB gzipped, excluding lazily loaded chunks.
  - The reference lesson is interactive in < 2 s on a mid-range laptop.
- **Lazy loading:**
  - per-subject content JSON,
  - each challenge type as its own chunk,
  - Pyodide only when a Python code challenge is opened.

---

## 5. Tech stack

Use current stable versions and pin them in `package.json`.

| Concern | Choice |
|---|---|
| Build | Vite + React + TypeScript (`strict: true`) |
| Styling | Tailwind CSS, with CSS variables for themes |
| Routing | React Router with `HashRouter` |
| State | Zustand for the progress store; React state for UI |
| Markdown + math | `react-markdown` + `remark-math` + `rehype-katex` (KaTeX) |
| Expressions | `mathjs`: evaluates answers, distractors, templates, check expressions |
| Content format | YAML in `content/`, parsed with `yaml`, validated with Zod at build time |
| Plots & interactive visuals | Custom SVG/Canvas components (no heavy chart library) |
| Code editor | CodeMirror 6 |
| Code execution | JavaScript in a Web Worker; Python via Pyodide (pinned version, CDN) in a Web Worker |
| Unit tests | Vitest |
| E2E smoke tests | Playwright |
| Lint/format | ESLint + Prettier |

---

## 6. Repository structure & scripts

### 6.1 Tree

```
/
├─ .github/workflows/deploy.yml
├─ BUILD_SPEC.md                 ← this file
├─ DECISIONS.md
├─ CONTENT_GUIDE.md              ← short author guide distilled from §7 and §15
├─ content/
│  ├─ subjects.yaml              ← ordered list of subject ids
│  └─ <subjectId>/
│     ├─ subject.yaml            ← metadata + units + lesson list (syllabus manifest)
│     ├─ concepts.yaml
│     ├─ misconceptions.yaml
│     └─ <unitKey>/<lessonKey>.yaml   ← e.g. content/phys2/u3/l2.yaml for id phys2.u3.l2
├─ scripts/
│  ├─ build-content.ts           ← validate, then emit public/content/index.json and public/content/<subjectId>.json
│  └─ validate-content.ts        ← all rules from §13.2 (also used by build-content)
├─ src/
│  ├─ config.ts                  ← APP_NAME, APP_KEY, defaults
│  ├─ app/                       ← routes, layout, pages
│  ├─ content/                   ← Zod schemas (shared with scripts), loaders, types
│  ├─ engine/                    ← elo.ts, select.ts, params.ts, template.ts, format.ts, scoring.ts, review.ts, expr.ts
│  ├─ player/                    ← LessonPlayer, QuestionCard, HintLadder, FactsPanel, ExplanationPanel, Summary
│  ├─ challenges/
│  │  ├─ registry.ts             ← lazy map: type → module
│  │  ├─ ChallengeHost.tsx
│  │  └─ <type>/                 ← one folder per challenge type (§9)
│  ├─ storage/                   ← progress.ts, migrations.ts, exportImport.ts
│  ├─ analytics/                 ← AnalyticsAdapter + no-op
│  ├─ components/                ← shared UI
│  └─ styles/
├─ tests/                        ← unit + e2e
└─ public/
```

### 6.2 npm scripts

| Script | Does |
|---|---|
| `dev` | `content:build` (watch mode) + `vite` |
| `content:check` | validate all content; exit non-zero on any error; print warnings |
| `content:build` | validate, then emit JSON into `public/content/` |
| `build` | `content:build` then `vite build` |
| `test` | Vitest |
| `test:e2e` | Playwright against `vite preview` |
| `lint` | ESLint + Prettier check |

### 6.3 Deploy workflow (`.github/workflows/deploy.yml`)

One-time setup in the repo: **Settings → Pages → Source: GitHub Actions**. Bump the action versions below to their latest major versions when you create the file.

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: npm
      - uses: actions/setup-python@v5        # used by the validator to run Python reference solutions
        with:
          python-version: "3.12"
      - run: npm ci
      - run: npm run lint
      - run: npm run content:check
      - run: npm test
      - run: npm run build
        env:
          BASE_PATH: /${{ github.event.repository.name }}/   # use "/" if the repo is <user>.github.io
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

---

## 7. Content model

### 7.1 Files and ids

- **Subject id:** short slug, e.g. `phys2`.
- **Unit id:** `<subject>.u<N>`, e.g. `phys2.u3`.
- **Lesson id:** `<subject>.u<N>.l<M>`, e.g. `phys2.u3.l2`.
  - Its file path must be `content/<subject>/u<N>/l<M>.yaml`.
- **Placeholder lessons:** a lesson listed in `subject.yaml` but with no file yet is shown as **"Coming soon"** (visible, not playable).

### 7.2 `subject.yaml`

```yaml
id: phys2
title: "Physics II: Electricity & Magnetism"
short: "E&M"
description: "Charges, fields, circuits, magnetism and induction."
prerequisites: [phys1, calc1]          # soft: shown as a recommendation only
units:
  - id: phys2.u3
    title: "Current & DC Circuits"
    baseDifficulty: 3
    lessons:
      - id: phys2.u3.l2
        title: "Ohm's Law and Electrical Power"
        concepts: [ohms-law, series-resistance, electric-power, parallel-resistance]
        prerequisites: [phys2.u3.l1]
```

### 7.3 `concepts.yaml` and `misconceptions.yaml`

```yaml
# concepts.yaml
- { id: ohms-law, title: "Ohm's law" }
- { id: electric-power, title: "Electrical power" }
```

```yaml
# misconceptions.yaml
- id: ohm-multiply
  short: "This is what you get by multiplying V and R."
  explain: |
    More resistance means *less* current, so $R$ must be in the denominator: $I = V/R$.
  lessons: [phys2.u3.l2]               # where to revisit (linked from the profile page)
- id: current-used-up
  short: "Current isn't used up by a resistor — energy is."
  explain: |
    Charge is conserved: every coulomb entering a resistor leaves it. What the resistor
    takes is *energy*, which is why the voltage drops across it while the current stays the same.
  lessons: [phys2.u3.l1, phys2.u3.l2]
```

### 7.4 Lesson schema (TypeScript view; implement as Zod)

```ts
type Difficulty = 1 | 2 | 3 | 4 | 5;

interface Lesson {
  id: string;                        // must match file path
  title: string;
  version: number;
  concepts: string[];                // ids from concepts.yaml
  estimatedMinutes: number;
  params?: ParamSpec;                // lesson-scoped: one draw per attempt, shared by all steps
  derived?: Record<string, string>;  // name → mathjs expression over params (and earlier derived)
  intro: string;                     // Markdown + KaTeX, ≤ 300 words
  workedExample: string;             // Markdown + KaTeX; numbers must differ from the questions'
  chain: Step[];                     // exactly 6 core steps, plus optional remediation/bonus steps
  challenge: Challenge;
  summary: { keyTakeaways: string[]; next?: string };
}

type ParamSpec =
  | { sets: Record<string, number>[] }       // PREFERRED: pick one whole set → guarantees clean numbers
  | { vars: Record<string, { values: number[] } | { min: number; max: number; step: number }> };

interface Step {
  id: string;                        // "s1", "s2", … ; remediation "r1"…, bonus "b1"…
  role: 'core' | 'remediation' | 'bonus';
  concept: string;
  uses?: string[];                   // earlier step ids
  clueFor?: string[];                // later step ids
  remediates?: string;               // required for role: remediation — the core step it supports
  establishes?: string;              // required for core steps; Markdown + templates
  standaloneContext?: string;        // required when `uses` is non-empty (review mode)
  variants: {
    easier?: Question;               // required for core
    standard: Question;              // always required
    harder?: Question;               // required for core
  };                                 // remediation and bonus steps: `standard` only
}

interface Question {
  id: string;                        // unique within the lesson, e.g. "s1-e", "s1-s", "s1-h"
  version?: number;                  // default 1
  difficulty: Difficulty;
  prompt: string;                    // Markdown + KaTeX + {{templates}}

  // EITHER computed numeric options …
  answer?: NumericOption;
  distractors?: (NumericOption & { misconception: string })[];       // exactly 3
  // … OR static options:
  options?: { text: string; correct?: true; misconception?: string }[]; // exactly 4; 1 correct; 3 tagged
  fixedOrder?: boolean;              // static options only; default false = shuffle

  verify?: { lhs: string; rhs: string; vars?: Record<string, [number, number]> }[];
  // For symbolic static answers (calculus, linear algebra): pairs of mathjs expressions
  // that must be numerically equal at 20 random points. Strongly recommended for symbolic answers.

  hints: { nudge: string; buildsOn?: string; partial: string };
  explanation: string;               // must follow the template in §15.4
}

interface NumericOption {
  expr: string;                      // mathjs expression over params + derived
  unit?: string;                     // appended as text, e.g. "A", "W", "m/s"
  sig?: number;                      // significant figures, default 3
}
```

**Templates.**
- Any `{{ expression }}` inside `prompt`, option text, hints, `establishes`, `standaloneContext`, `explanation`, `goal`, or challenge config strings is evaluated with mathjs over params + derived.
- The result is formatted by `format.ts`:
  - 3 significant figures,
  - trailing zeros trimmed,
  - integers printed as integers,
  - |x| ≥ 1e5 or 0 < |x| < 1e-3 printed in scientific form (`2.5 × 10⁻⁴` in text, `2.5 \times 10^{-4}` inside `$…$`).

**Option ordering.**
- Computed numeric options are displayed **sorted ascending**, so position gives no clue.
- Static options are shuffled per attempt (seeded) unless `fixedOrder: true`.

**YAML tip for authors.** Put LaTeX inside `|` block scalars or single-quoted strings. Never put it inside double-quoted strings, where backslashes are escape characters (`"\frac"` breaks). Inside double-quoted strings, use Unicode instead (Ω, ×, ÷, ≤, μ).

### 7.5 Challenge schema

```ts
interface Challenge {
  id: string;
  type: ChallengeType;               // key in the challenge registry (§9)
  title: string;
  concept: string;
  uses?: string[];                   // chain steps it builds on (shown as "↩ builds on" chips)
  params?: ParamSpec;                // challenge-local; if omitted, inherits the lesson's params
  derived?: Record<string, string>;
  variants: { easier: ChallengeVariant; standard: ChallengeVariant; harder: ChallengeVariant };
}

interface ChallengeVariant {
  difficulty: Difficulty;            // easier < standard < harder
  goal: string;                      // one measurable sentence; Markdown + templates
  config: unknown;                   // validated by the type's own Zod schema
  check: { expr: string };           // mathjs boolean expression over the type's check scope (§9)
  feedback?: { if: string; say: string; misconception?: string }[]; // first match shown on a failed check
  hints: { nudge: string; buildsOn?: string; partial: string };
  solution: unknown;                 // type-specific format; validator proves it passes `check`
  explanation: string;               // shown after success or "Show solution"
}
```

- **Built-in helper for check expressions:** `near(a, b, rel = 0.01)` is true when `|a − b| ≤ rel × max(|b|, 1e-9)`.
- **Challenge scoring:**

  | Outcome | Score |
  |---|---|
  | Solved without hints | 1.0 |
  | Solved after tier-1 hint | 0.8 |
  | Solved after tier-2 hint | 0.6 |
  | Solved after tier-3 hint | 0.3 |
  | Used "Show solution" | 0.0 |

- **Attempts:** unlimited. "Show solution" appears after 5 failed checks.

### 7.6 Number and unit conventions

- SI units, 3 significant figures, `Ω`, `μ` as Unicode.
- Vectors in bold or with an arrow inside KaTeX.
- Code in fenced blocks.
- DSA: Python is the primary language; JavaScript is also supported (§9, `code-runner`).

### 7.7 Complete reference lesson (the quality bar)

File: `content/phys2/u3/l2.yaml`. Implement this exactly. It is the Phase 2 test lesson and the template for all other lessons.

```yaml
id: phys2.u3.l2
title: "Ohm's Law and Electrical Power"
version: 1
concepts: [ohms-law, series-resistance, electric-power, parallel-resistance]
estimatedMinutes: 20

params:
  sets:
    - { V: 6, R: 3 }
    - { V: 12, R: 4 }
    - { V: 12, R: 6 }
derived:
  I: "V / R"
  P: "V^2 / R"

intro: |
  A battery pushes charge around a circuit; a resistor resists that flow.
  **Ohm's law** connects the three quantities:

  $$V = IR$$

  where $V$ is the voltage across the resistor (volts, V), $I$ is the current through it
  (amperes, A) and $R$ is its resistance (ohms, Ω). With the voltage fixed,
  **more resistance means less current**.

  A resistor turns electrical energy into heat. The rate at which it does so is its **power**:

  $$P = VI = I^2 R = \frac{V^2}{R}$$

  measured in watts (W). All three forms are equivalent — use the one that matches what you already know.

workedExample: |
  A 9 V battery is connected across a 4.5 Ω resistor.

  - Current: $I = V/R = 9 / 4.5 = 2$ A
  - Power: $P = VI = 9 \times 2 = 18$ W
  - Check with another form: $P = V^2/R = 81 / 4.5 = 18$ W ✓

chain:
  # ───────────────────────── s1 ─────────────────────────
  - id: s1
    role: core
    concept: ohms-law
    clueFor: [s2]
    establishes: "Single resistor: {{I}} A flows through {{R}} Ω at {{V}} V."
    variants:
      easier:
        id: s1-e
        difficulty: 1
        prompt: |
          A {{V}} V battery is connected across a {{R}} Ω resistor.
          Which calculation gives the current through the resistor?
        options:
          - { text: "I = {{V}} ÷ {{R}}", correct: true }
          - { text: "I = {{V}} × {{R}}", misconception: ohm-multiply }
          - { text: "I = {{R}} ÷ {{V}}", misconception: ohm-inverted }
          - { text: "I = {{V}} (the current equals the voltage)", misconception: current-equals-voltage }
        hints:
          nudge: "If you swapped in a bigger resistor, should the current go up or down?"
          partial: "Bigger $R$ means smaller $I$, so $R$ belongs in the denominator."
        explanation: |
          **Answer:** $I = {{V}} \div {{R}}$

          **Why:** Ohm's law is $V = IR$. Dividing both sides by $R$ gives $I = V/R$.
          Resistance *opposes* current, so it must be in the denominator.

          **Common mistakes:**
          - ${{V}} \times {{R}}$ — multiplying would make current *grow* with resistance.
          - ${{R}} \div {{V}}$ — the fraction is upside down.
          - "$I = V$" — volts and amperes measure different things; you need $R$ too.

          **Connects to:** the next question changes the resistance — keep this relationship in mind.
      standard:
        id: s1-s
        difficulty: 2
        prompt: |
          A {{V}} V battery is connected across a single {{R}} Ω resistor with ideal wires.
          What current flows through the resistor?
        answer: { expr: "V / R", unit: "A" }
        distractors:
          - { expr: "V * R", unit: "A", misconception: ohm-multiply }
          - { expr: "R / V", unit: "A", misconception: ohm-inverted }
          - { expr: "V", unit: "A", misconception: current-equals-voltage }
        hints:
          nudge: "Which quantity *limits* the current — and should it multiply or divide?"
          partial: "Rearrange $V = IR$ to get $I$ on its own."
        explanation: |
          **Answer:** {{I}} A

          **Why:** From $V = IR$, $I = V/R = {{V}} / {{R}} = {{I}}$ A.
          More resistance means less current, so $R$ divides.

          **Common mistakes:**
          - {{V*R}} A — multiplied $V$ by $R$; that would make current grow with resistance.
          - {{R/V}} A — flipped the fraction.
          - {{V}} A — copied the voltage; volts and amperes are different quantities.

          **Connects to:** the next question asks what happens when $R$ doubles.
      harder:
        id: s1-h
        difficulty: 3
        prompt: |
          A {{V}} V battery is connected across a {{R}} Ω resistor. One ammeter is placed in the wire
          *before* the resistor and another in the wire *after* it. What do they read?
        options:
          - { text: "Both read {{I}} A", correct: true }
          - { text: "Before: {{I}} A, after: 0 A", misconception: current-used-up }
          - { text: "Both read {{V}} A", misconception: current-equals-voltage }
          - { text: "Both read {{V*R}} A", misconception: ohm-multiply }
        hints:
          nudge: "Can charge pile up inside a resistor?"
          partial: "Whatever current enters the resistor must leave it. Now find that current with Ohm's law."
        explanation: |
          **Answer:** both read {{I}} A.

          **Why:** In a single loop the same current flows everywhere — charge is conserved,
          so none is "used up" in the resistor. Its value is $I = V/R = {{V}}/{{R}} = {{I}}$ A.
          What the resistor takes is *energy*, not charge.

          **Common mistakes:**
          - "0 A after" — current isn't consumed; energy is.
          - {{V}} A — that's the voltage value, not the current.
          - {{V*R}} A — multiplied instead of dividing.

          **Connects to:** the next question changes the resistance in this same circuit.

  # ───────────────────────── s2 ─────────────────────────
  - id: s2
    role: core
    concept: ohms-law
    clueFor: [s3]
    establishes: "With the same battery, doubling $R$ halves $I$."
    variants:
      easier:
        id: s2-e
        difficulty: 1
        prompt: |
          In the circuit above, {{I}} A flowed through the {{R}} Ω resistor.
          The resistor is swapped for a {{2*R}} Ω one; the battery stays the same. What current flows now?
        answer: { expr: "V / (2*R)", unit: "A" }
        distractors:
          - { expr: "2*V / R", unit: "A", misconception: ohm-multiply }
          - { expr: "V / R", unit: "A", misconception: battery-constant-current }
          - { expr: "V / (4*R)", unit: "A", misconception: square-law }
        hints:
          nudge: "Use Ohm's law again with the new resistance."
          partial: "$I = {{V}} / {{2*R}}$"
        explanation: |
          **Answer:** {{V/(2*R)}} A

          **Why:** $I = V/R = {{V}}/{{2*R}} = {{V/(2*R)}}$ A — exactly half of the {{I}} A from before.
          Same voltage, twice the opposition, half the flow.

          **Common mistakes:**
          - {{2*V/R}} A — current *rose*; that only happens if $R$ multiplies.
          - {{V/R}} A — a battery fixes the *voltage*, not the current.
          - {{V/(4*R)}} A — current is proportional to $1/R$, not $1/R^2$.

          **Connects to:** "doubling $R$ halves $I$" is exactly what you need next.
      standard:
        id: s2-s
        difficulty: 2
        prompt: |
          The {{R}} Ω resistor is replaced by one with **twice** the resistance. The battery is unchanged.
          What happens to the current?
        options:
          - { text: "It halves", correct: true }
          - { text: "It doubles", misconception: ohm-multiply }
          - { text: "It stays at {{I}} A — the battery sets the current", misconception: battery-constant-current }
          - { text: "It drops to a quarter", misconception: square-law }
        hints:
          nudge: "In $I = V/R$, what happens to a fraction when its denominator doubles?"
          partial: '$V$ is fixed by the battery; $R \to 2R$.'
        explanation: |
          **Answer:** it halves.

          **Why:** $I = V/R$. With $V$ fixed and $R \to 2R$, $I \to V/(2R) = I/2$.
          Here that is {{I}} A → {{I/2}} A.

          **Common mistakes:**
          - "Doubles" — that would require $I \propto R$.
          - "Stays the same" — a battery provides a fixed *voltage*; the current depends on the circuit.
          - "Quarter" — current depends on $1/R$, not $1/R^2$.

          **Connects to:** adding a resistor in series doubles the total resistance — use this result next.
      harder:
        id: s2-h
        difficulty: 3
        prompt: |
          Resistors A and B are each connected, one at a time, to the same {{V}} V battery.
          A draws twice the current that B draws. Which is true?
        options:
          - { text: "$R_B = 2R_A$", correct: true }
          - { text: "$R_A = 2R_B$", misconception: ohm-multiply }
          - { text: "$R_A = R_B$, because the battery is the same", misconception: battery-constant-current }
          - { text: "$R_B = 4R_A$", misconception: square-law }
        hints:
          nudge: "Same $V$ for both. Which one lets more current through?"
          partial: "$I_A = V/R_A$ and $I_B = V/R_B$, with $I_A = 2I_B$."
        explanation: |
          **Answer:** $R_B = 2R_A$.

          **Why:** With the same $V$, $I \propto 1/R$. A draws twice the current, so A has half
          the resistance: $R_B = 2R_A$.

          **Common mistakes:**
          - $R_A = 2R_B$ — more resistance gives *less* current, not more.
          - $R_A = R_B$ — the battery fixes the voltage, not the current.
          - $R_B = 4R_A$ — the relationship is inverse, not inverse-square.

          **Connects to:** next, two resistors in series — think about the total resistance.

  # ───────────────────────── s3 ─────────────────────────
  - id: s3
    role: core
    concept: series-resistance
    uses: [s1, s2]
    clueFor: [s5]
    establishes: "Two {{R}} Ω in series: total {{2*R}} Ω, current {{V/(2*R)}} A."
    standaloneContext: "A {{V}} V battery drives a single {{R}} Ω resistor, giving {{I}} A."
    variants:
      easier:
        id: s3-e
        difficulty: 2
        prompt: "Two {{R}} Ω resistors are connected in series. What is their total resistance?"
        answer: { expr: "2*R", unit: "Ω" }
        distractors:
          - { expr: "R / 2", unit: "Ω", misconception: series-parallel-confusion }
          - { expr: "R", unit: "Ω", misconception: series-no-change }
          - { expr: "R^2", unit: "Ω", misconception: multiply-resistances }
        hints:
          nudge: "In series, current must pass through *both* resistors, one after the other."
          partial: "Series resistances add: $R_{tot} = R_1 + R_2$."
        explanation: |
          **Answer:** {{2*R}} Ω

          **Why:** In series, the charge has to push through both, so the oppositions add:
          $R_{tot} = {{R}} + {{R}} = {{2*R}}$ Ω.

          **Common mistakes:**
          - {{R/2}} Ω — that's the *parallel* result.
          - {{R}} Ω — adding a resistor always changes the total.
          - {{R^2}} Ω — resistances add; they don't multiply.

          **Connects to:** doubling the resistance halves the current (Q2) — you'll use that later.
      standard:
        id: s3-s
        difficulty: 3
        prompt: |
          A second, identical {{R}} Ω resistor is added **in series** with the first, using the same
          battery. What current now flows from the battery?
        answer: { expr: "V / (2*R)", unit: "A" }
        distractors:
          - { expr: "V / R", unit: "A", misconception: series-no-change }
          - { expr: "2*V / R", unit: "A", misconception: series-parallel-confusion }
          - { expr: "V / (4*R)", unit: "A", misconception: double-halving }
        hints:
          nudge: "What is the total resistance now?"
          buildsOn: "From before: one {{R}} Ω resistor gave {{I}} A, and doubling $R$ halves $I$."
          partial: 'Series: $R_{tot} = 2 \times {{R}}$ Ω. Now apply $I = V/R_{tot}$.'
        explanation: |
          **Answer:** {{V/(2*R)}} A

          **Why:** Series resistances add: $R_{tot} = {{2*R}}$ Ω, double the original. By the result
          from Q2, doubling $R$ halves the current: {{I}} A → {{V/(2*R)}} A.

          **Common mistakes:**
          - {{V/R}} A — the extra resistor *does* reduce the current.
          - {{2*V/R}} A — that's what two resistors in *parallel* would give.
          - {{V/(4*R)}} A — the current halves once, not once per resistor.

          **Connects to:** Q5 compares the *power* of this circuit with the single resistor.
      harder:
        id: s3-h
        difficulty: 4
        prompt: |
          With the two {{R}} Ω resistors in series across the {{V}} V battery, what is the voltage
          across **each** resistor?
        answer: { expr: "V / 2", unit: "V" }
        distractors:
          - { expr: "V", unit: "V", misconception: each-gets-full-voltage }
          - { expr: "V / 4", unit: "V", misconception: double-halving }
          - { expr: "V / (2*R)", unit: "V", misconception: current-voltage-confusion }
        hints:
          nudge: "First find the current through the series pair."
          buildsOn: "The total resistance is now {{2*R}} Ω."
          partial: '$I = {{V}}/{{2*R}}$ A. Each resistor''s voltage is $I \times R$.'
        explanation: |
          **Answer:** {{V/2}} V each.

          **Why:** The current is $I = V/R_{tot} = {{V}}/{{2*R}} = {{V/(2*R)}}$ A, the same through both.
          Each resistor's voltage is $IR = {{V/(2*R)}} \times {{R}} = {{V/2}}$ V. The two drops add
          up to the battery's {{V}} V.

          **Common mistakes:**
          - {{V}} V each — in series, the voltage is *shared*.
          - {{V/4}} V — the battery voltage is split once, between two equal resistors.
          - {{V/(2*R)}} V — that number is the current, in amperes.

          **Connects to:** Q5 uses this circuit's current to find its power.

  # ───────────────────────── s4 ─────────────────────────
  - id: s4
    role: core
    concept: electric-power
    uses: [s1]
    clueFor: [s5]
    establishes: "Single {{R}} Ω resistor at {{V}} V: P = {{P}} W."
    standaloneContext: "A {{V}} V battery is connected across a single {{R}} Ω resistor, so {{I}} A flows."
    variants:
      easier:
        id: s4-e
        difficulty: 2
        prompt: |
          The single resistor from the first question has {{V}} V across it and {{I}} A through it.
          What power does it dissipate?
        answer: { expr: "V * I", unit: "W" }
        distractors:
          - { expr: "V / I", unit: "W", misconception: power-divide }
          - { expr: "V + I", unit: "W", misconception: power-add }
          - { expr: "I", unit: "W", misconception: power-is-current }
        hints:
          nudge: "Power is voltage times what?"
          partial: "$P = VI$"
        explanation: |
          **Answer:** {{P}} W

          **Why:** $P = VI = {{V}} \times {{I}} = {{P}}$ W.

          **Common mistakes:**
          - {{V/I}} — $V/I$ is the resistance (Ω), not power.
          - {{V+I}} — volts and amperes can't be added.
          - {{I}} — that's the current.

          **Connects to:** Q5 compares this power with the series circuit's.
      standard:
        id: s4-s
        difficulty: 3
        prompt: |
          Go back to the single {{R}} Ω resistor across the {{V}} V battery. At what rate does the
          resistor turn electrical energy into heat?
        answer: { expr: "V^2 / R", unit: "W" }
        distractors:
          - { expr: "V / R", unit: "W", misconception: power-is-current }
          - { expr: "V * R", unit: "W", misconception: power-formula-mixup }
          - { expr: "V", unit: "W", misconception: power-equals-voltage }
        hints:
          nudge: "Which power formula uses quantities you already know?"
          buildsOn: "From Q1: the current is {{I}} A."
          partial: "$P = VI$ with $I = {{I}}$ A — or equivalently $P = V^2/R$."
        explanation: |
          **Answer:** {{P}} W

          **Why:** Using the current from Q1, $P = VI = {{V}} \times {{I}} = {{P}}$ W.
          Check: $V^2/R = {{V^2}}/{{R}} = {{P}}$ W ✓.

          **Common mistakes:**
          - {{V/R}} W — that's the current (in A), not the power.
          - {{V*R}} W — power is $V^2/R$, not $VR$; more resistance gives *less* power here.
          - {{V}} W — that's the voltage.

          **Connects to:** Q5 compares this with the series circuit.
      harder:
        id: s4-h
        difficulty: 4
        prompt: |
          The {{R}} Ω resistor is replaced by a {{R/2}} Ω resistor, still across the {{V}} V battery.
          By what factor does the power change?
        options:
          - { text: "It doubles", correct: true }
          - { text: "It halves", misconception: power-proportional-R }
          - { text: "It quadruples", misconception: square-law }
          - { text: "It stays the same — the battery sets the power", misconception: power-fixed-by-battery }
        hints:
          nudge: "Use the power formula where $V$ — which doesn't change — appears."
          partial: "$P = V^2/R$. What happens when $R$ halves?"
        explanation: |
          **Answer:** it doubles.

          **Why:** With $V$ fixed, $P = V^2/R$. Halving $R$ doubles $P$:
          {{P}} W → {{2*P}} W.

          **Common mistakes:**
          - "Halves" — with fixed $V$, power is inversely proportional to $R$.
          - "Quadruples" — $R$ appears to the first power, not squared.
          - "Same" — the battery fixes voltage, not power.

          **Connects to:** in Q5 and Q6 the total resistance changes the same way.

  # ───────────────────────── s5 ─────────────────────────
  - id: s5
    role: core
    concept: electric-power
    uses: [s3, s4]
    clueFor: [s6]
    establishes: "Series pair draws {{P/2}} W — half of the single resistor's {{P}} W."
    standaloneContext: |
      A {{V}} V battery: a single {{R}} Ω resistor dissipates {{P}} W. With two {{R}} Ω resistors
      in series the current is {{V/(2*R)}} A.
    variants:
      easier:
        id: s5-e
        difficulty: 3
        prompt: |
          In the series circuit, the current is {{V/(2*R)}} A and the total resistance is {{2*R}} Ω.
          What total power does the battery deliver?
        answer: { expr: "V^2 / (2*R)", unit: "W" }
        distractors:
          - { expr: "V^2 / R", unit: "W", misconception: series-no-change }
          - { expr: "2 * V^2 / R", unit: "W", misconception: more-resistors-more-power }
          - { expr: "V^2 / (4*R)", unit: "W", misconception: forgot-total-R }
        hints:
          nudge: "Pick the power formula that uses the battery voltage and the total resistance."
          partial: "$P = V^2 / R_{tot} = {{V}}^2 / {{2*R}}$"
        explanation: |
          **Answer:** {{P/2}} W

          **Why:** $P = V^2/R_{tot} = {{V^2}}/{{2*R}} = {{P/2}}$ W. Check: $P = VI = {{V}} \times {{V/(2*R)}} = {{P/2}}$ W ✓.

          **Common mistakes:**
          - {{P}} W — that's the single-resistor value; the circuit changed.
          - {{2*P}} W — adding series resistance *reduces* power.
          - {{P/4}} W — you halved the current and squared it, but forgot that $R_{tot}$ also doubled.

          **Connects to:** Q6 compares this with a parallel arrangement.
      standard:
        id: s5-s
        difficulty: 4
        prompt: |
          Compare the total power drawn from the battery by the two-resistor **series** circuit with
          the power of the single-resistor circuit.
        options:
          - { text: "Series draws half as much", correct: true }
          - { text: "Series draws twice as much — more resistors, more power", misconception: more-resistors-more-power }
          - { text: "Both draw the same — the battery fixes the power", misconception: power-fixed-by-battery }
          - { text: "Series draws a quarter as much", misconception: forgot-total-R }
        hints:
          nudge: "Which quantity is the same in both circuits: $V$, $I$, or $R_{tot}$?"
          buildsOn: "Single resistor: {{P}} W. Series pair: total {{2*R}} Ω."
          partial: "Both circuits have the same $V$, so compare $V^2/R_{tot}$."
        explanation: |
          **Answer:** series draws half as much — {{P/2}} W versus {{P}} W.

          **Why:** The battery voltage is the same in both, so use $P = V^2/R_{tot}$.
          The series circuit has double the resistance ({{2*R}} Ω, from Q3), so half the power.

          **Common mistakes:**
          - "Twice" — extra *series* resistance chokes the current and lowers the total power.
          - "Same" — a battery fixes voltage; power depends on what's connected.
          - "Quarter" — the current halves, so $I^2$ quarters, but $R_{tot}$ doubles: $\tfrac14 \times 2 = \tfrac12$.

          **Connects to:** Q6 asks the same question for a parallel arrangement.
      harder:
        id: s5-h
        difficulty: 5
        prompt: |
          In the two-resistor series circuit, one resistor is bypassed with a plain wire (short-circuited).
          What happens to the total power drawn from the battery?
        options:
          - { text: "It doubles", correct: true }
          - { text: "It quadruples", misconception: square-law }
          - { text: "It stays the same", misconception: power-fixed-by-battery }
          - { text: "It drops to zero", misconception: short-means-no-current }
        hints:
          nudge: "After the bypass, what does the circuit effectively look like?"
          buildsOn: "Series pair: {{P/2}} W. Single resistor: {{P}} W."
          partial: "Current takes the wire and skips that resistor, leaving just one {{R}} Ω resistor."
        explanation: |
          **Answer:** it doubles — from {{P/2}} W to {{P}} W.

          **Why:** The wire has (ideally) zero resistance, so the bypassed resistor carries no current.
          The circuit becomes the single-resistor circuit from Q4, which draws {{P}} W —
          twice the series pair's {{P/2}} W.

          **Common mistakes:**
          - "Quadruples" — $R_{tot}$ halves, and with fixed $V$, $P = V^2/R$ only doubles.
          - "Same" — removing resistance changes the power.
          - "Zero" — only the bypassed resistor goes dark; the rest of the circuit still works.

          **Connects to:** Q6 — what if the resistors were side by side instead?

  # ───────────────────────── s6 ─────────────────────────
  - id: s6
    role: core
    concept: parallel-resistance
    uses: [s3, s5]
    establishes: "Parallel pair draws {{2*P}} W — 4× the series pair."
    standaloneContext: |
      A {{V}} V battery and two {{R}} Ω resistors. In series they draw {{P/2}} W in total;
      a single resistor draws {{P}} W.
    variants:
      easier:
        id: s6-e
        difficulty: 3
        prompt: |
          The two {{R}} Ω resistors are now connected in **parallel** across the {{V}} V battery,
          so each has the full {{V}} V across it. What total current leaves the battery?
        answer: { expr: "2*V / R", unit: "A" }
        distractors:
          - { expr: "V / (2*R)", unit: "A", misconception: series-parallel-confusion }
          - { expr: "V / R", unit: "A", misconception: parallel-one-branch }
          - { expr: "4*V / R", unit: "A", misconception: square-law }
        hints:
          nudge: "Find the current in one branch, then think about how many branches there are."
          partial: "Each branch: $I = {{V}}/{{R}} = {{I}}$ A. The battery supplies all branches."
        explanation: |
          **Answer:** {{2*V/R}} A

          **Why:** Each branch has the full {{V}} V, so each carries {{I}} A. The battery supplies both:
          {{I}} + {{I}} = {{2*V/R}} A. Equivalently, $R_{par} = {{R/2}}$ Ω and $I = V/R_{par}$.

          **Common mistakes:**
          - {{V/(2*R)}} A — that's the *series* current.
          - {{V/R}} A — that's one branch only.
          - {{4*V/R}} A — current adds per branch; it doesn't square.

          **Connects to:** more current at the same voltage means more power drawn.
      standard:
        id: s6-s
        difficulty: 4
        prompt: |
          Now connect the two {{R}} Ω resistors in **parallel** across the battery instead.
          Which arrangement drains the battery faster, and by what factor?
        options:
          - { text: "Parallel — 4× the power of series", correct: true }
          - { text: "Parallel — 2× the power of series", misconception: parallel-partial }
          - { text: "Series — 2× the power of parallel", misconception: resistance-means-more-work }
          - { text: "They drain it equally", misconception: power-fixed-by-battery }
        hints:
          nudge: "What is the voltage across each resistor in parallel?"
          buildsOn: "Series pair: {{P/2}} W total (Q5)."
          partial: "In parallel, each resistor gets the full {{V}} V, so each dissipates {{P}} W."
        explanation: |
          **Answer:** parallel — 4× the power of series.

          **Why:** In parallel, each resistor has the full {{V}} V and dissipates {{P}} W (as in Q4),
          so the total is {{2*P}} W. In series the total was {{P/2}} W (Q5).
          Ratio: ${{2*P}} / {{P/2}} = 4$.

          **Common mistakes:**
          - "2×" — you compared with the single resistor ({{P}} W), not with the series pair.
          - "Series drains faster" — more resistance in the path means *less* current and less power.
          - "Equal" — power depends on the total resistance, which differs by a factor of 4.

          **Connects to:** the challenge — build a circuit with a specific current.
      harder:
        id: s6-h
        difficulty: 5
        prompt: |
          An ideal {{V}} V battery powering the single {{R}} Ω resistor lasts 8 hours.
          How long does it last powering the two {{R}} Ω resistors connected in parallel?
        options:
          - { text: "4 hours", correct: true }
          - { text: "2 hours", misconception: wrong-baseline }
          - { text: "16 hours", misconception: resistance-means-more-work }
          - { text: "8 hours", misconception: power-fixed-by-battery }
        hints:
          nudge: "Battery life = stored energy ÷ power drawn."
          buildsOn: "Single resistor: {{P}} W. Each parallel branch also dissipates {{P}} W."
          partial: "Parallel total: {{2*P}} W — twice the single resistor's."
        explanation: |
          **Answer:** 4 hours.

          **Why:** The stored energy is fixed. The parallel pair draws {{2*P}} W, twice the single
          resistor's {{P}} W, so the battery lasts half as long: 8 h ÷ 2 = 4 h.

          **Common mistakes:**
          - "2 h" — that uses the parallel-vs-*series* factor (4×), but the baseline here is the single resistor.
          - "16 h" — more resistors in parallel *lower* the total resistance and drain faster.
          - "8 h" — the battery's energy is fixed; its power output is not.

          **Connects to:** the challenge — design a circuit for a target current.

  # ─────────────── remediation (shown after 2 misses near s3) ───────────────
  - id: r1
    role: remediation
    remediates: s3
    concept: series-resistance
    variants:
      standard:
        id: r1-s
        difficulty: 2
        prompt: "Two different resistors are connected in series in a single loop. Which statement about the current is true?"
        options:
          - { text: "The same current flows through both", correct: true }
          - { text: "More current flows through the first resistor", misconception: current-used-up }
          - { text: "The current splits equally between them", misconception: series-parallel-confusion }
          - { text: "Current flows only through the smaller resistor", misconception: current-takes-easiest-path }
        hints:
          nudge: "In a single loop, is there anywhere the current could go other than through both?"
          partial: "There is only one path, so every charge passes through both resistors."
        explanation: |
          **Answer:** the same current flows through both.

          **Why:** Series means one path. Every charge that passes the first resistor must then pass
          the second, so the current is identical everywhere in the loop.

          **Common mistakes:**
          - "More through the first" — charge isn't used up.
          - "Splits equally" — splitting happens only at a junction (parallel).
          - "Only the smaller" — with only one path, there's no choice to make.

          **Connects to:** because the current is the same, series resistances simply add.

# ───────────────────────── challenge ─────────────────────────
challenge:
  id: phys2.u3.l2.ch
  type: circuit-builder
  title: "Hit the target current"
  concept: series-resistance
  uses: [s3, s6]
  params:
    sets:
      - { V: 6, R: 4 }
      - { V: 12, R: 8 }
  variants:
    easier:
      difficulty: 3
      goal: "Using the {{V}} V battery and any of the {{R}} Ω resistors, build a circuit where exactly {{V/(2*R)}} A flows out of the battery."
      config:
        battery: { voltage: "V" }
        palette:
          - { kind: resistor, resistance: "R", count: 3 }
          - { kind: wire, count: unlimited }
        grid: { cols: 6, rows: 4 }
      check: { expr: "near(I, V / (2*R))" }
      feedback:
        - { if: "near(I, V/R)", say: "One resistor gives {{R}} Ω. You need more total resistance." }
        - { if: "I > V/R", say: "Parallel connections *lower* the total resistance. Try series.", misconception: series-parallel-confusion }
        - { if: "near(I, V/(3*R))", say: "Three in series is too much resistance." }
      hints:
        nudge: "What total resistance gives {{V/(2*R)}} A at {{V}} V?"
        buildsOn: "From Q3: series resistances add."
        partial: "You need $R_{tot} = {{2*R}}$ Ω."
      solution: { netlist: ["B1 n1 0", "R1 n1 n2", "R2 n2 0"] }
      explanation: |
        $R_{tot} = V/I = {{V}}/{{V/(2*R)}} = {{2*R}}$ Ω — two resistors in series.
    standard:
      difficulty: 4
      goal: "Using the {{V}} V battery and up to three {{R}} Ω resistors, build a circuit where exactly {{V/(1.5*R)}} A flows out of the battery."
      config:
        battery: { voltage: "V" }
        palette:
          - { kind: resistor, resistance: "R", count: 3 }
          - { kind: wire, count: unlimited }
        grid: { cols: 6, rows: 4 }
      check: { expr: "near(I, V / (1.5*R))" }
      feedback:
        - { if: "near(I, V/(3*R))", say: "Three in series gives {{3*R}} Ω — too much. Can you make a total between {{R}} Ω and {{2*R}} Ω?" }
        - { if: "near(I, V/(2*R))", say: "Two in series gives {{2*R}} Ω. Close — you need a little less resistance." }
        - { if: "near(I, V/R)", say: "One resistor gives {{R}} Ω. You need more — but not a whole extra resistor's worth." }
        - { if: "I > V/R", say: "Parallel connections lower the total below {{R}} Ω, but you need more than {{R}} Ω.", misconception: series-parallel-confusion }
      hints:
        nudge: "What total resistance do you need? Is it more or less than one resistor?"
        buildsOn: "Series adds resistance (Q3). Two equal resistors in parallel give half of one (Q6)."
        partial: "You need $R_{tot} = {{1.5*R}}$ Ω = one resistor plus half of one."
      solution: { netlist: ["B1 n1 0", "R1 n1 n2", "R2 n2 0", "R3 n2 0"] }
      explanation: |
        You need $R_{tot} = V/I = {{1.5*R}}$ Ω $= R + R/2$. Put one resistor in series with a
        parallel pair: $R_{tot} = {{R}} + ({{R}} \parallel {{R}}) = {{R}} + {{R/2}} = {{1.5*R}}$ Ω.
    harder:
      difficulty: 5
      goal: "Use **all three** {{R}} Ω resistors to build a circuit where exactly {{1.5*V/R}} A flows out of the {{V}} V battery."
      config:
        battery: { voltage: "V" }
        palette:
          - { kind: resistor, resistance: "R", count: 3 }
          - { kind: wire, count: unlimited }
        grid: { cols: 6, rows: 4 }
      check: { expr: "near(I, 1.5 * V / R) and n == 3" }
      feedback:
        - { if: "n < 3", say: "Use all three resistors." }
        - { if: "near(I, V/(1.5*R))", say: "That's $R + R/2$ = {{1.5*R}} Ω. You need *less* total resistance than one resistor." }
        - { if: "near(I, 3*V/R)", say: "All three in parallel gives {{R/3}} Ω — too little." }
      hints:
        nudge: "The target current is larger than {{V/R}} A, so the total must be *less* than {{R}} Ω."
        buildsOn: "Parallel lowers resistance (Q6); series raises it (Q3)."
        partial: "You need $R_{tot} = {{2*R/3}}$ Ω. Try one resistor in parallel with a series pair."
      solution: { netlist: ["B1 n1 0", "R1 n1 0", "R2 n1 n2", "R3 n2 0"] }
      explanation: |
        $R_{tot} = V/I = {{2*R/3}}$ Ω. One resistor in parallel with a series pair gives
        $\dfrac{R \cdot 2R}{R + 2R} = \dfrac{2R}{3} = {{2*R/3}}$ Ω, so $I = {{1.5*V/R}}$ A.

summary:
  keyTakeaways:
    - "$I = V/R$: with the voltage fixed, current is inversely proportional to resistance."
    - "Series resistances add; the same current flows through each."
    - "Parallel branches each get the full voltage; the total resistance drops."
    - "$P = VI = I^2R = V^2/R$; with a fixed battery, less total resistance means more power."
  next: phys2.u3.l3
```

**Misconception ids used above.** Define all of them in `content/phys2/misconceptions.yaml`:
ohm-multiply, ohm-inverted, current-equals-voltage, current-used-up, battery-constant-current, square-law, series-no-change, series-parallel-confusion, multiply-resistances, double-halving, each-gets-full-voltage, current-voltage-confusion, power-divide, power-add, power-is-current, power-formula-mixup, power-equals-voltage, power-proportional-R, power-fixed-by-battery, more-resistors-more-power, forgot-total-R, short-means-no-current, parallel-partial, parallel-one-branch, resistance-means-more-work, wrong-baseline, current-takes-easiest-path.

---

## 8. Lesson player behaviour

**Stages:** `Intro` → `Practice` → `Challenge` → `Summary`.
- A stepper at the top shows the stages.
- The **Explanations** tab sits beside the main **Lesson** tab.

**Intro stage**
- Renders `intro`, then `workedExample` in a highlighted card.
- Button: "Start practice".

**Practice stage**
1. Draw params once per attempt from a **seeded RNG** (mulberry32).
   - `sets`: choose an index.
   - `vars`: sample each variable.
   - Evaluate `derived` in order.
   - Store the seed.
2. For each core step in order:
   - choose a variant (§3.2),
   - render it,
   - handle attempts and hints (§2.3),
   - score it (§2.4),
   - update ratings (§3.1),
   - push `establishes` to the Facts panel,
   - insert remediation or bonus steps when triggered,
   - save attempt state after every step.
3. Progress dots show completed / current / remaining steps, coloured by score.

**Challenge stage**
- `ChallengeHost` renders: goal, the type's component, a **Check** button, hint ladder, attempt count, feedback line.
- On success: explanation panel and score.
- After 5 failed checks: a "Show solution" button that renders the type's solution and then the explanation.

**Summary stage**
- Shows: score per step, stars, rating change per concept, misconceptions met (with their `explain` text), key takeaways, and the link to `next`.
- Buttons: "Retry lesson" (new seed) and "Back to subject".

**Explanations tab**
- Lists every answered step with: prompt, the student's choice, the correct answer, and the full explanation.
- Unanswered steps show "Answer this question to unlock its explanation."

**Resume**
- Leaving mid-lesson and coming back resumes at the same step with the same numbers and variants.

---

## 9. Interactive challenge framework & catalog

### 9.1 Module contract

Every challenge type is a folder `src/challenges/<type>/` exporting:

```ts
interface ChallengeModule<Config, State, Solution> {
  type: string;
  configSchema: ZodType<Config>;
  solutionSchema: ZodType<Solution>;
  Component: React.FC<{
    config: Config;                       // templates and expressions already resolved
    disabled: boolean;
    onStateChange(state: State): void;
    showSolution?: Solution;              // when set, render the solution read-only
  }>;
  checkScope(state: State, config: Config): Record<string, number | boolean>;  // variables for check/feedback exprs
  builtInFeedback?(state: State, config: Config): string | null;              // e.g. "Short circuit!"
  solutionScope(solution: Solution, config: Config): Record<string, number | boolean>; // used by validator + "Show solution"
  describeState(state: State): string;    // plain-text summary for screen readers (§11)
}
```

**Engine-side evaluation**
- `check.expr` and `feedback[].if` are evaluated with mathjs.
- Their scope is params + derived + `checkScope(...)` + the `near` helper.

**Validator-side evaluation**
- For every param set, or 50 samples for `vars`, the validator evaluates `check.expr` against `solutionScope(solution)` and must get `true`.

### 9.2 Catalog

Each entry gives: what the student does, key config, check-scope variables, solution format, and where it's used.

**1. `circuit-builder`**
- **Student does:** builds a DC circuit on a snap grid.
  - Tap or drag to place elements; drag endpoints to connect.
  - Elements: battery, resistor, bulb (a resistor whose brightness ∝ power), wire, switch, ammeter, voltmeter.
- **Solver:** Modified Nodal Analysis.
  - Merge wires and closed switches into nodes with union-find.
  - Ammeters are zero-resistance wires; voltmeters are open circuits.
  - Detect short circuits across a source (singular matrix or zero-resistance loop) → built-in feedback "Short circuit!".
  - Detect an open circuit → "No complete loop".
- **Display:** live readings on meters; current-flow animation (off when reduced motion is on).
- **Config:** `battery {voltage, internalResistance?}`, `palette[]`, `grid`, optional `constraints {maxElements}`.
- **Scope:** `I` (battery current), `Req`, `Ptot`, `n` (resistors used), `isShort`, `isOpen`, and per element `I_<label>`, `V_<label>`, `P_<label>`.
- **Solution:** netlist strings `"<label> <node+> <node−> [valueExpr]"`; node `0` is the battery's negative terminal.
- **Used in:** phys2 U3, U5.

**2. `transient-plotter`**
- **Student does:** watches RC or RL charging/discharging curves plotted live while adjusting sliders for R, C (or L) and V.
- **Goals look like:** "reach 63% at t = 2 s", "make the time constant 0.5 s".
- **Scope:** `R`, `C`, `L`, `tau`, `V_at(t)` sampled at configured times, `slider` values.
- **Solution:** slider values.
- **Used in:** phys2 U3 (RC), U5 (RL).

**3. `charge-field`**
- **Student does:** places and drags point charges (value selectable) on a 2D plane.
  - Shows field vectors on a grid, optional field lines, and potential at probe points.
- **Scope:** `Ex`, `Ey`, `E`, `Vp` at each named probe, `nCharges`, `F` on a designated test charge.
- **Solution:** list of `{q, x, y}`.
- **Used in:** phys2 U1–U2.

**4. `particle-in-field`**
- **Student does:** sets charge, velocity, uniform B (into/out of page) and optional uniform E.
  - The trajectory is traced. Goals: hit a target, pass straight through (velocity selector), match a radius.
- **Scope:** `radius`, `hitTarget`, `straight`, `period`.
- **Solution:** parameter values.
- **Used in:** phys2 U4.

**5. `projectile-launcher`**
- **Student does:** sets launch angle, speed and height with sliders, then launches; the trajectory animates.
  - Optional obstacles and targets.
- **Scope:** `angle`, `v`, `h`, `range`, `maxHeight`, `flightTime`, `hit`.
- **Solution:** parameter values.
- **Used in:** phys1 U1.

**6. `motion-graph`**
- **Student does:** drags control points to draw an x–t (or v–t) graph that matches a description or a given graph of the other kind.
- **Scope:** `maxError`, `meanError`.
- **Solution:** control points.
- **Used in:** phys1 U1.

**7. `force-diagram`**
- **Student does:** drags force arrows (gravity, normal, friction, tension, applied, spring) onto a body.
  - Snaps direction to 16 angles; magnitudes optional.
- **Scope:** `correctSet` (bool), `directionsOk` (bool), `netFx`, `netFy`.
- **Solution:** list of `{force, angle, magnitude?}`.
- **Used in:** phys1 U2.

**8. `collision-lab`**
- **Student does:** sets masses, initial velocities and elasticity for two carts on a track, predicts the outcome, then runs it.
- **Scope:** `v1f`, `v2f`, `pBefore`, `pAfter`, `keLoss`, `prediction` values.
- **Solution:** parameter values.
- **Used in:** phys1 U4.

**9. `torque-balance`**
- **Student does:** places masses on a beam or seesaw at grid positions to reach equilibrium or a target angular acceleration.
- **Scope:** `netTorque`, `balanced`.
- **Solution:** placements.
- **Used in:** phys1 U5.

**10. `graph-manipulator`**
- **Student does:** works with a plot (function, parametric or polar mode) with sliders for named parameters and draggable points.
- **Optional overlays:**
  - tangent at `x0`,
  - secant with step `h`,
  - shaded area on `[a, b]`,
  - derivative curve,
  - accumulation function,
  - a target curve to match,
  - data points for fitting.
- **Scope:** slider values by name, `x0`, `fx0`, `fpx0` (numeric derivative), `a`, `b`, `area`, `secantSlope`, `matchError`, `sse`.
- **Solution:** values for all controls.
- **Used in:** calc1, calc2, phys1 (energy diagrams, SHM), phys2 U6, linalg U6, probstat U4.

**11. `riemann-sum`**
- **Student does:** chooses `n` and a rule (left / right / midpoint / trapezoid / Simpson) for a given f on `[a, b]`.
- **Scope:** `n`, `rule`, `approx`, `exact`, `error`.
- **Solution:** `{n, rule}`.
- **Used in:** calc1 U4, calc2 U2.

**12. `series-explorer`**
- **Student does:** looks at plots of terms and partial sums with an `N` slider, plus a Taylor-polynomial overlay mode with a degree slider.
- **Scope:** `N`, `SN`, `limit` (if known), `error`, `degree`, `maxErrorOnInterval`.
- **Solution:** `{N}` or `{degree}`.
- **Used in:** calc2 U3.

**13. `matrix-transform`**
- **Student does:** enters a 2×2 matrix (or composes given ones) and watches the unit square or a shape transform on a grid, against a target outline.
- **Scope:** `a`, `b`, `c`, `d`, `det`, `matchError`, `matches`.
- **Solution:** a matrix.
- **Used in:** linalg U2, U4, U5.

**14. `vector-play`**
- **Student does:** drags vectors in 2D.
- **Modes:**
  - linear combination: set c₁, c₂ to reach a target,
  - span / independence,
  - eigen: drag v until Av ∥ v,
  - projection.
- **Scope:** `c1`, `c2`, `hitTarget`, `angleAvV`, `isEigen`, `projError`.
- **Solution:** values.
- **Used in:** linalg U1, U3, U5, U6.

**15. `row-reducer`**
- **Student does:** applies row operations through the UI (swap, scale, add a multiple), aiming for RREF, a solution, or an inverse via `[A | I]`.
- **Scope:** `isRREF`, `matchesTarget`, `ops` (count).
- **Solution:** a list of operations.
- **Used in:** linalg U1–U3.

**16. `truth-table`**
- **Modes:**
  - fill a truth table for an expression,
  - build an expression from tokens to match a given table.
- **Scope:** `rowsCorrect`, `allCorrect`, `exprMatches`, `tokens`.
- **Solution:** table or expression.
- **Used in:** discrete U1.

**17. `graph-builder`**
- **Student does:** adds and removes vertices and edges, directed or undirected, optionally weighted.
- **Computed properties:** `connected`, `bipartite`, `hasEulerPath`, `hasEulerCircuit`, `isTree`, `chromatic` (exact for ≤ 8 vertices), `nV`, `nE`, `degrees`, relation properties (`reflexive`, `symmetric`, `transitive`, `antisymmetric`).
- **Scope:** all of the properties above.
- **Solution:** an edge list.
- **Used in:** discrete U3, U6; dsa U6.

**18. `algorithm-stepper`**
- **Student does:** sees a visual data structure and **performs the next operation** by clicking (choose the swap, the next node to visit, the pivot position, the DP cell value…).
  - Each action is checked against a reference trace; a wrong action shows why and lets the student retry.
- **Algorithms:**
  - Sorting and searching: bubble, insertion, selection, merge (merge step), quicksort (Lomuto partition), binary search (including a "guess my number" discovery mode).
  - Structures: stack/queue operations, hash insert (linear probing / chaining), heap insert/extract (sift up/down), BST insert/delete, AVL (identify rotation), traversals.
  - Graphs: BFS, DFS, topological sort (Kahn), Dijkstra (distance table), Prim, Kruskal with union-find.
  - Other: DP table fill, Euclid / extended Euclid, Newton's method iterations.
- **Scope:** `stepsCorrect`, `totalSteps`, `mistakes`, `done`.
- **Solution:** the reference trace (generated).
- **Used in:** dsa (all units), discrete U5, calc1 U3.

**19. `parsons`**
- **Student does:** drags lines into order. Lines can be code (with Python indentation) or proof steps.
  - Optional distractor lines must be left out.
- **Scope:** `orderCorrect`, `indentCorrect`, `usedDistractors`.
- **Solution:** ordered line ids with indent levels.
- **Used in:** discrete U2, calc2 U2, dsa.

**20. `code-runner`**
- **Editor:** CodeMirror 6 with language switch (Python / JavaScript) and starter code per language.
- **Execution:** in a Web Worker; terminated on timeout.
  - Python: Pyodide (pinned version), loaded only when first needed.
- **Tests:** visible tests shown with results; hidden tests show pass/fail only.
- **Comparator:** `exact | unordered | float(1e-6)`.
- **Optional performance test:** a named generator from `src/challenges/code-runner/generators.ts` with parameters plus a time limit, to reject brute force.
- **Scope:** `passed`, `total`, `perfPassed`, `timeMs`.
- **Solution:** reference code per language. The validator runs JS in Node `vm` and Python in a `python3` subprocess in CI; it warns locally if `python3` is missing.
- **Used in:** dsa (all units), discrete U5.

**21. `probability-sim`**
- **Student does:** runs N trials of an experiment and compares empirical with theoretical results, after entering a prediction first.
- **Experiments:** dice, coins, urns, cards, Monty Hall, birthday problem, custom.
- **Enumerate mode:** lists all outcomes for small cases.
- **Scope:** `prediction`, `theoretical`, `empirical`, `N`, `withinTolerance`.
- **Solution:** prediction value.
- **Used in:** probstat U1–U4, discrete U4.

**22. `distribution-fitter`**
- **Student does:** adjusts distribution parameters (binomial, Poisson, normal, exponential) with sliders to match a histogram or meet a condition such as "P(X > 3) = 0.2".
- **Scope:** parameter values, `fitError`, `targetProb`.
- **Solution:** parameter values.
- **Used in:** probstat U2–U4.

---

## 10. UI: pages, layout, design

### 10.1 Routes (hash-based)

| Route | Page |
|---|---|
| `#/` | **Home:** subject cards with progress rings; "Continue where you left off"; "Review (n due)" button |
| `#/s/:subjectId` | **Subject:** description, prerequisites, units as an accordion; lessons with stars, progress and "Recommended first" notices; "Coming soon" placeholders |
| `#/l/:lessonId` | **Lesson player** (§8) |
| `#/review` | **Review session** (§3.3) |
| `#/profile` | Concept ratings per subject (bar list with Strong / Developing / Needs work), top misconceptions with links to remediation lessons, totals, streak, export / import / reset |
| `#/settings` | Theme (system / light / dark), font size, reduced motion, preferred code language |

### 10.2 Lesson layout

- **Desktop:**
  - main column, text max-width ≈ 720 px: question stack and current question,
  - right sidebar: Facts panel, progress dots, hint ladder.
- **Mobile:**
  - single column,
  - Facts panel as a collapsible bottom drawer,
  - challenges fill the width; recommend landscape for `circuit-builder`.

### 10.3 Visual design

- Calm and focused, with no gamified noise.
- Generous whitespace and clear typography; KaTeX for math.
- Light and dark themes via CSS variables.
- Correct and incorrect states use **icon + text + colour**, never colour alone.
- Subtle motion only; everything respects `prefers-reduced-motion`.

---

## 11. Accessibility

- Meet WCAG 2.2 AA contrast. Every control is keyboard-reachable with a visible focus ring.
- Feedback and score changes are announced via `aria-live="polite"`.
- MCQ options are a proper radio group.
- **Challenges:**
  - Each type implements `describeState()`, rendered in a visually hidden live region.
  - Where feasible, offer a keyboard alternative. For example, `circuit-builder` has a list-based editor: "add resistor between node 1 and node 2".
- KaTeX output must keep its MathML for screen readers.

---

## 12. Progress storage

**Location and format**
- Single key: `${APP_KEY}progress`.
- JSON with a `version` field and migrations in `storage/migrations.ts`.
- Saves are debounced (300 ms) and also flushed on `visibilitychange`.

```ts
interface ProgressV1 {
  version: 1;
  createdAt: string;
  ratings: {
    subject: Record<string, number>;
    concept: Record<string, { r: number; n: number }>;   // n = answers counted
  };
  lessons: Record<string, {
    status: 'not-started' | 'in-progress' | 'completed';
    bestScore: number;          // mean core score, 0–1
    stars: 0 | 1 | 2 | 3;
    completedAt?: string;
    attempt?: AttemptState;     // present while in progress
  }>;
  questions: Record<string, { lastScore: number; attempts: number; version: number }>; // key: lessonId#questionId
  misconceptions: Record<string, { count: number; lastSeen: string }>;
  review: Record<string, { box: 1 | 2 | 3 | 4 | 5; due: string }>;
  settings: { theme: 'system' | 'light' | 'dark'; fontScale: number; reducedMotion: boolean; codeLang: 'python' | 'javascript' };
}

interface AttemptState {
  seed: number;
  stage: 'intro' | 'practice' | 'challenge' | 'summary';
  stepIndex: number;
  chosenVariants: Record<string, 'easier' | 'standard' | 'harder'>;
  insertedSteps: string[];
  answers: Record<string, { selected: number[]; hintsUsed: number; score?: number }>;
  facts: string[];
  challenge?: { variant: string; state: unknown; hintsUsed: number; checks: number; solved: boolean };
}
```

**Export / import / reset**
- **Export:** downloads `stepwise-progress-YYYY-MM-DD.json`.
- **Import:** validates with Zod, shows a summary, asks for confirmation, then replaces stored progress.
- **Reset:** requires typing "RESET".

---

## 13. Testing & content validation

### 13.1 Unit tests (Vitest)

- **Engine:**
  - Elo update and expected score,
  - variant selection targets and streak rules,
  - seeded param draws (deterministic),
  - template evaluation and number formatting (edge cases: 0, negatives, 1e-4, 123456, 0.1 + 0.2),
  - scoring,
  - Leitner scheduling.
- **Circuit solver:** known circuits (single, series, parallel, mixed, bridge, a two-source Kirchhoff case), short detection, open detection.
- **Every challenge type:** `checkScope` and `solutionScope` on fixtures.
- **Storage:** migrations, and round-trip of export/import.

### 13.2 Content validator (`npm run content:check`)

Errors fail CI; warnings are printed.

**Structure (errors)**
- Every YAML file passes its Zod schema. Ids are unique. Lesson id matches its file path.
- Every lesson referenced in `subject.yaml` either has a file or is shown as a placeholder. Every lesson file is listed in `subject.yaml`.
- Every concept and misconception id referenced exists.
- Exactly 6 core steps per lesson.
  - Each core step has `easier`, `standard` and `harder`, with strictly increasing difficulty.
  - `standard` difficulty is between 2 and 4.
- Remediation and bonus steps have `standard` only. Remediation steps have a valid `remediates`.
- Chain links:
  - `uses` only points to earlier core steps; `clueFor` only to later ones.
  - ≥ 2 `uses` links and ≥ 1 `clueFor` link per lesson.
  - The last core step uses ≥ 2 steps.
- Core steps have `establishes`. Steps with `uses` have `standaloneContext`.
- Options:
  - static: exactly 4 options, exactly 1 correct, the other 3 tagged with a misconception;
  - computed: `answer` plus exactly 3 tagged `distractors`.
- Hints have non-empty `nudge` and `partial`.
- Every explanation contains the labels `**Answer:**`, `**Why:**`, `**Common mistakes:**`, `**Connects to:**`.
- Every challenge has 3 variants with strictly increasing difficulty, a config that passes the type's schema, and a solution that passes the type's schema.

**Numbers (errors)**
- For **every** param set (or 200 seeded samples for `vars`):
  - all templates and expressions evaluate to finite numbers with no unknown symbols;
  - all 4 displayed options of each question are **pairwise distinct after formatting**.
    - Example the validator must catch: with V = 9 and R = 3, the options $V \cdot R$ and $V^2/R$ both show "27".
- `verify` pairs agree at 20 random points (relative tolerance 1e-9).
- Every challenge variant's `solution` makes `check.expr` true for every param set.
- Every `feedback[].if` evaluates to a boolean.

**Rendering (errors)**
- Every `$…$` and `$$…$$` renders with KaTeX `throwOnError: true` after template substitution.

**Quality (warnings)**
- Intro over 300 words; prompt over 80 words.
- Lesson mean `standard` difficulty more than 0.5 away from its unit's `baseDifficulty`.
- A misconception defined but never used.
- The same misconception tag used twice within one question.
- A worked example containing the same numbers as a param set.

### 13.3 E2E smoke (Playwright)

1. Home loads; all 8 subjects are listed.
2. Open phys2 → open the reference lesson.
3. Complete the intro and answer all 6 steps:
   - in dev builds, a `?debug=1` hook reveals the correct option index;
   - this hook must not exist in production builds.
4. Reach the challenge. Load the solution through the debug hook, check it, and see success.
5. The summary shows stars. Reload mid-lesson and confirm resume works.
6. Export progress, reset, import, and confirm progress is restored.

---

## 14. Build phases (do them in order)

Each phase ends deployed, with tests and `content:check` green.

**Phase 0 — Scaffold & deploy**
- Vite + React + TS + Tailwind, HashRouter, `config.ts`, base path from `BASE_PATH`.
- Deploy workflow, an empty Home page live on GitHub Pages, lint and test setup, `DECISIONS.md`.
- ✅ The site loads at `https://<user>.github.io/<repo>/`; refreshing on a hash route works.

**Phase 1 — Content pipeline & syllabus browsing**
- Zod schemas, validator, build script, per-subject JSON output.
- `subjects.yaml` plus `subject.yaml` and `concepts.yaml` for **all 8 subjects** from Section 16 (lessons as placeholders).
- Home and Subject pages.
- ✅ All units and lessons from Section 16 are browsable; placeholders show "Coming soon"; the validator catches deliberately broken fixtures.

**Phase 2 — Lesson player & adaptive engine**
- Everything in §3 and §8, plus the Facts panel, Explanations tab, hint ladder, scoring and progress storage.
- Load the reference lesson (§7.7). The challenge stage shows a placeholder for now.
- ✅ The reference lesson is fully playable; variant selection reacts to performance; resume works; engine unit tests pass.

**Phase 3 — Challenge framework + circuits (MVP release)**
- `ChallengeHost`, the registry with lazy loading, `circuit-builder` (with MNA solver), and `transient-plotter`.
- Write **all 8 lessons of phys2 U3** at the §7.7 quality bar.
- ✅ The full phys2 U3 unit plays end to end, every challenge solution validates, and the e2e smoke test passes. **This is the MVP.**

**Phase 4 — Review, profile, settings**
- Leitner review, profile page with concept status and misconceptions, export / import / reset, themes, font scale, reduced motion.
- ✅ Missed questions reappear in review with new numbers; export/import round-trips.

**Phase 5 — DSA tooling + content**
- `code-runner` (JS + Pyodide), `algorithm-stepper`, `parsons`.
- Write dsa U1 and U2.
- ✅ Python and JS solutions validate in CI; the stepper's traces match reference implementations.

**Phase 6 — Calculus tooling + content**
- `graph-manipulator`, `riemann-sum`, `series-explorer`.
- Write calc1 U1 and U2.
- ✅ Symbolic answers use `verify`; all graph challenges validate.

**Phase 7 — Remaining tools and content rollout**
- Build the remaining challenge types as each subject needs them.
- Write content in this order:
  1. calc1 (rest)
  2. phys1
  3. phys2 (rest)
  4. linalg
  5. discrete
  6. dsa (rest)
  7. calc2
  8. probstat
- Each unit is released only when all its lessons pass `content:check` and a manual play-through.

**Per-lesson definition of done**
- [ ] 6 core steps × 3 variants, at least 1 remediation step, and optionally 1 bonus step.
- [ ] 1 challenge × 3 variants with validated solutions.
- [ ] Chain rules satisfied; explanations follow the template.
- [ ] Zero validator errors.
- [ ] Played through once at each difficulty extreme.

---

## 15. Content authoring rules

### 15.1 Intro & worked example

- Intro: ≤ 300 words. Define every symbol with its unit. One idea per paragraph. No history lessons.
- Exactly one worked example, using numbers that do not appear in the question param sets.

### 15.2 Questions

- One idea per question; prompt ≤ 80 words; no trick wording.
- Avoid "which is NOT …". If unavoidable, use it only in `harder` variants and **bold** the NOT.
- **Scenario continuity.**
  - A lesson's chain shares one scenario (one circuit, one function, one array) unless a step explicitly says "Now consider …".
  - All three variants of a step keep that step's scenario and establish the same fact.
- Refer to earlier steps by description ("the series circuit from before"), not only by number. The UI adds the "↩ builds on Qn" chips.
- **Variants:**
  - `easier` scaffolds the same idea (gives an intermediate value, or asks for one step only);
  - `harder` adds a twist (a new situation, a conceptual trap, or a second step) — not just bigger numbers.

### 15.3 Distractors (wrong options)

- Each wrong option is a **specific, plausible mistake** that real students make, tagged with a misconception id. Within a question, use 3 different tags.
- Wrong options have the same units and format as the answer, similar length, and plausible magnitude.
- Never use "all of the above", "none of the above", or joke options.
- Computed distractors must come from the misconception's actual wrong formula. Do not invent random nearby numbers.

### 15.4 Explanation template (mandatory)

```
**Answer:** <the answer>

**Why:** <3–8 short lines of reasoning with equations; show the substitution with real numbers>

**Common mistakes:**
- <option> — <the mistake behind it, in one line>
- <option> — …
- <option> — …

**Connects to:** <which earlier step this used and/or which later step it helps with>
```

### 15.5 Hints

- `nudge`: a question or pointer; never a formula with numbers substituted.
- `buildsOn`: optional authored override; otherwise auto-generated from `uses` plus the Facts panel.
- `partial`: does about half the work; never states the final answer.

### 15.6 Challenges

- The goal is one measurable sentence.
- At least 3 `feedback` rules for the most common wrong states.
- `harder` adds a constraint (use all parts, fewer moves, a tighter tolerance, a performance limit). It must not just change the numbers.
- The solution is always provided and validated.

### 15.7 Per-subject conventions

- **Physics:** SI units, g = 9.8 m/s² (state it in the prompt when used), 3 significant figures, vectors with components.
- **Calculus / Linear algebra:**
  - Symbolic answers are static options written in LaTeX, with `verify` pairs (e.g. lhs `derivative('x^2*sin(x)', 'x')`, rhs `2x*sin(x) + x^2*cos(x)`).
  - Exact values are preferred over decimals.
- **DSA:**
  - Python first; show JS in explanations when syntax differs meaningfully.
  - Complexity in Big-O with the variable defined.
  - Arrays are 0-indexed.
- **Discrete:** use standard notation (∧ ∨ ¬ → ↔, ∀ ∃). Proof steps in Parsons challenges are complete sentences.
- **Probability & Statistics:** probabilities as fractions or to 3 decimal places; state assumptions (independence, fair coin) explicitly.

---

## 16. Syllabi for every subject

**Format of each unit below:**
- A table of lessons: id suffix, title, key concepts.
- **Misconceptions to target:** the starting list for `misconceptions.yaml`; add more as needed.
- **Challenges:** the types and example goals for that unit.
- `baseDifficulty` (base) rises through each subject.

Turn the concept phrases into slugs in each subject's `concepts.yaml`. Lesson-level `prerequisites` default to the previous lesson in the unit, unless the content clearly needs a different one.

`content/subjects.yaml` order: `calc1, calc2, phys1, phys2, linalg, discrete, dsa, probstat`.

---

### 16.1 Calculus I — `calc1`

**Prerequisites:** algebra, trigonometry. **Main tools:** graph-manipulator, riemann-sum, algorithm-stepper (Newton).

**U1 — Limits & Continuity** (base 2)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Functions and their graphs | domain & range, composition, inverses, transformations |
| l2 | The idea of a limit | limits from graphs/tables, one-sided limits, when a limit fails to exist |
| l3 | Computing limits | limit laws, direct substitution, factoring, rationalizing, 0/0 forms |
| l4 | Limits at infinity & asymptotes | end behaviour, horizontal/vertical asymptotes, dominant terms |
| l5 | Continuity | definition, removable/jump/infinite discontinuities, Intermediate Value Theorem |
| l6 | Squeeze theorem & trig limits | squeeze theorem, sin x / x → 1, (1 − cos x)/x → 0 |
| l7 | The ε–δ definition | formal limit definition, finding δ for linear and quadratic functions |

- **Misconceptions to target:**
  - the limit always equals f(a);
  - 0/0 means the limit is 0 or doesn't exist;
  - no limit when f(a) is undefined;
  - ∞/∞ = 1;
  - one-sided limits must equal f(a).
- **Challenges:**
  - graph-manipulator zoom: "drag x toward a until every point is within ε = 0.1 of L";
  - IVT: "find a root to within 0.01";
  - ε–δ: "choose the largest δ that works".

**U2 — Derivatives** (base 2)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | The derivative as a limit | secant → tangent, difference quotient, derivative at a point, differentiability vs continuity |
| l2 | Basic differentiation rules | power, constant multiple, sum rules, polynomials |
| l3 | Product and quotient rules | product rule, quotient rule |
| l4 | The chain rule | composition, nested chains |
| l5 | Derivatives of trig, exponential & log functions | sin/cos/tan, eˣ, aˣ, ln x, logarithmic differentiation |
| l6 | Implicit differentiation & inverse functions | implicit differentiation, inverse trig derivatives |
| l7 | Related rates | setting up rate equations, differentiate before substituting |

- **Misconceptions to target:**
  - (fg)′ = f′g′;
  - (f/g)′ = f′/g′;
  - forgetting the inner derivative;
  - d/dx eˣ = x·eˣ⁻¹;
  - d/dx aˣ = x·aˣ⁻¹;
  - substituting values before differentiating in related rates.
- **Challenges:**
  - graph-manipulator: shrink h until the secant slope is within 0.01 of the tangent;
  - drag x0 to every point with a horizontal tangent.

**U3 — Applications of Derivatives** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Linear approximation & differentials | tangent-line approximation, error |
| l2 | Extreme values | critical points, closed-interval method |
| l3 | The Mean Value Theorem | Rolle's theorem, MVT, consequences |
| l4 | Shape of a graph | increasing/decreasing, first derivative test, concavity, inflection points, second derivative test |
| l5 | Curve sketching | combining all of the above with asymptotes |
| l6 | Optimization | modelling, constraints, checking endpoints |
| l7 | L'Hôpital's rule | indeterminate forms 0/0, ∞/∞, 0·∞, ∞ − ∞, 1^∞ |
| l8 | Newton's method | iteration, convergence, failure cases |

- **Misconceptions to target:**
  - f′(c) = 0 implies an extremum;
  - f″ = 0 always means an inflection point;
  - forgetting endpoints;
  - applying L'Hôpital to non-indeterminate forms;
  - using the quotient rule inside L'Hôpital.
- **Challenges:**
  - graph-manipulator optimization: "set the cut size to maximise the box volume";
  - algorithm-stepper Newton: "reach the root within 1e-6 in ≤ 4 steps".

**U4 — Integrals** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Antiderivatives | indefinite integrals, +C, initial value problems |
| l2 | Area and Riemann sums | sigma notation, left/right/midpoint sums |
| l3 | The definite integral | limit of sums, properties, signed area |
| l4 | The Fundamental Theorem of Calculus | FTC part 1 (with chain rule), FTC part 2 |
| l5 | The substitution rule | u-substitution, changing limits |
| l6 | Net change & average value | net vs total change, average value of a function |

- **Misconceptions to target:**
  - forgetting +C;
  - signed area vs total area;
  - d/dx ∫ₐ^g(x) f = f(g(x)) (missing g′);
  - changing the variable but not the limits;
  - ∫fg = ∫f·∫g.
- **Challenges:**
  - riemann-sum: "error < 0.01 with the fewest rectangles";
  - graph-manipulator accumulation: "drag x until A(x) = 3".

---

### 16.2 Calculus II — `calc2`

**Prerequisites:** calc1. **Main tools:** graph-manipulator, riemann-sum, series-explorer, parsons.

**U1 — Applications of Integration** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Area between curves | top minus bottom, integrating in x or y, intersections |
| l2 | Volumes by slicing | cross-sections, disk and washer methods |
| l3 | Volumes by cylindrical shells | shell radius and height, choosing a method |
| l4 | Arc length & surface area | arc length formula, surface of revolution |
| l5 | Work & physical applications | springs, pumping liquids, hydrostatic force |
| l6 | Centre of mass | moments, centroids of plane regions |

- **Misconceptions to target:**
  - wrong order of subtraction;
  - washer area as (R − r)²;
  - shell radius measured from the wrong axis;
  - missing the square in √(1 + f′²).
- **Challenges:**
  - graph-manipulator: "drag the slice; set the outer and inner radius functions to match the solid".

**U2 — Techniques of Integration** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Integration by parts | choosing u and dv, repeated parts, cyclic integrals |
| l2 | Trigonometric integrals | powers of sin/cos, tan/sec |
| l3 | Trigonometric substitution | √(a² − x²), √(a² + x²), √(x² − a²), back-substitution |
| l4 | Partial fractions | linear and irreducible quadratic factors, long division first |
| l5 | Strategy for integration | recognising which technique applies |
| l6 | Improper integrals | infinite limits, infinite discontinuities, comparison |
| l7 | Numerical integration | trapezoid rule, Simpson's rule, error bounds |

- **Misconceptions to target:**
  - treating LIATE as a law;
  - dropping signs or limits in parts;
  - no back-substitution;
  - partial fractions on improper rational functions;
  - ∫₋₁¹ 1/x² = −2 (ignoring the discontinuity);
  - "the integrand → 0 so it converges".
- **Challenges:**
  - parsons: order the steps of an integration-by-parts solution;
  - riemann-sum (Simpson): "error < 1e-4 with the smallest n".

**U3 — Sequences & Series** (base 4)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Sequences | limits of sequences, monotone and bounded |
| l2 | Series & geometric series | partial sums, geometric series sum, telescoping |
| l3 | Divergence & integral tests | nth-term test, integral test, p-series |
| l4 | Comparison tests | direct comparison, limit comparison |
| l5 | Alternating series | alternating series test, absolute vs conditional convergence |
| l6 | Ratio & root tests | ratio test, root test, inconclusive cases |
| l7 | Power series | radius and interval of convergence, endpoints |
| l8 | Taylor & Maclaurin series | standard series, building new series from known ones |
| l9 | Taylor polynomial error | Lagrange remainder, alternating series error bound |

- **Misconceptions to target:**
  - aₙ → 0 implies convergence;
  - the harmonic series converges;
  - ratio = 1 means convergence;
  - wrong first term in the geometric formula;
  - ignoring endpoints.
- **Challenges:**
  - series-explorer: "smallest N with |S − S_N| < 0.001";
  - Taylor mode: "lowest degree with error < 0.01 on [−1, 1]".

**U4 — Parametric Equations & Polar Coordinates** (base 4)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Parametric curves | eliminating the parameter, direction, speed |
| l2 | Calculus with parametric curves | dy/dx, tangents, arc length |
| l3 | Polar coordinates | converting, graphing polar curves, symmetry |
| l4 | Area and length in polar | ½∫r² dθ, finding limits, overlapping regions |

- **Misconceptions to target:**
  - dy/dx = (dy/dt)(dx/dt);
  - polar area as ∫r dθ;
  - double-counting overlapping petals.
- **Challenges:**
  - graph-manipulator (parametric/polar): "set a, b so the curve traces the target".

---

### 16.3 Physics I: Mechanics — `phys1`

**Prerequisites:** calc1 (can be taken alongside). **Main tools:** projectile-launcher, motion-graph, force-diagram, collision-lab, torque-balance, graph-manipulator.

**U1 — Kinematics** (base 2)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Units, dimensions & vectors | SI units, dimensional analysis, vector components, vector addition |
| l2 | Motion in one dimension | displacement vs distance, velocity vs speed, acceleration |
| l3 | Motion graphs | x–t, v–t, a–t; slopes and areas |
| l4 | Constant acceleration & free fall | kinematic equations, free fall |
| l5 | Projectile motion | independent components, range, maximum height |
| l6 | Relative motion | reference frames, velocity addition |
| l7 | Uniform circular motion | centripetal acceleration, period, frequency |

- **Misconceptions to target:**
  - v = 0 implies a = 0 (top of a throw);
  - heavier objects fall faster;
  - horizontal velocity changes during projectile flight;
  - the slope of v–t is position.
- **Challenges:**
  - projectile-launcher: "hit the target at 30 m"; "find both launch angles that work";
  - motion-graph: "draw the x–t graph for this v–t graph".

**U2 — Newton's Laws** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Forces & free-body diagrams | contact vs field forces, drawing FBDs |
| l2 | Newton's first and second laws | inertia, ΣF = ma, components |
| l3 | Newton's third law & connected objects | action–reaction pairs, Atwood machine, connected blocks |
| l4 | Friction | static vs kinetic, μ, maximum static friction |
| l5 | Inclined planes | resolving gravity, with and without friction |
| l6 | Dynamics of circular motion | centripetal force sources, banked curves, vertical circles |
| l7 | Drag & terminal velocity | drag force, terminal velocity |

- **Misconceptions to target:**
  - motion requires a force;
  - the normal force always equals mg;
  - third-law pairs cancel;
  - centrifugal force as a real force in an inertial frame;
  - static friction is always μₛN.
- **Challenges:**
  - force-diagram: "draw the FBD of a block sliding up a rough incline";
  - graph-manipulator: "set μ so the block just starts to slide".

**U3 — Work & Energy** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Work | work by constant and variable forces, dot product |
| l2 | Kinetic energy & the work–energy theorem | KE, net work |
| l3 | Potential energy & conservation | gravitational and spring PE, conservation of mechanical energy |
| l4 | Non-conservative forces | friction work, energy dissipation |
| l5 | Power | average and instantaneous power, efficiency |
| l6 | Energy diagrams | potential energy curves, turning points, equilibrium |

- **Misconceptions to target:**
  - any force does work;
  - the normal force does work on an incline;
  - spring energy ∝ x;
  - potential energy depends on the path.
- **Challenges:**
  - graph-manipulator (U(x) mode): "set the total energy so the particle is trapped between x = 1 and x = 3".

**U4 — Momentum** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Momentum & impulse | p = mv, impulse–momentum theorem, force–time graphs |
| l2 | Conservation of momentum | isolated systems, explosions, recoil |
| l3 | Collisions in one dimension | elastic, inelastic, perfectly inelastic |
| l4 | Collisions in two dimensions | component conservation |
| l5 | Centre of mass | systems of particles, motion of the centre of mass |

- **Misconceptions to target:**
  - KE is conserved in every collision;
  - momentum is a scalar;
  - the bigger object exerts the bigger force.
- **Challenges:**
  - collision-lab: "choose m₂ so cart 1 stops dead after an elastic collision".

**U5 — Rotation** (base 4)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Rotational kinematics | angular displacement, velocity, acceleration; arc relations |
| l2 | Torque | lever arm, τ = rF sin θ |
| l3 | Moment of inertia | common shapes, parallel-axis theorem |
| l4 | Rotational dynamics | τ = Iα, pulleys with mass |
| l5 | Rotational energy & rolling | rolling without slipping, energy split |
| l6 | Angular momentum | L = Iω, conservation |
| l7 | Static equilibrium | ΣF = 0, Στ = 0, choosing a pivot |

- **Misconceptions to target:**
  - torque doesn't depend on angle;
  - I depends only on mass;
  - rolling KE is purely translational;
  - a heavier hoop rolls slower.
- **Challenges:**
  - torque-balance: "balance the beam using exactly three masses".

**U6 — Oscillations & Gravitation** (base 4)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Simple harmonic motion | spring–mass system, x(t), ω, period |
| l2 | Pendulums | simple pendulum, small-angle approximation |
| l3 | Energy in SHM & damping | energy exchange, damped oscillations |
| l4 | Newton's law of gravitation | inverse-square law, g at altitude |
| l5 | Orbits & Kepler's laws | circular orbits, Kepler's three laws |
| l6 | Gravitational PE & escape speed | U = −GMm/r, escape speed |

- **Misconceptions to target:**
  - period depends on amplitude (small angles);
  - pendulum period depends on mass;
  - astronauts float because there is no gravity;
  - g is the same at all altitudes.
- **Challenges:**
  - graph-manipulator: "set A, ω, φ so x(t) matches the target";
  - "choose the orbit radius for a 24 h period".

---

### 16.4 Physics II: Electricity & Magnetism — `phys2`

**Prerequisites:** phys1, calc1 (calc2 helpful). **Main tools:** circuit-builder, transient-plotter, charge-field, particle-in-field, graph-manipulator.

**U1 — Electric Charge & Field** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Charge & Coulomb's law | quantised and conserved charge, conductors vs insulators, Coulomb's law |
| l2 | Superposition of forces | vector sum of forces from several charges |
| l3 | The electric field | E = F/q, field of a point charge |
| l4 | Field lines | drawing and reading field lines |
| l5 | Continuous charge distributions | line, ring and disk fields by integration |
| l6 | Electric dipoles | dipole moment, torque and energy in a field |

- **Misconceptions to target:**
  - the field exists only where a charge sits;
  - field lines are particle paths;
  - using 1/r instead of 1/r²;
  - adding field magnitudes instead of vectors.
- **Challenges:**
  - charge-field: "place a third charge so the net force on q is zero";
  - "make the field at P point along +x".

**U2 — Gauss's Law & Electric Potential** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Electric flux | flux through flat and closed surfaces |
| l2 | Gauss's law | spherical, cylindrical and planar symmetry |
| l3 | Conductors in equilibrium | E = 0 inside, surface charge, shielding |
| l4 | Electric potential & potential energy | V, ΔV, work by the field |
| l5 | Potential of charge distributions | point charges, superposition of potential |
| l6 | Equipotentials & E = −∇V | equipotential surfaces, finding E from V |

- **Misconceptions to target:**
  - flux depends on the surface's shape;
  - E = 0 implies V = 0;
  - Gauss's law only "works" with symmetry (it always holds; symmetry makes it useful);
  - charge sits inside a conductor.
- **Challenges:**
  - charge-field (potential mode): "make V = 0 at P while E ≠ 0".

**U3 — Current & DC Circuits** (base 3) — **MVP unit; build first**

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Current, resistance & resistivity | current as charge flow, drift, R = ρL/A, conservation of charge |
| l2 | Ohm's law & electrical power | **reference lesson, §7.7** |
| l3 | Series & parallel networks | equivalent resistance, voltage and current division |
| l4 | EMF & internal resistance | terminal voltage, maximum power transfer |
| l5 | Kirchhoff's rules | junction rule, loop rule, multi-loop circuits |
| l6 | Meters in circuits | ammeter and voltmeter placement, loading effects |
| l7 | Capacitors | capacitance, parallel plates, combinations, stored energy, dielectrics |
| l8 | RC circuits | charging, discharging, time constant |

- **Misconceptions to target:**
  - current is used up;
  - the battery supplies constant current;
  - series/parallel confusion;
  - voltmeter connected in series;
  - a capacitor passes steady DC;
  - "τ is the time to fully charge".
- **Challenges:**
  - circuit-builder: "hit the target current"; "make bulb A brightest"; "measure V across R₂ correctly";
  - transient-plotter: "choose R so the capacitor reaches 63% at 2 s".

**U4 — Magnetism** (base 4)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Magnetic force on moving charges | F = qv × B, right-hand rule |
| l2 | Charged particles in fields | circular motion radius, velocity selector, mass spectrometer |
| l3 | Force & torque on currents | F = IL × B, loops, motors |
| l4 | Biot–Savart law | fields of a wire segment and a loop |
| l5 | Ampère's law | long wire, coaxial cable |
| l6 | Solenoids & toroids | field inside, field lines |
| l7 | Magnetic materials | para-, dia- and ferromagnetism (overview) |

- **Misconceptions to target:**
  - the magnetic force does work;
  - the force is parallel to B;
  - same right-hand rule for negative charges;
  - a wire's field is constant with distance.
- **Challenges:**
  - particle-in-field: "set B so the proton hits the detector";
  - "set E so the beam goes straight".

**U5 — Electromagnetic Induction** (base 4)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Faraday's law | magnetic flux, induced EMF = −dΦ/dt |
| l2 | Lenz's law | direction of the induced current |
| l3 | Motional EMF | moving rods, EMF = BLv |
| l4 | Generators & eddy currents | AC generators, magnetic braking |
| l5 | Inductance & RL circuits | self-inductance, RL time constant |
| l6 | LC circuits & field energy | oscillations, energy in E and B fields |
| l7 | AC circuits | RMS values, reactance, impedance (introduction) |

- **Misconceptions to target:**
  - EMF needs flux rather than *change* of flux;
  - Lenz opposes the field rather than the change;
  - a steady large flux gives a large EMF.
- **Challenges:**
  - graph-manipulator: "sketch Φ(t) to produce this EMF pattern";
  - transient-plotter (RL): "set L for τ = 0.1 s".

**U6 — Maxwell's Equations & EM Waves** (base 4)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Displacement current & Maxwell's equations | the four equations in integral form, the missing term |
| l2 | Electromagnetic waves | c = 1/√(μ₀ε₀), E = cB, transverse waves |
| l3 | Energy & intensity | Poynting vector, intensity, radiation pressure |
| l4 | The spectrum & polarization | wavelength bands, polarisers, Malus's law |

- **Misconceptions to target:**
  - EM waves need a medium;
  - E and B are out of phase in a travelling wave;
  - higher intensity means higher frequency.
- **Challenges:**
  - graph-manipulator: "set λ and amplitude to match the wave";
  - "rotate the polariser to transmit 25%".

---

### 16.5 Linear Algebra — `linalg`

**Prerequisites:** algebra (calc1 helpful). **Main tools:** row-reducer, matrix-transform, vector-play, graph-manipulator.

**U1 — Linear Systems** (base 2)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Systems of linear equations | geometric meaning, 0/1/∞ solutions |
| l2 | Row reduction & echelon forms | row operations, pivots, REF, RREF |
| l3 | Vector equations & span | linear combinations, span |
| l4 | The matrix equation Ax = b | matrix–vector product, existence of solutions |
| l5 | Solution sets | homogeneous systems, parametric vector form |
| l6 | Linear independence | definition, testing independence |

- **Misconceptions to target:**
  - row operations change the solution set;
  - a free variable means no solution;
  - two vectors in ℝ³ always span a plane;
  - "independent if no zero vector".
- **Challenges:**
  - row-reducer: "reach RREF in ≤ 6 operations";
  - vector-play: "reach the target as c₁v₁ + c₂v₂".

**U2 — Matrix Algebra & Determinants** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Matrix operations | addition, multiplication, transpose, non-commutativity |
| l2 | The inverse of a matrix | 2×2 inverse, [A | I] method |
| l3 | The invertible matrix theorem | equivalent conditions |
| l4 | LU factorization | LU decomposition, solving with LU |
| l5 | Determinants | cofactor expansion, row-operation method |
| l6 | Properties of determinants | det(AB), det(Aᵀ), area/volume scaling |

- **Misconceptions to target:**
  - AB = BA;
  - (AB)⁻¹ = A⁻¹B⁻¹;
  - det(A + B) = det A + det B;
  - det(kA) = k·det A.
- **Challenges:**
  - row-reducer: "compute A⁻¹ via [A | I]";
  - matrix-transform: "find a matrix with det = −2 that maps the square onto the target".

**U3 — Vector Spaces** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Vector spaces & subspaces | axioms, subspace test |
| l2 | Null space & column space | Nul A, Col A, relation to Ax = b |
| l3 | Bases | spanning plus independent |
| l4 | Dimension & rank | rank–nullity theorem |
| l5 | Coordinates & change of basis | coordinate vectors, change-of-basis matrix |

- **Misconceptions to target:**
  - any set containing 0 is a subspace;
  - using RREF columns as a basis for Col A;
  - dimension = size of any spanning set.
- **Challenges:**
  - vector-play: "pick a basis in which the target has coordinates (2, −1)";
  - row-reducer: "find a basis for Nul A".

**U4 — Linear Transformations** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Linear transformations & matrices | linearity, standard matrix |
| l2 | Geometric transformations in 2D | rotation, reflection, shear, scaling, projection |
| l3 | Composition | matrix product as composition, order |
| l4 | Kernel & range | one-to-one, onto |

- **Misconceptions to target:**
  - translations are linear;
  - AB means "apply A first".
- **Challenges:**
  - matrix-transform: "match the target shape";
  - "compose two given matrices to get a 90° rotation".

**U5 — Eigenvalues & Eigenvectors** (base 4)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Eigenvalues & eigenvectors | Av = λv, geometric meaning |
| l2 | The characteristic equation | det(A − λI) = 0, multiplicities |
| l3 | Diagonalization | A = PDP⁻¹, when it's possible |
| l4 | Complex eigenvalues | rotation–scaling interpretation |
| l5 | Applications | Markov chains, discrete dynamical systems |

- **Misconceptions to target:**
  - the zero vector is an eigenvector;
  - eigenvalues of A + B are sums of eigenvalues;
  - every matrix is diagonalizable;
  - a repeated eigenvalue means non-diagonalizable.
- **Challenges:**
  - vector-play (eigen mode): "drag v until Av ∥ v; find both eigen-directions".

**U6 — Orthogonality & Least Squares** (base 4)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Inner product, length & orthogonality | dot product, norm, orthogonal complements |
| l2 | Orthogonal sets & projections | orthogonal bases, projection onto a subspace |
| l3 | Gram–Schmidt & QR | Gram–Schmidt process, QR factorization |
| l4 | Least squares | normal equations, best-fit lines |
| l5 | Symmetric matrices | spectral theorem (introduction) |

- **Misconceptions to target:**
  - orthogonal implies orthonormal;
  - projecting onto a non-orthogonal basis by summing individual projections.
- **Challenges:**
  - graph-manipulator: "drag the line to minimise SSE, then compare with the exact least-squares fit";
  - vector-play: projection mode.

---

### 16.6 Discrete Mathematics — `discrete`

**Prerequisites:** algebra. **Main tools:** truth-table, parsons, graph-builder, algorithm-stepper, probability-sim (enumerate mode), code-runner.

**U1 — Logic** (base 2)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Propositions & connectives | ∧, ∨, ¬, →, ↔ |
| l2 | Truth tables & equivalence | tautologies, De Morgan's laws |
| l3 | Conditionals | converse, inverse, contrapositive |
| l4 | Predicates & quantifiers | ∀, ∃, negating nested quantifiers |
| l5 | Rules of inference | modus ponens/tollens, valid vs sound arguments |

- **Misconceptions to target:**
  - p → q ≡ q → p;
  - ¬∀x P ≡ ∀x ¬P;
  - "or" is exclusive;
  - a conditional with a false premise is false.
- **Challenges:**
  - truth-table: "fill the table"; "build an expression matching this table using only ¬ and ∧".

**U2 — Proofs** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Direct proof | definitions (even, odd, divides), structure |
| l2 | Contrapositive & contradiction | when to use each |
| l3 | Cases & counterexamples | proof by cases, disproving universal claims |
| l4 | Mathematical induction | base case, inductive step |
| l5 | Strong induction & well-ordering | strong induction, well-ordering principle |

- **Misconceptions to target:**
  - examples prove universal claims;
  - assuming the conclusion;
  - proving P(k) from P(k);
  - skipping the base case.
- **Challenges:**
  - parsons: "order the proof steps", with 2 distractor steps to exclude.

**U3 — Sets, Functions & Relations** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Sets & set operations | ∪, ∩, complement, power set, Venn diagrams |
| l2 | Functions | injective, surjective, bijective, inverses, composition |
| l3 | Cardinality | countable vs uncountable, diagonal argument |
| l4 | Relations | reflexive, symmetric, antisymmetric, transitive |
| l5 | Equivalence relations | equivalence classes, partitions |
| l6 | Partial orders | posets, Hasse diagrams |

- **Misconceptions to target:**
  - ∈ vs ⊆;
  - |A ∪ B| = |A| + |B|;
  - injective means every codomain element is hit;
  - symmetric ⇒ reflexive.
- **Challenges:**
  - graph-builder (directed): "build a relation that is reflexive and transitive but not symmetric".

**U4 — Counting** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Sum & product rules | basic counting |
| l2 | Permutations & combinations | P(n, k), C(n, k), when order matters |
| l3 | Binomial theorem | Pascal's triangle, binomial coefficients |
| l4 | Pigeonhole principle | basic and generalised forms |
| l5 | Inclusion–exclusion | two and three sets |
| l6 | Combinations with repetition | stars and bars |
| l7 | Recurrence relations | setting up recurrences, solving linear homogeneous ones |

- **Misconceptions to target:**
  - order matters / doesn't matter confusion;
  - double counting;
  - adding instead of multiplying;
  - wrong bar count in stars and bars.
- **Challenges:**
  - probability-sim (enumerate): "predict the count, then enumerate small cases to check".

**U5 — Number Theory** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Divisibility | division algorithm |
| l2 | Modular arithmetic | congruences, arithmetic mod n |
| l3 | GCD & the Euclidean algorithm | Euclid, Bézout's identity, extended Euclid |
| l4 | Primes | fundamental theorem of arithmetic, infinitude of primes |
| l5 | Modular inverses | linear congruences |
| l6 | RSA cryptography | key generation, encryption and decryption (basics) |

- **Misconceptions to target:**
  - dividing freely in modular arithmetic;
  - −7 mod 3 = −1;
  - every number has an inverse mod n.
- **Challenges:**
  - algorithm-stepper: "fill the extended Euclid table";
  - code-runner: "implement fast modular exponentiation".

**U6 — Graphs & Trees** (base 4)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Graph basics | degree, handshake lemma, graph types |
| l2 | Paths & connectivity | paths, cycles, connected components |
| l3 | Euler & Hamilton paths | Euler's theorems, Hamilton paths |
| l4 | Bipartite graphs & colouring | 2-colouring, chromatic number |
| l5 | Planar graphs | Euler's formula, K₅ and K₃,₃ |
| l6 | Trees | properties, spanning trees |

- **Misconceptions to target:**
  - Euler vs Hamilton confusion;
  - a tree with n vertices has n edges;
  - the sum of degrees equals the number of edges.
- **Challenges:**
  - graph-builder: "build a graph with an Euler circuit but no Hamilton cycle"; "build a 7-vertex tree with 4 leaves".

---

### 16.7 Data Structures & Algorithms — `dsa`

**Prerequisites:** an introductory programming course (Python or JS); discrete helps. **Main tools:** code-runner, algorithm-stepper, parsons, graph-builder.

**U1 — Foundations** (base 2)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Algorithm analysis | Big-O, Θ, Ω; growth rates |
| l2 | Analysing loops | single, nested and dependent loops; log-time loops |
| l3 | Recursion | call stack, base cases, recursion trees |
| l4 | Recurrences | the master theorem (light) |
| l5 | Amortized analysis | dynamic array doubling |

- **Misconceptions to target:**
  - O(2n) ≠ O(n);
  - nested loops are always n²;
  - Big-O means worst case only;
  - the log base matters.
- **Challenges:**
  - algorithm-stepper ("guess my number" mode): discover binary search;
  - parsons: order a recursive function.

**U2 — Linear Data Structures** (base 2)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Arrays & dynamic arrays | indexing, insert/delete costs |
| l2 | Linked lists | singly and doubly linked, pointer manipulation |
| l3 | Stacks | LIFO, balanced brackets, monotonic stack |
| l4 | Queues & deques | FIFO, circular buffers |
| l5 | Two pointers | sorted-array pair problems, in-place operations |
| l6 | Sliding window | fixed and variable windows |
| l7 | Prefix sums | range queries |

- **Misconceptions to target:**
  - O(1) random access in linked lists;
  - O(1) insert at the front of an array;
  - stack vs queue order.
- **Challenges:**
  - algorithm-stepper: "reverse a linked list pointer by pointer"; "process brackets on the stack";
  - code-runner: "two-sum on a sorted array"; "longest substring without repeats".

**U3 — Hashing** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Hash functions & hash tables | hashing, buckets |
| l2 | Collision handling | chaining, open addressing |
| l3 | Load factor & resizing | rehashing, expected costs |
| l4 | Hash map patterns | counting, grouping, de-duplication |

- **Misconceptions to target:**
  - hash lookup is O(1) in the worst case;
  - equal hashes imply equal keys.
- **Challenges:**
  - algorithm-stepper: "linear-probing inserts";
  - code-runner: "group anagrams".

**U4 — Searching & Sorting** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Binary search | boundaries, off-by-one errors, search on the answer |
| l2 | Elementary sorts | bubble, selection, insertion; stability |
| l3 | Merge sort | divide and conquer, merging, O(n log n) |
| l4 | Quicksort | partition schemes, pivot choice, worst case |
| l5 | Heaps & heapsort | heap property, sift up/down, heapify |
| l6 | Sorting lower bounds & linear sorts | comparison lower bound, counting sort, radix sort |

- **Misconceptions to target:**
  - binary search works on unsorted data;
  - quicksort is always n log n;
  - merge sort is in place;
  - "stable" means "fast".
- **Challenges:**
  - algorithm-stepper: "perform the partition"; "perform the merge"; "sift down";
  - code-runner: "first bad version"; "k-th largest element".

**U5 — Trees** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Binary trees & traversals | pre-order, in-order, post-order, level-order |
| l2 | Binary search trees | search, insert, delete |
| l3 | Balanced trees | AVL rotations (concept), why balance matters |
| l4 | Priority queues | heap-based priority queues |
| l5 | Tries | prefix trees, autocomplete |
| l6 | Tree recursion patterns | height, lowest common ancestor, path sums |

- **Misconceptions to target:**
  - BST in-order traversal isn't sorted;
  - a heap is a BST;
  - BST height is always log n.
- **Challenges:**
  - algorithm-stepper: "insert/delete in a BST"; "identify the AVL rotation"; "click nodes in in-order";
  - code-runner: "validate a BST".

**U6 — Graphs** (base 4)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Graph representations | adjacency list vs matrix, trade-offs |
| l2 | Breadth-first search | shortest paths in unweighted graphs |
| l3 | Depth-first search | cycle detection, topological sort |
| l4 | Dijkstra's algorithm | priority-queue implementation |
| l5 | Bellman–Ford | negative edges, negative-cycle detection |
| l6 | Minimum spanning trees | Kruskal, Prim, union–find |

- **Misconceptions to target:**
  - Dijkstra handles negative edges;
  - DFS finds shortest paths;
  - a topological sort exists for cyclic graphs.
- **Challenges:**
  - algorithm-stepper: "BFS order"; "fill the Dijkstra table"; "pick Kruskal's next edge";
  - code-runner: "number of islands"; "course schedule".

**U7 — Algorithm Design** (base 4)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Greedy algorithms | exchange argument, when greedy fails |
| l2 | Divide & conquer | designing D&C algorithms, recurrences |
| l3 | Dynamic programming I | 1D problems, memoisation vs tabulation |
| l4 | Dynamic programming II | 2D problems: grids, LCS, 0/1 knapsack |
| l5 | Backtracking | subsets, permutations, N-queens, pruning |

- **Misconceptions to target:**
  - greedy is always optimal (coin change counterexample);
  - DP is just recursion;
  - memoisation always lowers complexity.
- **Challenges:**
  - algorithm-stepper: "fill the DP table cell by cell";
  - code-runner: "coin change", "LCS", "climbing stairs" (with performance tests).

---

### 16.8 Probability & Statistics — `probstat`

**Prerequisites:** calc1 (calc2 helpful for continuous distributions). **Main tools:** probability-sim, distribution-fitter, graph-manipulator.

**U1 — Probability Foundations** (base 2)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Sample spaces & events | outcomes, events, axioms |
| l2 | Counting-based probability | equally likely outcomes, using combinatorics |
| l3 | Conditional probability | P(A|B), multiplication rule |
| l4 | Independence | independent vs mutually exclusive events |
| l5 | Total probability & Bayes' theorem | partitions, Bayes, base rates |

- **Misconceptions to target:**
  - the gambler's fallacy;
  - P(A|B) = P(B|A);
  - independent = mutually exclusive;
  - base-rate neglect.
- **Challenges:**
  - probability-sim: "Monty Hall: predict, then simulate"; "birthday problem: find the group size for P > 0.5".

**U2 — Random Variables** (base 3)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Discrete random variables | PMF, CDF |
| l2 | Expectation & variance | linearity of expectation, variance rules |
| l3 | Binomial & geometric | settings, formulas, mean and variance |
| l4 | Poisson | Poisson process, Poisson approximation |
| l5 | Continuous random variables | PDF, CDF, probability as area |
| l6 | Uniform & exponential | memorylessness |
| l7 | The normal distribution | z-scores, standard normal tables |

- **Misconceptions to target:**
  - a PDF value is a probability;
  - Var(X + Y) = Var X + Var Y always;
  - E[1/X] = 1/E[X];
  - Var(aX) = a·Var(X).
- **Challenges:**
  - distribution-fitter: "set p so the binomial matches the histogram"; "set λ so P(X > 3) = 0.2".

**U3 — Joint Distributions & Limit Theorems** (base 4)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Joint distributions | joint, marginal and conditional distributions |
| l2 | Covariance & correlation | Cov, ρ, independence vs uncorrelated |
| l3 | Sums of random variables | mean and variance of sums |
| l4 | The law of large numbers | convergence of sample means |
| l5 | The central limit theorem | sampling distribution of the mean, normal approximation |

- **Misconceptions to target:**
  - zero correlation implies independence;
  - the CLT says the data become normal;
  - the LLN applies to small samples.
- **Challenges:**
  - probability-sim: "choose n so the SD of the sample mean is < 0.1"; "watch the CLT histogram emerge".

**U4 — Statistical Inference** (base 4)

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Descriptive statistics | centre, spread, outliers, plots |
| l2 | Sampling distributions & standard error | SE of the mean and of proportions |
| l3 | Confidence intervals | construction, interpretation, margin of error |
| l4 | Hypothesis testing | null/alternative hypotheses, test statistics, p-values |
| l5 | Errors & power | Type I/II errors, power, sample size |
| l6 | Simple linear regression | least squares line, R², residuals |

- **Misconceptions to target:**
  - a computed 95% CI contains μ with probability 0.95;
  - p-value = P(H₀ is true);
  - failing to reject means H₀ is true;
  - correlation implies causation.
- **Challenges:**
  - probability-sim: "simulate 100 CIs; predict how many contain μ";
  - graph-manipulator: "fit the regression line by dragging, then compare with least squares".

---

## 17. Final acceptance checklist

- [ ] Deployed on GitHub Pages from `main` by GitHub Actions; deep links and refreshes work.
- [ ] All 8 subjects and every unit/lesson in §16 are browsable; unfinished lessons show "Coming soon".
- [ ] The reference lesson (§7.7) is implemented exactly and passes the validator.
- [ ] phys2 U3 is complete (8 lessons with challenges) — the MVP.
- [ ] Each lesson follows: intro → 6-step linked chain with explanations after every answer → interactive challenge → summary, with an Explanations tab.
- [ ] Facts panel, hint ladder, "↩ builds on" chips, remediation and bonus insertion all work.
- [ ] Adaptive variant selection targets ~78% success; ratings update; difficulty rises across units.
- [ ] Review mode resurfaces missed questions with new numbers.
- [ ] Progress persists, resumes mid-lesson, and exports/imports.
- [ ] `content:check`, unit tests and e2e smoke all pass in CI.
- [ ] Keyboard-only play-through of a full lesson is possible; contrast meets AA; reduced motion respected.
- [ ] Initial JS ≤ 250 KB gzipped; Pyodide and challenge modules lazy-load.
- [ ] `DECISIONS.md` lists every judgement call made during the build.
