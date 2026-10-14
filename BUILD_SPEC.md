# Build Spec — Adaptive Practice Platform for College Subjects

> **Working title:** Stepwise (defined once in `src/config.ts` — rename freely).
> **Audience:** the coding agent that will build this platform.
> **Status:** this document is the single source of truth. Read it fully before writing any code.
> **Version 2:** reworked to be interaction-first, in the style of Brilliant: every lesson is a run of short, hands-on screens, and practice continues long after the lesson ends.

---

## Table of contents

0. Instructions for the coding agent
1. Product summary
2. Learning design (lesson anatomy, screen types, chains, feedback, pedagogical patterns)
3. Adaptive engine & practice system (ratings, memory, mastery, practice modes, motivation)
4. Hosting & technical constraints (GitHub Pages)
5. Tech stack
6. Repository structure & scripts
7. Content model (schemas + complete reference lesson)
8. Lesson player & practice player behaviour
9. Interaction framework: question widgets, interactives, puzzle packs
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
   - Sections 1–3 describe the product, the learning design and the practice system.
   - Sections 4–13 describe the engineering.
   - Section 14 is the build order; Section 15 sets the content quality rules; Section 16 is the syllabus for every subject.
2. **Build in the phase order of Section 14.**
   - Every phase ends with a working site deployed to GitHub Pages.
   - Do not start a phase until the previous phase's acceptance criteria pass.
3. **Hard constraints. Never violate these:**
   - Static site only, hosted on GitHub Pages. No server, no database, no login, no paid services, no API keys.
   - All progress lives in the browser (`localStorage`), with export/import as a JSON file.
   - Every numeric answer, wrong answer and distractor is computed from expressions and verified by the content validator. Never hand-type a computed number into an answer.
   - Every interactive task, challenge and puzzle level ships with a machine-checkable `solution`. The validator proves it passes its check for every parameter set.
   - All math is rendered with KaTeX.
4. **Interaction first.** At least 75% of the screens in every lesson ask the learner to *do* something: predict, drag, build, type, sort, tap. Multiple choice is one widget among many, never the default.
5. **Ambiguity.** Choose the simplest option consistent with this document, implement it, and record it in `DECISIONS.md` (one line each: date, decision, reason).
6. **Commits.** Keep them small and phase-labelled, e.g. `phase-2: order widget`.
7. **Content is the product.**
   - Follow Section 15 strictly.
   - A lesson is not done until `npm run content:check` passes with zero errors.
   - Use the reference lesson in §7.8 as the quality bar for every lesson.
8. **No extra features.** Do not add features outside this spec unless a phase asks for them: no social features, global leaderboards, AI chat, or accounts.

---

## 1. Product summary

A **practice-first, hands-on** learning platform for college subjects:

- Calculus I & II
- Physics I (Mechanics) & II (E&M)
- Linear Algebra
- Discrete Mathematics
- Data Structures & Algorithms
- Probability & Statistics

Students learn by **doing**, as on Brilliant: they play with a model, notice a pattern, get the rule named, then use it in a chain of linked problems and interactive challenges. Reading is kept to a few short concept cards per lesson.

**Core ideas**

- **Lesson shape:** hook → explore → name it → linked practice chain → interactive challenges → recap. 15–25 short screens, about 15–20 minutes.
- **Learn by doing.** Most screens are interactive: sliders, circuits to build, graphs to drag, items to sort, diagrams to tap, numbers and expressions to type.
- **Predict before you see.** Simulations and reveals start with a committed prediction, so the result is a surprise to explain, not a fact to read.
- **Chained problems.** Questions in a lesson are linked:
  - an earlier question contains a clue that helps with a later one;
  - a later question asks something *different* but uses an earlier answer as one of its parts;
  - a Facts panel keeps what's been established in view, so students reason from it.
- **Explanation after every problem.** Each problem has a full written explanation, shown right after answering and collected in the lesson's **Explanations** tab.
- **Adaptive difficulty.** The engine aims for 70–85% success, so practice is never boring and never crushing, and it rises over time.
- **Lots of practice beyond the lesson:**
  - a practice set for every lesson, with fresh numbers each time;
  - daily practice that mixes spaced review, weak spots and one stretch problem;
  - interleaved "choose the method" sets, unit checkpoints, speed rounds, hard-mode problems;
  - **puzzle packs**: 10–20 level series for most interactives (circuit puzzles, graph-function targets, field hockey, logic gates, algorithm steppers…);
  - a sandbox for every interactive, and a challenge creator that shares puzzles by link.
- **Diagnostic wrong answers.** Every wrong option or typed wrong answer can map to a named misconception, with targeted feedback and tracking.

**Target users:** first- and second-year university students studying alongside their courses. Interface language is English; SI units throughout.

---

## 2. Learning design

### 2.1 Principles

These come from Brilliant's approach and from the research summarised in §2.8. Every design decision should trace back to one of them.

1. **Play before the rule.** Learners manipulate a model and discover a pattern; the concept card names it *afterwards*.
2. **Every screen asks for action.** Short text, then something to do. Never two reading screens in a row.
3. **Predict, then observe.** A reveal without a prediction teaches little; a committed prediction makes the result stick.
4. **Generate, don't just recognise.** Typing a number or expression, building a circuit, or sketching a graph produces more learning than picking from a list. Multiple choice is capped at 35% of question screens.
5. **Freedom to fail.** Mistakes cost nothing beyond a lower score on that step. No lives, no hearts, no lost XP.
6. **Freedom of effort.** Hints and solutions are always on demand, in a ladder from a nudge to a worked step.
7. **Feedback that means something.** Show *what the answer implies* (run the learner's circuit, plot the learner's expression, name the misconception), not just right or wrong.
8. **Easy to start, hard to finish.** Each lesson and puzzle pack opens with a win in under a minute and ends with a real challenge.
9. **Space and mix.** After a lesson, practice comes back spaced over days and mixed with other topics, because that is what makes it last.

### 2.2 Lesson anatomy

| Phase | Screen types | Count | Purpose |
|---|---|---|---|
| Hook | `hook` | 1 | A predict-then-observe moment or a try-first problem. Creates the need for the lesson. Ungraded. |
| Explore | `explore` | 2–4 | Manipulate an interactive through 2–5 small gated goals; discover the pattern. |
| Name it | `concept` | 1–3 | ≤ 80 words each, right after the exploration it names. Never two in a row. |
| Worked example | `worked` | 0–2 | Step-by-step reveal with faded steps the learner fills in (procedural topics). |
| Practice chain | `question` | 8–12 | Linked questions: ≥ 6 adaptive `core` steps plus quick `check` steps. Varied widgets. |
| Challenges | `challenge` | 2 | One mid-lesson, one final. Build or solve with an interactive; 3 difficulty variants each. |
| Recap | `recap` | 1 | Key takeaways, a self-explanation prompt, and what's next. |

**Totals:** 15–25 screens per lesson, roughly 15–20 minutes. At least 75% of screens ask for action.

The order is flexible within these rules, and phases interleave: explore → name it → questions → explore → name it → questions is typical (see §7.8). Rules enforced by the validator:
- The first screen is a `hook`; the last is a `recap`.
- At least 2 `explore` screens and exactly 2 `challenge` screens.
- **Variety, counted on the `standard` variant of each question screen:** ≥ 5 distinct question kinds; `mcq` ≤ 35%; ≥ 2 core steps use a *generative* kind (`numeric`, `expression`, `blanks`, `table`, `matrix`, `tokens`, `graph-point`, `sketch` or `code`).
- **Variety on every track:** taking the all-`easier`, all-`standard` or all-`harder` variants in turn, `mcq` is ≤ 50% and no kind appears more than 3 times in a row.
- At least 1 remediation step in `extras`.

After the lesson, the learner gets a **practice set** (§3.5) drawn from the lesson's practice pool.

### 2.3 Screen types

| Type | What the learner sees and does |
|---|---|
| `hook` | A situation and a prediction to commit (any widget, usually ungraded). Then either a **reveal** (an interactive to run, with a caption naming the surprise) or a **try-first** comparison (2–3 sample student attempts and the canonical method, §2.8). |
| `explore` | One interactive plus a short list of goals ("Make the ammeter read 2 A"). Goals unlock one at a time. A goal may be preceded by a `predict` task or followed by an `ask` question about what was observed. Ends with a one-line takeaway. |
| `concept` | A short card that **names** what was just discovered: ≤ 80 words, one formula or diagram, optionally a non-gated interactive. |
| `worked` | A worked example revealed one step at a time. Steps can contain blanks to fill (`fade: adaptive` blanks more steps as the learner improves). |
| `question` | One step of the chain: a question widget (§9.2) with hints, two attempts and a full explanation. Adaptive variants for core steps. |
| `challenge` | An interactive with a measurable goal, check button, hint ladder, targeted feedback and a validated solution. |
| `recap` | Takeaways, a self-explanation prompt with an expert answer and a self-check list, then "Practice this lesson" and "Next lesson" buttons. |

### 2.4 How chains work: `uses`, `clueFor`, `establishes`

| Field | Meaning | Effect in the UI |
|---|---|---|
| `uses: [s1, s3]` | This step needs the answer or insight of earlier steps. | Shows a "↩ builds on Q1, Q3" chip. Tier-2 hint points back to those steps. |
| `clueFor: [s4]` | This step's prompt or explanation contains a clue for a later step or challenge. | Authoring aid only; checked by the validator. Not shown to students. |
| `establishes: "…"` | A short fact the step establishes. | Added to the **Facts panel** once the step is answered (right or wrong). |

**The Facts panel**
- Stays visible during the whole lesson; explore takeaways are added to it too.
- Shows lines like "Single resistor: I = 2 A through 3 Ω at 6 V".
- Students reason from established facts instead of memorising them.

Previously answered screens stay reachable (a back arrow and a collapsible history), so the student can always re-read the context.

**Chain rules** (enforced by the validator):
- Every lesson has ≥ 2 `uses` links and ≥ 1 `clueFor` link.
- The last core step uses ≥ 2 earlier steps.
- `uses` only points backwards; `clueFor` only points forwards (to a step or a challenge).

### 2.5 Answering, feedback and hints

**Attempts**
- Every graded question allows **2 attempts**.
- After a wrong first attempt:
  - the widget keeps the learner's answer visible and marks what was wrong (for example, the misplaced cards in a categorize question, or the wrong option disabled);
  - if the answer matches a known misconception (a tagged option, a `wrongAnswers` value, a `wrongOrders` order, a tagged card, a `wrongTargets` element), its one-line `short` text is shown;
  - otherwise a neutral "Not quite — try again, or open a hint."
- After a correct answer, or a second wrong attempt:
  - the correct answer is shown in the widget,
  - the full explanation appears,
  - the Facts panel updates,
  - a **Continue** button appears.

**Interpretive feedback.** Where a widget can, it shows what the learner's answer *means*, without giving the answer away before the final attempt:
- after a wrong first attempt: direction only ("too high", "grows too fast"), plus the misconception label if it matches;
- after the final attempt: a numeric answer on a number line next to the correct value; an expression plotted against the correct one; a sketch overlaid on the true curve;
- in challenges, live readings of the learner's own build at all times ("your circuit draws 0.75 A").

**Staged explanations.** Long explanations can be split into steps with a "Show next step" button, so the learner can stop as soon as it clicks.

**Hint ladder** (on demand, never automatic):
1. `nudge` — authored. Points in the right direction without formulas plus numbers.
2. `buildsOn` — auto-generated from `uses` plus the Facts panel, e.g. "This builds on Q1: I = 2 A". An authored override is allowed.
3. `partial` — authored. Does about half the work.

A tier with nothing to show (no `uses` and no authored `buildsOn`) is skipped. The score (§2.6) uses the highest tier actually opened.

After a learner uses tier 3 or "Show solution", that concept gets a `freshNext` flag: the next time it comes up in practice it is served with a **different item**, so the worked answer can't simply be repeated.

**Predictions** (`graded: false`) never show right or wrong at commit time. A prediction may mark the option or value that turns out to be true (`correct`), so the reveal can say "You predicted it" or "Surprised? Here's why"; predictions never change ratings or scores.

**Ungraded work.** Predictions, explore `ask` tasks, `explain` answers and worked-screen blanks never change scores or ratings. `ask` tasks still get two attempts, hints and explanations.

**Confidence prompt** (optional, off by default in Settings). After answering, the learner taps "Sure / Unsure". Confident errors get a highlighted explanation, because confident mistakes are corrected best when they're flagged.

**Keyboard:** `1`–`9` select options, `Enter` submits or continues, `H` opens the next hint, arrow keys move between draggable items.

### 2.6 Scoring per step

| Outcome | Score |
|---|---|
| Correct on first try, no hints | 1.0 |
| Correct on first try after tier-1 hint | 0.8 |
| Correct on first try after tier-2 hint | 0.6 |
| Correct on second try, or after tier-3 hint | 0.3 |
| Wrong twice | 0.0 |

Multi-part widgets (categorize, order, match, table, multi) score all-or-nothing per attempt, but show which parts were right.

### 2.7 Difficulty bands

| Band | Meaning | Typical use |
|---|---|---|
| 1 | Recall or a single definition | `easier` variant of an early step |
| 2 | One-step application with a small twist | early chain steps, first puzzle levels |
| 3 | Two steps; combines an earlier answer | middle of chain |
| 4 | Multi-step; needs a non-obvious insight from the chain | late chain, final challenge |
| 5 | Novel situation or synthesis across lessons | `harder` variants, bonus, hard mode, last puzzle levels |

**Rules**
- For every core step and challenge: `easier.difficulty < standard.difficulty < harder.difficulty`.
- `standard` difficulty of core steps is between 2 and 4, non-decreasing through the lesson, roughly `2, 2, 3, 3, 4, 4`.
- Each unit has a `baseDifficulty` (2–4) that rises through a subject. A lesson's mean core `standard` difficulty must be within ±0.5 of it (validator warning).
- **Net effect: the material gets harder over time, and the adaptive engine moves each student up or down within that.**

### 2.8 Pedagogical patterns (use them deliberately)

| Pattern | What it is | Where to use it | Evidence behind it |
|---|---|---|---|
| **Predict–observe–explain** | Commit a prediction, run the model, explain the gap. | Every hook with a reveal; any explore goal whose outcome is surprising. | Predicting before a demo raised correct explanations compared with only watching (Crouch et al. 2004). |
| **Try first (productive failure)** | Attempt a new kind of problem before instruction, then compare 2–3 sample attempts with the canonical method. No right/wrong shown during the attempt. | 3–5 "big idea" lessons per subject (marked `tryFirst: true`, listed in §16). Not for routine procedures. | Meta-analysis of 53 studies: d ≈ 0.36 for conceptual understanding and transfer, no gain for procedures (Sinha & Kapur 2021). |
| **Explore with productive constraints** | Interactives expose only the controls that matter, with limited ranges and good default values. | Every `explore` screen. | PhET's "implicit scaffolding" research: guide without the learner feeling guided; defaults strongly change what learners notice. |
| **Faded worked examples** | Worked example → same example with blanks → independent problem. Blank more steps as the rating rises; skip the example for strong learners. | `worked` screens in procedural lessons (integration techniques, row reduction, induction, DP). | Worked-example meta-analysis in math g ≈ 0.43; fading beats fixed examples; examples can hurt experts (expertise reversal). |
| **Self-explanation** | "Why does this work?" in free text, then compare with an expert answer and a checklist. | Recap screens; after key worked steps. | Meta-analysis of 64 studies: g ≈ 0.55 (Bisra et al. 2018). |
| **Erroneous examples** | "Find the mistake in this solution", then fix it. | `find-the-error` questions, at least one per unit. | Better delayed retention than correct examples alone (McLaren et al.). |
| **Interleaving** | Mixed problems from several topics, without topic labels, where the learner must choose the method. | Mixed sets, unit checkpoints, daily practice. Block briefly when a topic is new. | Classroom trial: mixed practice 61% vs blocked 37% a month later (Rohrer et al. 2020). |
| **Spacing** | Return to a concept after increasing gaps. | The memory model in §3.3 drives all review. | Spaced 74% vs massed 49% after one week; over-drilling in one session adds nothing (Rohrer & Taylor 2007). |
| **Retrieval with feedback** | Recall before re-reading; always give feedback. | All practice. | Testing beats restudy (g ≈ 0.50), and much more with feedback (Rowland 2014). |
| **Misconception-based distractors** | Wrong options and wrong-answer matches come from real student errors (concept inventories). | Every graded question. | Concept-inventory research; middle-ability students pick these distractors most. |

---

## 3. Adaptive engine & practice system

All engine code lives in `src/engine/` and `src/practice/` as pure, unit-tested TypeScript functions with no React imports.

### 3.1 Ratings (Elo-style)

**Student ratings**
- Each student has a rating per **concept** (slugs like `ohms-law`) and per **subject**.
- Initial subject rating: 1000.
- A new concept's rating starts at the student's current subject rating.

**Question rating** comes from its band, centred on the unit's `baseDifficulty` *b*: `D = 780 + 150 × (difficulty − b)`.
- At the starting rating of 1000, an item at the unit's base level has `p ≈ 0.78`; one band harder `p ≈ 0.60`; one band easier `p ≈ 0.89`.
- Practice items use the base of the unit their lesson belongs to.

There is no crowd data on a static site, so question ratings are fixed author priors.

**Expected success:** `p = 1 / (1 + 10^((D − R) / 400))`.
- For `mcq` with k options, correct for guessing: `p' = 1/k + (1 − 1/k) × p`.

**Update after each graded step** (score from §2.6):
- `R_concept ← R_concept + K × (score − p)`
  - `K = 40` for the first 10 answers in that concept, then `K = 20`.
- `R_subject ← R_subject + (K / 2) × (score − p)`

Predictions, explore tasks and self-explanations never change ratings.

### 3.2 Variant selection

Each core step and each challenge has three variants (`easier`, `standard`, `harder`). They share the same scenario, the same role in the chain, and the same `establishes` fact.

**Serve `standard` unless the learner's rating says otherwise.** Compute `p_std`, the expected success on the `standard` variant, then:

| Situation | Rule |
|---|---|
| Default | `standard` if 0.60 ≤ `p_std` ≤ 0.92; `harder` if `p_std` > 0.92; `easier` if `p_std` < 0.60 |
| Last 2 graded steps both scored < 0.5 | `easier` unless `p_std` > 0.80; also insert the remediation step for the missed step, if one exists in `extras` |
| Last 3 graded steps all scored ≥ 0.8 | `harder` if `p_std` > 0.80; also offer the bonus step, if one exists (the learner may skip it) |
| Very first lesson a learner opens in a subject | `standard` for the first core step |

Because the chain's `standard` difficulties rise through the lesson (§2.7), a typical learner meets the lesson as written, while strong and struggling learners are shifted one band up or down.

Store chosen variant ids and the parameter seed in the attempt state, so a page refresh never changes the numbers or the variants.

### 3.3 Memory model (spacing)

Each concept has a memory **half-life** `h` (days) and a `lastPracticed` time.

- **Recall estimate:** `m = 2^(−Δ / h)`, where Δ is days since last practice.
- **Due for review** when `m < 0.8`.
- **Start:** the first graded answer in a concept sets `h = 1` day.
- **After each graded practice item in that concept:**

  | Score | Update |
  |---|---|
  | ≥ 0.8 and the concept was due | `h ← h × 2.5` |
  | ≥ 0.8 but not yet due (early review) | `h ← h × 1.3` |
  | 0.4–0.79 | `h ← h × 1.1` |
  | < 0.4 | `h ← max(0.5, h × 0.5)` |

  Cap `h` at 180 days.
- **Implicit credit.** A correct answer (≥ 0.8) in a concept also refreshes its prerequisite concepts (`requires` in `concepts.yaml`): each prerequisite with rating ≥ 1050 gets `h ← h × 1.2` and its `lastPracticed` updated. Advanced practice therefore keeps the basics fresh without extra drills.
- **Failure propagation.** A score < 0.4 on an item whose concept has prerequisites marks the weakest prerequisite (lowest `m`) as due (`dueOverride`, cleared by its next practice).

### 3.4 Completion, stars and mastery

**Lessons**
- **Completed:** all core steps answered and both challenges attempted.
- **Stars:**
  - ★ completed
  - ★★ mean core score ≥ 0.7
  - ★★★ mean core score ≥ 0.9 **and** both challenges solved without the tier-3 hint
- **Lesson practised:** practice set finished with ≥ 80%.

**Concepts** (shown only after ≥ 3 graded answers in that concept)

| Level | Rule |
|---|---|
| Practised | ≥ 3 graded answers |
| Proficient | rating ≥ 1150 **and** ≥ 3 of the last 4 answers scored ≥ 0.8, on at least 2 different items |
| Mastered | Proficient **and** answered correctly in a unit checkpoint or in a review at least 3 days after first reaching Proficient |

- A concept whose recall estimate `m` falls below 0.5 shows a **"Needs review"** badge, but keeps its level.

**Units**
- **Unit mastered:** unit checkpoint passed (≥ 80%) **and** every lesson completed or tested out.

**Unlocking is soft.** If a lesson's prerequisites aren't completed, show a "Recommended first: …" notice with links, but keep the lesson open. Practice modes that need completed lessons say what unlocks them.

### 3.5 Practice modes

All practice is reachable from the **Practice** hub and from each subject page. Items come from lesson practice pools (§7.7), mixed sets, speed rounds and puzzle packs. Lesson core-step variants are served outside their lesson only in **hard mode**, always with their `standaloneContext`, a fresh lesson param draw, and no `buildsOn` hint or "Connects to" line.

| Mode | What it is | Unlocks | Details |
|---|---|---|---|
| **Lesson practice set** | 8 items from the lesson's practice pool, with scaffolds removed: no Facts panel, no chain context, no tier-2 hint. | Lesson completed | Variant difficulty targets p ≈ 0.78. ≥ 80% marks the lesson "practised". Retake any time with new numbers. |
| **Daily practice** | About 10 minutes, 8–10 items. Shown on Home as "Today". | First lesson completed | Fill in this order until 8 items: up to 5 due concepts (lowest `m` first), 2 weak concepts (lowest rating), 1 item from an older unit, 1 **stretch** item (band ≥ 4), then items from the most recently completed lesson's pool. If fewer than 8 distinct items exist, run a shorter session. No two consecutive items from the same concept. |
| **Daily puzzle** | One puzzle level per day from an unlocked puzzle pack. | Any puzzle pack unlocked | Chosen deterministically from the date and the learner's unlocked packs, preferring levels not yet solved. |
| **Mistakes review** | Replays practice items answered wrong in the last 14 days, with fresh numbers. A missed *lesson* question is replayed as a practice item for the same concept. | Any wrong answer | Removing an item requires answering it correctly twice, on different days. |
| **Choose the method (mixed sets)** | Interleaved problems from several lessons. Each item first asks *which method fits* (graded), then the problem itself. | ≥ 2 of the set's lessons completed | Defined in `content/<subject>/mixed/`. Examples are listed in §16 for each subject. |
| **Unit checkpoint** | 12–15 interleaved items across the unit's lessons, drawn from their practice pools. No hints, untimed. | Always open | ≥ 80% passes. Missed concepts become due. Retake after 24 h with different items. Taking it *before* the unit and passing marks its lessons "tested out". |
| **Speed round** | 60–90 seconds of short items for automatic skills (derivative rules, unit conversions, Big-O, matrix products, truth values, modular arithmetic, z-scores). | Named lesson completed | Score = correct answers; personal best per round. No penalty, no effect on ratings, mastery or the streak. |
| **Hard mode** | The band-5 items of the unit's practice pools (each unit has ≥ 3) plus every core step's `harder` variant. No hints. | Unit's lessons completed | Double XP. Shown as a separate badge on the unit. |
| **Puzzle packs** | 10–20 levels per interactive, rising in difficulty, with par values for stars. | The lesson that introduces the interactive | See §9.5. |
| **Sandbox** | The interactive with every control unlocked and no goal. | Same as puzzle packs | See §9.5. Learners can save a build and turn it into a shareable challenge (§9.6). |

**Per-mode settings** (the `:mode` slug in `#/practice/:mode/:id?`, the hints allowed, and the difficulty target for item selection):

| Slug | Hints | Target `p` | Counts for streak |
|---|---|---|---|
| `lesson` | tiers 1 and 3 | 0.78 | yes |
| `daily` | all | 0.78 (stretch item 0.65) | yes |
| `mistakes` | all | — (replays) | yes |
| `mixed` | tiers 1 and 3 | 0.78 | yes |
| `speed` | none | — (fixed short items) | no |
| `hard` | none | — (band 5 and `harder` only) | yes |
| checkpoint (`#/checkpoint/:unitId`) | none | 0.70 | yes |
| puzzles (`#/puzzles/…`) | all | — (fixed levels) | each solved level counts as one item |

### 3.6 Practice session engine

`src/practice/session.ts` builds every practice session with one function:

```ts
buildSession(mode, progress, content, seed): SessionItem[]
```

- **Fresh numbers.** Every served item draws a new parameter seed.
- **No repeats.** The same item id never appears twice in a session, and an item answered in the last 24 hours is skipped unless the pool is exhausted.
- **Difficulty.** For each concept, pick the item (or variant) whose `p` is closest to the mode's target: 0.78 for practice sets and daily practice, 0.65 for stretch items, 0.70 for checkpoints.
- **Interleaving.** Order items so that no two consecutive items share a concept, except in lesson practice sets, where items are ordered from easiest to hardest.
- **End screen.** Score, concepts touched with their level changes, misconceptions met, and the next recommended action (a lesson, a practice set or a puzzle pack).

### 3.7 Motivation (static-friendly)

| Feature | Rule |
|---|---|
| **XP** | Effortful work earns XP. Graded item: `round(10 × difficulty / 3 × score)`. Challenge or puzzle level: 3× that. Lesson completed: +20. Hard mode: 2×. Speed round: 1 XP per correct answer. Re-answering the same item within 24 h earns nothing. XP is never taken away. A typical lesson earns about 150 XP; a daily practice session about 80. |
| **Daily goal** | The learner picks Casual (50 XP, about 6 minutes), Regular (100, about 12 minutes) or Serious (200, about 25 minutes). Shown as a ring on Home. Separate from the streak. |
| **Streak** | A day counts with **1 completed lesson or 3 graded practice items**. Day boundary is local midnight. |
| **Streak charges** | Earn 1 charge for each completed lesson or practice set; hold at most 2. A missed day automatically uses a charge and keeps the streak without extending it. |
| **Path map** | Each subject is drawn as a path of nodes (lessons, practice sets, checkpoints, puzzle packs), coloured by state (locked hint, available, in progress, completed, mastered). |
| **Personal bests** | Speed-round scores, puzzle stars, longest streak, weekly XP chart. |
| **Celebrations** | Subtle animation on correct answers, completed lessons and streak milestones. Respect reduced motion. |

**Deliberately not included:**
- Leagues and global leaderboards (they need a backend, and the evidence is mixed: leaderboards with mandatory badges have lowered motivation and grades).
- Lives, hearts or XP penalties (they punish the mistakes that learning needs).
- XP for repeating easy content.

### 3.8 What "evolves over time" means on a static site

1. **Per learner:**
   - concept ratings drive variant choice,
   - units get harder through each subject,
   - the memory model brings concepts back before they fade,
   - puzzle packs and hard mode keep raising the ceiling.
2. **Per item:** parameterised questions and puzzle levels produce fresh numbers every time they're served.
3. **Content:**
   - New lessons, practice items, puzzle levels and mixed sets are added to the repo over time.
   - Each question has a `version`; when it increases, that item's stored history for the learner is reset.
4. **Future, not v1:** cross-learner analytics.
   - Implement an `AnalyticsAdapter` interface (`track(event: AnalyticsEvent): void`) with a **no-op default**, and call it at:
     - question answered,
     - hint opened,
     - challenge or puzzle checked,
     - lesson or practice session completed.
   - A future backend could use these events to calibrate question difficulty from real answers, show "% of learners who got this right", and flag confusing items.
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
- **Share links.** Custom challenges (§9.6) are encoded into the URL hash with `lz-string`. No server is involved.
- **Performance budget:**
  - Initial JS ≤ 250 KB gzipped, excluding lazily loaded chunks.
  - The reference lesson is interactive in < 2 s on a mid-range laptop.
  - Every interactive runs at 60 fps on a mid-range phone.
- **Lazy loading:**
  - per-subject content JSON,
  - each question widget beyond the core set, and each interactive, as its own chunk,
  - Pyodide only when a Python code item is opened,
  - three.js only for the `revolve-viewer` interactive.

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
| Expressions | `mathjs`: answers, wrong answers, templates, checks, and expression-equivalence testing |
| Drag and drop | `@dnd-kit` (pointer, touch and keyboard sensors) |
| Content format | YAML in `content/`, parsed with `yaml`, validated with Zod at build time |
| Plots & interactives | Custom SVG/Canvas components; three.js only for `revolve-viewer` |
| Code editor | CodeMirror 6 |
| Code execution | JavaScript in a Web Worker; Python via Pyodide (pinned version, CDN) in a Web Worker |
| Share links | `lz-string` |
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
├─ content/                      ← see §7.1
├─ scripts/
│  ├─ build-content.ts           ← validate, then emit public/content/index.json and public/content/<subjectId>.json
│  └─ validate-content.ts        ← all rules from §13.2 (also used by build-content)
├─ src/
│  ├─ config.ts                  ← APP_NAME, APP_KEY, defaults
│  ├─ app/                       ← routes, layout, pages
│  ├─ content/                   ← Zod schemas (shared with scripts), loaders, types
│  ├─ engine/                    ← elo.ts, select.ts, params.ts, template.ts, format.ts, scoring.ts, memory.ts, mastery.ts, expr.ts
│  ├─ practice/                  ← session.ts, modes/*.ts, xp.ts, streak.ts
│  ├─ player/                    ← LessonPlayer, ScreenRenderer, HintLadder, FactsPanel, ExplanationPanel, Recap, PracticePlayer
│  ├─ widgets/                   ← one folder per question kind (§9.2) + registry.ts
│  ├─ interactives/              ← one folder per interactive (§9.4) + registry.ts + InteractiveHost.tsx
│  ├─ puzzles/                   ← pack browser, level player, sandbox, creator, share-link codec
│  ├─ storage/                   ← progress.ts, migrations.ts, exportImport.ts
│  ├─ analytics/                 ← AnalyticsAdapter + no-op
│  ├─ components/                ← shared UI
│  └─ styles/
├─ tests/
│  ├─ unit/                      ← Vitest only looks here
│  └─ e2e/                       ← Playwright only looks here
└─ public/
```

### 6.2 npm scripts

| Script | Does |
|---|---|
| `dev` | `content:build` (watch mode) + `vite` |
| `content:check` | validate all content; exit non-zero on any error; print warnings |
| `content:build` | validate, then emit JSON into `public/content/` |
| `build` | `content:build` then `vite build` |
| `test` | Vitest (`tests/unit`) |
| `build:e2e` | `vite build --mode e2e` into `dist-e2e/` (sets `VITE_DEBUG=1`, which turns on the debug API in §13.3) |
| `test:e2e` | `build:e2e`, then Playwright (`tests/e2e`) against `vite preview --outDir dist-e2e` |
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
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
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
- **Lesson id:** `<subject>.u<N>.l<M>`, e.g. `phys2.u3.l2`. Its file path must be `content/<subject>/u<N>/l<M>.yaml`.
- **Placeholder lessons:** a lesson listed in `subject.yaml` but with no file yet is shown as **"Coming soon"** (visible, not playable).

```
content/
  subjects.yaml                       ordered list of subject ids
  <subject>/
    subject.yaml                      metadata, units, lessons, checkpoints (the syllabus manifest)
    concepts.yaml                     concept ids, titles, prerequisite concepts
    misconceptions.yaml
    u<N>/l<M>.yaml                    one lesson: screens + practice pool
    mixed/<setId>.yaml                "choose the method" interleaved sets (§3.5)
    speed/<roundId>.yaml              speed rounds (§3.5)
  puzzles/
    <interactiveType>/<packId>.yaml   puzzle packs (§9.5)
```

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
    checkpoint: { items: 14 }          # unit checkpoint drawn from the unit's practice pools (§3.5)
    lessons:
      - id: phys2.u3.l2
        title: "Ohm's Law and Electrical Power"
        concepts: [ohms-law, series-resistance, electric-power, parallel-resistance]
        prerequisites: [phys2.u3.l1]
        tryFirst: false                # true for the 3–5 "big idea" lessons per subject (§2.8)
```

### 7.3 `concepts.yaml` and `misconceptions.yaml`

```yaml
# concepts.yaml — `requires` feeds implicit review credit (§3.3)
- { id: ohms-law, title: "Ohm's law", requires: [current-basics] }
- { id: series-resistance, title: "Series resistance", requires: [ohms-law] }
- { id: electric-power, title: "Electrical power", requires: [ohms-law] }
- { id: parallel-resistance, title: "Parallel resistance", requires: [ohms-law, series-resistance] }
```

```yaml
# misconceptions.yaml
- id: ohm-multiply
  short: "More resistance means less current, not more."
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

**Ids are namespaced by subject.** Authors write bare slugs (`ohms-law`) inside a subject's files; the loader stores them as `<subject>/<slug>` (`phys2/ohms-law`). A `requires` entry or tag pointing to another subject uses the full form (`calc1/derivative-rules`). Ratings, memory, mastery and misconception statistics are all keyed by the full form.

### 7.4 Lesson schema (TypeScript view; implement as Zod)

```ts
type Difficulty = 1 | 2 | 3 | 4 | 5;

interface Lesson {
  id: string;                          // must match the file path
  title: string;
  version: number;
  concepts: string[];                  // ids from concepts.yaml
  estimatedMinutes: number;
  params?: ParamSpec;                  // lesson-scoped: one draw per attempt, shared by all screens
  derived?: Record<string, string>;    // name → mathjs expression over params (and earlier derived)
  screens: Screen[];                   // 15–25 screens, following the anatomy in §2.2
  extras?: Step[];                     // remediation and bonus steps, inserted by the engine (§3.2)
  practice: PracticeItem[];            // the lesson's practice pool, ≥ 12 items (§7.7)
}

type ParamSpec =
  | { sets: Record<string, number>[] }       // PREFERRED: pick one whole set → guarantees clean numbers
  | { vars: Record<string, { values: number[] } | { min: number; max: number; step: number }> };

type Screen =
  | HookScreen | ExploreScreen | ConceptScreen | WorkedScreen
  | QuestionScreen | ChallengeScreen | RecapScreen;

interface HookScreen {
  id: string; type: 'hook';
  prompt: string;
  predict: Question;                   // usually `graded: false`: the learner commits before seeing anything
  reveal?: {                           // predict–observe–explain hooks
    instruction?: string;
    interactive: InteractiveRef;
    tasks?: Task[];
    caption: string;                   // names the surprise; promises the payoff
  };
  compare?: {                          // try-first hooks (productive failure, §2.8)
    attempts: { label: string; work: string; verdict: string }[];  // 2–3 sample student attempts
    canonical: string;
  };
}

interface ExploreScreen {
  id: string; type: 'explore';
  intro: string;                       // one or two sentences
  interactive: InteractiveRef;
  tasks: Task[];                       // 2–5 tasks (≥ 1 `goal`), gated one at a time
  takeaway: string;                    // one line, shown when all tasks are done
}

type Task =
  | { goal: string; check: { expr: string }; hint?: string; solution: unknown } // act on the interactive
  | { predict: Question }              // commit before the next goal; verdict shown after it
  | { ask: Question };                 // a question about what was just observed

interface InteractiveRef {
  type: string;                        // key in the interactive registry (§9.4)
  mode?: 'view' | 'explore';           // default 'explore'
  config: unknown;                     // validated by the interactive's own Zod schema
}

interface ConceptScreen {
  id: string; type: 'concept';
  body: string;                        // ≤ 80 words of Markdown + KaTeX; names what was just discovered
  visual?: InteractiveRef;             // optional, non-gated
}

interface WorkedScreen {
  id: string; type: 'worked';
  concept: string;                     // drives adaptive fading
  problem: string;
  steps: { text: string }[];           // revealed one at a time
  // In step text, [[…]] is always a blank (§9.2 `blanks` syntax). [[?…]] marks a *fadeable* span:
  // shown filled in at low ratings, turned into a blank as the rating rises (§8.1).
  fade: 'none' | 'adaptive';
  // Worked-screen blanks must be filled to continue (2 attempts each, then revealed); they are never scored.
}

interface QuestionScreen extends Step { type: 'question' }
interface ChallengeScreen extends Challenge { type: 'challenge' }

interface RecapScreen {
  id: string; type: 'recap';
  takeaways: string[];
  explain?: { prompt: string; expert: string; checklist: string[] };  // self-explanation (§2.8)
  next?: string;                       // next lesson id
}

interface Step {
  id: string;                          // "s1", "s2", … ; extras "r1"…, "b1"…
  role: 'core' | 'check' | 'remediation' | 'bonus';
  concept: string;
  uses?: string[];                     // earlier step ids
  clueFor?: string[];                  // later step or challenge ids
  remediates?: string;                 // required for role: remediation — the core step it supports
  establishes?: string;                // required for core steps; Markdown + templates
  standaloneContext?: string;          // required for core steps: restates the scenario for hard mode (§3.5)
  variants: {
    easier?: Question;                 // required for core
    standard: Question;                // always required
    harder?: Question;                 // required for core
  };                                   // check, remediation and bonus steps: `standard` only
}

interface Question {
  id: string;                          // unique within the lesson, e.g. "s1-e", "s1-s", "s1-h"
  version?: number;                    // default 1
  kind: QuestionKind;                  // one of the widgets in §9.2
  difficulty: Difficulty;
  prompt: string;                      // Markdown + KaTeX + {{templates}}
  graded?: boolean;                    // default true; false for predictions and `explain` (§2.5)
  fixedOrder?: boolean;                // keep authored order of options/cards/items (e.g. ordinal predictions)
  // …kind-specific fields from §9.2 (options, answer, wrongAnswers, items, buckets, targets, …)
  verify?: VerifyRule[];               // machine checks the validator runs (§13.2)
  hints?: { nudge: string; buildsOn?: string; partial: string };  // required when graded
  explanation?: string;                // required when graded; template in §15.4
}

type VerifyRule =
  | { expr: string }                   // boolean, over params + derived (+ the interactive's initial-state scope for `hotspot`/`interactive`)
  | { lhs: string; rhs: string; vars: Record<string, [number, number]> };  // must agree at 20 random points (symbolic answers)
```

### 7.5 Challenge schema

```ts
interface Challenge {
  id: string;
  title: string;
  concept: string;
  interactive?: string;                // interactive type (§9.4); omit for a widget-backed challenge
  uses?: string[];                     // steps it builds on (shown as "↩ builds on" chips)
  params?: ParamSpec;                  // challenge-local; if omitted, inherits the lesson's params
  derived?: Record<string, string>;
  variants: { easier: ChallengeVariant; standard: ChallengeVariant; harder: ChallengeVariant };
}

interface ChallengeVariant {
  difficulty: Difficulty;              // easier < standard < harder
  goal: string;                        // one measurable sentence; Markdown + templates
  // Interactive-backed: config + check + solution.  Widget-backed: `question` instead.
  question?: Question;                 // any generative or arranging widget (not mcq/multi), e.g. sketch, proof-blocks
  config: unknown;                     // validated by the interactive's own Zod schema
  check: { expr: string };             // mathjs boolean expression over the interactive's check scope
  feedback?: { if: string; say: string; misconception?: string }[]; // first match shown on a failed check
  hints: { nudge: string; buildsOn?: string; partial: string };
  solution: unknown;                   // interactive-specific format; validator proves it passes `check`
  par?: Record<string, number>;        // optional "par" for stars, e.g. { parts: 3 } or { moves: 6 }
  explanation: string;                 // shown after success or "Show solution"
}
```

- **Built-in helper for all expressions:** `near(a, b, rel = 0.01)` is true when `|a − b| ≤ max(rel × |b|, 1e-6)`.
- **Scope of a check expression:** the challenge's own params and derived values (or the lesson's, if the challenge has no `params`) plus the interactive's `checkScope`. Interactive variables win on a name clash, and the validator reports an error if a check, feedback or verify expression *uses* a clashing name.
- **Widget-backed challenges** (`question` set on every variant): the widget's own grading decides success; attempts are unlimited and scoring follows the table below. Use them for ideas like "sketch f′" or "order the proof" that need no interactive.
- **Challenge scoring:**

  | Outcome | Score |
  |---|---|
  | Solved without hints | 1.0 |
  | Solved after tier-1 hint | 0.8 |
  | Solved after tier-2 hint | 0.6 |
  | Solved after tier-3 hint | 0.3 |
  | Used "Show solution" | 0.0 |

- **Attempts:** unlimited. "Show solution" appears after 5 failed checks.

### 7.6 Templates, formatting and YAML

**Templates.**
- Any `{{ expression }}` in **any string field** (prompts, options, cards, items, hints, intros, takeaways, concept bodies, captions, `establishes`, `standaloneContext`, explanations, goals, feedback `say` lines, interactive config strings) is evaluated with mathjs over params + derived. The only exceptions are ids and fields that are themselves expressions (`expr`, `value`, `if`, `check`, `verify`, netlist values).
- **Scope:** a lesson screen uses the lesson's params + derived; a challenge with its own `params` uses only its own; a practice item, speed item or puzzle level uses only its own `params` + `derived`.
- Numeric config fields also accept a bare expression string, e.g. `voltage: "V"`.
- The result is formatted by `format.ts`:
  - 3 significant figures,
  - trailing zeros trimmed,
  - integers printed as integers,
  - |x| ≥ 1e5 or 0 < |x| < 1e-3 printed in scientific form (`2.5 × 10⁻⁴` in text, `2.5 \times 10^{-4}` inside `$…$`).

**Blanks.** `[[…]]` marks an inline blank inside `blanks` questions and `worked` steps (§9.2). It never collides with `{{…}}` templates.

**Option ordering.**
- Computed numeric MCQ options are displayed **sorted ascending**, so position gives no clue.
- Static options, categorize cards, match pairs and order items are shuffled per attempt (seeded) unless `fixedOrder: true`.

**YAML tip for authors.** Put LaTeX inside `|` block scalars or single-quoted strings. Never put it inside double-quoted strings, where backslashes are escape characters (`"\frac"` breaks). Inside double-quoted strings, use Unicode instead (Ω, ×, ÷, ≤, μ).

**Conventions.**
- SI units, 3 significant figures, `Ω` and `μ` as Unicode.
- Vectors in bold or with an arrow inside KaTeX; code in fenced blocks.
- DSA: Python is the primary language; JavaScript is also supported.

### 7.7 Practice items, mixed sets, speed rounds, puzzle packs

**Practice item** — one entry of a lesson's `practice` pool:

```ts
interface PracticeItem extends Question {
  concept: string;
  params?: ParamSpec;                  // each item draws its own numbers, fresh every time it is served
  derived?: Record<string, string>;
  method?: string;                     // optional tag for "choose the method" mixed sets
}
```

- A pool has **≥ 12 items**, covers **every concept** in the lesson, and uses **≥ 3 question kinds**.
- Items are standalone: no Facts panel, no chain context, no references to "the question above" or to "Qn" (validator warning).
- Items span difficulty bands 2–5: at least 3 items at band 4 or higher, including at least 1 at band 5 (hard mode draws on these).
- Every `params` spec must produce at least 2 visibly different versions of the item.

**Mixed set** (`content/<subject>/mixed/<setId>.yaml`):

```yaml
id: calc2.mixed.integration
title: "Which integration technique?"
lessons: [calc2.u2.l1, calc2.u2.l2, calc2.u2.l3, calc2.u2.l4]   # unlocked when ≥ 2 are completed
methods: ["Integration by parts", "Trigonometric integrals", "Trig substitution", "Partial fractions"]
items: 8                                # drawn from the listed lessons' pools, only items with a `method` tag
```

- Every pool item in the listed lessons that has a `method` tag must use one of `methods` (validator), and each method needs ≥ 2 tagged items.
- The method picker is an `mcq` over `methods` (shuffled). It is scored for XP and a per-set "method accuracy" stat, but does not change concept ratings.

**Speed round** (`content/<subject>/speed/<roundId>.yaml`):

```yaml
id: calc1.speed.derivative-rules
title: "Derivative rules sprint"
unlockAfter: calc1.u2.l5
durationSec: 90
concept: derivative-rules
items:                                  # short numeric/expression/mcq items; no hints or explanations
  - { id: power, kind: expression, prompt: '$\frac{d}{dx}\, x^{ {{n}} }$', answer: { expr: "n*x^(n-1)", vars: { x: [0.5, 3] } }, params: { vars: { n: { min: 2, max: 9, step: 1 } } } }
```

**Puzzle pack** (`content/puzzles/<interactiveType>/<packId>.yaml`):

```yaml
id: circuits.series-parallel
title: "Series & Parallel Puzzles"
interactive: circuit-builder
unlockAfter: phys2.u3.l2
levels:                                 # 10–20 levels; each level is a ChallengeVariant (§7.5) plus id, title, params
  - id: half-current                    # progress is keyed by packId#levelId, so levels can be reordered
    title: "Half the current"
    difficulty: 2
    goal: "Make exactly {{V/(2*R)}} A flow out of the battery."
    params: { sets: [ { V: 6, R: 4 } ] }
    config: { battery: { voltage: "V" }, palette: [ { kind: resistor, resistance: "R", count: 2 } ] }
    check: { expr: "near(I, V/(2*R))" }
    hints: { nudge: "…", partial: "…" }
    solution: { netlist: ["B1 n1 0", "R1 n1 n2", "R2 n2 0"] }
    par: { parts: 2 }
    explanation: "…"
```

**Schemas for these files** (implement as Zod):

```ts
interface MixedSet { id: string; title: string; lessons: string[]; methods: string[]; items: number }

interface SpeedRound {
  id: string; title: string; unlockAfter: string; durationSec: number; concept: string;
  items: SpeedItem[];                  // ≥ 3 templates
}
interface SpeedItem {                  // a reduced Question: no hints, no explanation, fixed difficulty 2
  id: string; kind: 'numeric' | 'expression' | 'mcq'; prompt: string;
  params?: ParamSpec; derived?: Record<string, string>;
  answer?: unknown; options?: unknown; distractors?: unknown;   // as for the kind (§9.2)
}

interface PuzzlePack {
  id: string; title: string; interactive: string; unlockAfter: string;
  levels: PuzzleLevel[];               // 10–20
}
interface PuzzleLevel extends ChallengeVariant {
  id: string; title: string;
  params?: ParamSpec; derived?: Record<string, string>;
}
```

### 7.8 Complete reference lesson (the quality bar)

File: `content/phys2/u3/l2.yaml`. Implement this exactly. It is the Phase 2–3 test lesson and the template for all other lessons.

It has 17 screens: 1 hook, 2 explores, 3 concept cards, 8 question steps (6 adaptive core steps + 2 checks), 2 challenges and a recap. 14 of the 17 screens ask the learner to act. Question kinds on the standard track: numeric, mcq, order, categorize, hotspot; the easier and harder tracks also use `blanks` (plus predictions and a self-explanation). Its practice pool has 13 items in 6 kinds, including one band-5 item for hard mode.

```yaml
id: phys2.u3.l2
title: "Ohm's Law and Electrical Power"
version: 2
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

screens:
  # ───────────────────────── h1 · hook (predict → observe) ─────────────────────────
  - id: h1
    type: hook
    prompt: |
      A battery lights one bulb. You connect a second, identical bulb **in series**,
      one after the other in the same loop. What happens to the first bulb?
    predict:
      id: h1-p
      kind: mcq
      difficulty: 2
      graded: false
      fixedOrder: true
      prompt: "Your prediction:"
      options:
        - { text: "It gets brighter" }
        - { text: "It stays just as bright" }
        - { text: "It gets dimmer", correct: true }
        - { text: "It goes out" }
    reveal:
      instruction: "Open the switch to put the second bulb into the loop, and watch the first bulb."
      interactive:
        type: circuit-builder
        mode: explore
        config:
          locked: true
          preset: ["B1 n1 0 V", "L1 n1 n2 R", "L2 n2 0 R", "S1 n2 0"]
          controls:
            - { element: S1, param: closed, initial: 1 }
      tasks:
        - goal: "Open the switch."
          check: { expr: "closed_S1 == 0" }
          solution: { S1: 0 }
      caption: |
        Both bulbs now glow, and each one is **dimmer** than the single bulb was.
        By the end of this lesson you'll be able to explain why, and by exactly how much.

  # ───────────────────────── e1 · explore (discover Ohm's law) ─────────────────────────
  - id: e1
    type: explore
    intro: "This circuit has a battery, an ammeter and one resistor. Drag the sliders and watch the ammeter."
    interactive:
      type: circuit-builder
      mode: explore
      config:
        locked: true
        preset: ["B1 n1 0 4", "A1 n1 n2", "R1 n2 0 4"]
        controls:
          - { element: B1, param: voltage, min: 2, max: 12, step: 1 }
          - { element: R1, param: resistance, min: 1, max: 12, step: 1 }
    tasks:
      - goal: "Make the ammeter read exactly 2 A."
        check: { expr: "near(I_A1, 2)" }
        hint: "Try raising the voltage, or lowering the resistance."
        solution: { B1: 6, R1: 3 }
      - goal: "Set the battery to 12 V, then adjust the resistance until the ammeter reads 2 A again."
        check: { expr: "V_B1 == 12 and near(I_A1, 2)" }
        hint: "You doubled the push. What resistance brings the current back down?"
        solution: { B1: 12, R1: 6 }
      - predict:
          id: e1-p
          kind: numeric
          difficulty: 2
          graded: false
          prompt: "Predict: if you keep 12 V and halve the resistance to 3 Ω, what will the ammeter read?"
          answer: { expr: "12 / 3", unit: "A" }
      - goal: "Now set the resistance to 3 Ω and check your prediction."
        check: { expr: "V_B1 == 12 and R_R1 == 3" }
        solution: { B1: 12, R1: 3 }
    takeaway: "More voltage, more current. More resistance, less current."

  # ───────────────────────── c1 · concept (name it) ─────────────────────────
  - id: c1
    type: concept
    body: |
      What you just found is **Ohm's law**:

      $$V = IR \qquad\text{so}\qquad I = \frac{V}{R}$$

      The battery's voltage $V$ (volts) pushes charge, the resistance $R$ (ohms, Ω) opposes it,
      and the current $I$ (amperes, A) is the result. With $V$ fixed, double $R$ and you halve $I$.

  # ───────────────────────── s1 ─────────────────────────
  - id: s1
    type: question
    role: core
    concept: ohms-law
    clueFor: [s2]
    establishes: "Single resistor: {{I}} A flows through {{R}} Ω at {{V}} V."
    standaloneContext: "A circuit: a {{V}} V battery connected across a single {{R}} Ω resistor."
    variants:
      easier:
        id: s1-e
        kind: mcq
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
          nudge: "In the sliders you just used, did a bigger resistor raise or lower the current?"
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
        kind: numeric
        difficulty: 2
        prompt: |
          A {{V}} V battery is connected across a single {{R}} Ω resistor with ideal wires.
          What current flows through the resistor?
        answer: { expr: "V / R", unit: "A" }
        wrongAnswers:
          - { expr: "V * R", misconception: ohm-multiply }
          - { expr: "R / V", misconception: ohm-inverted }
          - { expr: "V", misconception: current-equals-voltage }
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
        kind: mcq
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
    type: question
    role: core
    concept: ohms-law
    clueFor: [s3]
    establishes: "With the same battery, doubling $R$ halves $I$."
    standaloneContext: "A {{V}} V battery drives {{I}} A through a single {{R}} Ω resistor."
    variants:
      easier:
        id: s2-e
        kind: numeric
        difficulty: 1
        prompt: |
          In the circuit above, {{I}} A flowed through the {{R}} Ω resistor.
          The resistor is swapped for a {{2*R}} Ω one; the battery stays the same. What current flows now?
        answer: { expr: "V / (2*R)", unit: "A" }
        wrongAnswers:
          - { expr: "2*V / R", misconception: ohm-multiply }
          - { expr: "V / R", misconception: battery-constant-current }
          - { expr: "V / (4*R)", misconception: square-law }
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
        kind: mcq
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
        kind: numeric
        difficulty: 3
        prompt: |
          Two resistors are connected, one at a time, to the same {{V}} V battery. Resistor A is {{R}} Ω
          and draws **twice** the current that resistor B draws. What is B's resistance?
        answer: { expr: "2*R", unit: "Ω" }
        wrongAnswers:
          - { expr: "R / 2", misconception: ohm-multiply }
          - { expr: "R", misconception: battery-constant-current }
          - { expr: "4*R", misconception: square-law }
        hints:
          nudge: "Same battery for both. Which resistor lets more current through?"
          partial: "$I_A = V/R_A$ and $I_B = V/R_B$, with $I_A = 2I_B$."
        explanation: |
          **Answer:** {{2*R}} Ω

          **Why:** With the same $V$, $I \propto 1/R$. B draws half of A's current, so B has twice A's
          resistance: $R_B = 2 \times {{R}} = {{2*R}}$ Ω.

          **Common mistakes:**
          - {{R/2}} Ω — that resistor would draw *more* current than A, not less.
          - {{R}} Ω — the battery fixes the voltage, not the current.
          - {{4*R}} Ω — the relationship is inverse, not inverse-square.

          **Connects to:** next, two resistors in one loop — think about the total resistance.

  # ───────────────────────── s3 ─────────────────────────
  - id: s3
    type: question
    role: core
    concept: series-resistance
    uses: [s1, s2]
    clueFor: [s5]
    establishes: "Two {{R}} Ω in series: total {{2*R}} Ω, current {{V/(2*R)}} A."
    standaloneContext: "A {{V}} V battery drives a single {{R}} Ω resistor, giving {{I}} A."
    variants:
      easier:
        id: s3-e
        kind: numeric
        difficulty: 2
        prompt: "Two {{R}} Ω resistors are connected in series, one after the other. What is their total resistance?"
        answer: { expr: "2*R", unit: "Ω" }
        wrongAnswers:
          - { expr: "R / 2", misconception: series-parallel-confusion }
          - { expr: "R", misconception: series-no-change }
          - { expr: "R^2", misconception: multiply-resistances }
        hints:
          nudge: "Current must pass through *both* resistors, one after the other."
          partial: "The oppositions add: $R_{tot} = R_1 + R_2$."
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
        kind: numeric
        difficulty: 3
        prompt: |
          A second, identical {{R}} Ω resistor is added **in series** with the first, using the same
          battery. What current now flows from the battery?
        answer: { expr: "V / (2*R)", unit: "A" }
        wrongAnswers:
          - { expr: "V / R", misconception: series-no-change }
          - { expr: "2*V / R", misconception: series-parallel-confusion }
          - { expr: "V / (4*R)", misconception: double-halving }
        hints:
          nudge: "What is the total resistance now?"
          buildsOn: "From before: one {{R}} Ω resistor gave {{I}} A, and doubling $R$ halves $I$."
          partial: 'Series: $R_{tot} = 2 \times {{R}}$ Ω. Now apply $I = V/R_{tot}$.'
        explanation: |
          **Answer:** {{V/(2*R)}} A

          **Why:** The charge must pass through both resistors, so the total resistance is
          {{2*R}} Ω — double the original. By the result from Q2, doubling $R$ halves the current:
          {{I}} A → {{V/(2*R)}} A.

          **Common mistakes:**
          - {{V/R}} A — the extra resistor *does* reduce the current.
          - {{2*V/R}} A — that's what two resistors in *parallel* would give.
          - {{V/(4*R)}} A — the current halves once, not once per resistor.

          **Connects to:** Q5 compares the *power* of this circuit with the single resistor.
      harder:
        id: s3-h
        kind: numeric
        difficulty: 4
        prompt: |
          With the two {{R}} Ω resistors in series across the {{V}} V battery, what is the voltage
          across **each** resistor?
        answer: { expr: "V / 2", unit: "V" }
        wrongAnswers:
          - { expr: "V", misconception: each-gets-full-voltage }
          - { expr: "V / 4", misconception: double-halving }
          - { expr: "V / (2*R)", misconception: current-voltage-confusion }
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
          - {{V/(2*R)}} — that number is the current, in amperes.

          **Connects to:** Q5 uses this circuit's current to find its power.

  # ───────────────────────── c2 · concept (name it) ─────────────────────────
  - id: c2
    type: concept
    body: |
      You've just used the rule for **series** circuits. With only one path:
      - the **same current** flows through every component;
      - the resistances **add**: $R_{tot} = R_1 + R_2 + \dots$;
      - the battery's voltage is **shared** between the components.

  # ───────────────────────── ch1 · mid-lesson challenge ─────────────────────────
  - id: ch1
    type: challenge
    title: "Series by design"
    concept: series-resistance
    interactive: circuit-builder
    uses: [s3]
    params:
      sets:
        - { V: 6, R: 4 }
        - { V: 12, R: 8 }
    variants:
      easier:
        difficulty: 2
        goal: "Using the {{V}} V battery and any of the {{R}} Ω resistors, make exactly {{V/(2*R)}} A flow out of the battery."
        config:
          battery: { voltage: "V" }
          palette:
            - { kind: resistor, resistance: "R", count: 3 }
            - { kind: wire, count: unlimited }
          grid: { cols: 6, rows: 4 }
        check: { expr: "near(I, V / (2*R))" }
        feedback:
          - { if: "near(I, V/R)", say: "One resistor gives {{V/R}} A. You need more total resistance." }
          - { if: "I > V/R", say: "Side-by-side connections *lower* the total resistance. Keep everything in one loop.", misconception: series-parallel-confusion }
          - { if: "near(I, V/(3*R))", say: "Three in series is too much resistance." }
        hints:
          nudge: "What total resistance gives {{V/(2*R)}} A at {{V}} V?"
          buildsOn: "From Q3: in series, resistances add."
          partial: "You need $R_{tot} = {{2*R}}$ Ω."
        solution: { netlist: ["B1 n1 0", "R1 n1 n2", "R2 n2 0"] }
        par: { parts: 2 }
        explanation: |
          $R_{tot} = V/I = {{V}}/{{V/(2*R)}} = {{2*R}}$ Ω — two resistors in series.
      standard:
        difficulty: 3
        goal: "Build a circuit where the voltmeter, connected across one resistor, reads exactly {{V/2}} V."
        config:
          battery: { voltage: "V" }
          palette:
            - { kind: resistor, resistance: "R", count: 3 }
            - { kind: voltmeter, count: 1 }
            - { kind: wire, count: unlimited }
          grid: { cols: 6, rows: 4 }
        check: { expr: "near(V_M1, V / 2)" }
        feedback:
          - { if: "near(V_M1, V)", say: "The voltmeter is reading the full battery voltage. Put a second resistor in the same loop." }
          - { if: "near(V_M1, V/3)", say: "Three resistors in series share the voltage three ways. Use two." }
          - { if: "near(V_M1, 0)", say: "0 V: is the voltmeter across a resistor that current actually flows through?" }
        hints:
          nudge: "When is the battery voltage split exactly in half?"
          buildsOn: "Q3: two equal resistors in series each get half the voltage."
          partial: "Two {{R}} Ω resistors in series, voltmeter across one of them."
        solution: { netlist: ["B1 n1 0", "R1 n1 n2", "R2 n2 0", "M1 n2 0"] }
        par: { parts: 3 }
        explanation: |
          In series the battery's {{V}} V is shared. Two equal resistors share it equally,
          so the voltmeter across one reads {{V/2}} V.
      harder:
        difficulty: 4
        goal: "Make the ammeter read exactly {{V/(3*R)}} A **and** the voltmeter read exactly {{V/3}} V."
        config:
          battery: { voltage: "V" }
          palette:
            - { kind: resistor, resistance: "R", count: 3 }
            - { kind: ammeter, count: 1 }
            - { kind: voltmeter, count: 1 }
            - { kind: wire, count: unlimited }
          grid: { cols: 7, rows: 4 }
        check: { expr: "near(I, V / (3*R)) and near(I_A1, V / (3*R)) and near(V_M1, V / 3)" }
        feedback:
          - { if: "near(V_M1, 2*V/3)", say: "The voltmeter is across two resistors. Move it across one." }
          - { if: "near(V_M1, V)", say: "The voltmeter is across the whole battery." }
          - { if: "I_A1 > 1.01 * V/(3*R)", say: "Too much current: every resistor must be in the same single loop." }
        hints:
          nudge: "Which arrangement of all three resistors gives {{V/(3*R)}} A?"
          buildsOn: "Series resistances add (Q3); the voltage is shared equally between equal resistors."
          partial: "All three in series, ammeter anywhere in the loop, voltmeter across exactly one resistor."
        solution: { netlist: ["B1 n1 0", "A1 n1 n2", "R1 n2 n3", "R2 n3 n4", "R3 n4 0", "M1 n4 0"] }
        par: { parts: 5 }
        explanation: |
          Three {{R}} Ω resistors in series give {{3*R}} Ω, so $I = {{V}}/{{3*R}} = {{V/(3*R)}}$ A.
          Each resistor gets a third of the battery voltage: {{V/3}} V.

  # ───────────────────────── s4 ─────────────────────────
  - id: s4
    type: question
    role: core
    concept: electric-power
    uses: [s1]
    clueFor: [s5]
    establishes: "Single {{R}} Ω resistor at {{V}} V: P = {{P}} W."
    standaloneContext: "A {{V}} V battery is connected across a single {{R}} Ω resistor, so {{I}} A flows."
    variants:
      easier:
        id: s4-e
        kind: blanks
        difficulty: 2
        prompt: "The single resistor from the first question has {{V}} V across it and {{I}} A through it. Power is voltage × current. Complete the calculation."
        text: "P = {{V}} V × {{I}} A = [[V * I]] W"
        hints:
          nudge: "Multiply the two numbers you were given."
          partial: "$P = VI$"
        explanation: |
          **Answer:** {{P}} W

          **Why:** $P = VI = {{V}} \times {{I}} = {{P}}$ W.

          **Common mistakes:**
          - {{V/I}} — $V/I$ is the resistance (Ω), not power.
          - {{V+I}} — volts and amperes can't be added.

          **Connects to:** Q5 compares this power with the series circuit's.
      standard:
        id: s4-s
        kind: numeric
        difficulty: 3
        prompt: |
          Go back to the single {{R}} Ω resistor across the {{V}} V battery. At what rate (in watts)
          does the resistor turn electrical energy into heat?
        answer: { expr: "V^2 / R", unit: "W" }
        wrongAnswers:
          - { expr: "V / R", misconception: power-is-current }
          - { expr: "V * R", misconception: power-formula-mixup }
          - { expr: "V", misconception: power-equals-voltage }
        hints:
          nudge: "Power is voltage times current. Which of those do you know?"
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
        kind: mcq
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
          nudge: "Use a power formula where $V$ — which doesn't change — appears."
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
    type: question
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
        kind: numeric
        difficulty: 3
        prompt: |
          In the series circuit, the current is {{V/(2*R)}} A and the total resistance is {{2*R}} Ω.
          What total power does the battery deliver?
        answer: { expr: "V^2 / (2*R)", unit: "W" }
        wrongAnswers:
          - { expr: "V^2 / R", misconception: series-no-change }
          - { expr: "2 * V^2 / R", misconception: more-resistors-more-power }
          - { expr: "V^2 / (4*R)", misconception: forgot-total-R }
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

          **Connects to:** Q6 compares arrangements, including a parallel one.
      standard:
        id: s5-s
        kind: mcq
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

          **Connects to:** the hook — each bulb in series gets $I^2R$ with half the current: a quarter of the single bulb's power.
      harder:
        id: s5-h
        kind: numeric
        difficulty: 5
        prompt: |
          In the two-resistor series circuit, one resistor is bypassed with a plain wire (short-circuited).
          What total power does the battery now deliver?
        answer: { expr: "V^2 / R", unit: "W" }
        wrongAnswers:
          - { expr: "2 * V^2 / R", misconception: square-law }
          - { expr: "V^2 / (2*R)", misconception: power-fixed-by-battery }
          - { expr: "0", misconception: short-means-no-current }
        hints:
          nudge: "After the bypass, what does the circuit effectively look like?"
          buildsOn: "Series pair: {{P/2}} W. Single resistor: {{P}} W."
          partial: "Current takes the wire and skips that resistor, leaving just one {{R}} Ω resistor."
        explanation: |
          **Answer:** {{P}} W — double the series pair's {{P/2}} W.

          **Why:** The wire has (ideally) zero resistance, so the bypassed resistor carries no current.
          The circuit becomes the single-resistor circuit from Q4: $P = V^2/R = {{P}}$ W.

          **Common mistakes:**
          - {{2*P}} W — $R_{tot}$ halves, and with fixed $V$, $P = V^2/R$ only doubles; it doesn't quadruple.
          - {{P/2}} W — removing resistance changes the power.
          - 0 W — only the bypassed resistor goes dark; the rest of the circuit still works.

          **Connects to:** next you'll put resistors side by side instead.

  # ───────────────────────── e2 · explore (parallel) ─────────────────────────
  - id: e2
    type: explore
    intro: "Now a second {{R}} Ω resistor sits **beside** the first, on its own branch with a switch. The voltmeter watches the new branch."
    interactive:
      type: circuit-builder
      mode: explore
      config:
        locked: true
        preset: ["B1 n1 0 V", "A1 n1 n2", "R1 n2 0 R", "S1 n2 n3", "R2 n3 0 R", "M1 n3 0"]
        controls:
          - { element: S1, param: closed, initial: 0 }
    tasks:
      - predict:
          id: e2-p
          kind: mcq
          difficulty: 3
          graded: false
          fixedOrder: true
          prompt: "Before you close the switch: what will happen to the current leaving the battery?"
          options:
            - { text: "It goes up", correct: true }
            - { text: "It stays the same" }
            - { text: "It goes down" }
      - goal: "Close the switch."
        check: { expr: "closed_S1 == 1" }
        solution: { S1: 1 }
      - ask:
          id: e2-a
          kind: numeric
          difficulty: 3
          prompt: "Compare the ammeter before and after. By what factor did the battery current change?"
          answer: { expr: "(V/R + V/R) / (V/R)" }
          wrongAnswers:
            - { expr: "0.5", misconception: series-parallel-confusion }
            - { expr: "1", misconception: battery-constant-current }
          hints:
            nudge: "Read the ammeter, close the switch, read it again."
            partial: "Divide the new reading by the old one."
          explanation: |
            **Answer:** 2 — the battery current doubled.

            **Why:** The voltmeter shows the new branch has the full {{V}} V across it, so it draws its own
            {{V/R}} A, on top of the first branch's {{V/R}} A.

            **Common mistakes:**
            - 0.5 — side-by-side resistors don't share one path, so they don't halve the current.
            - 1 — the battery fixes the voltage, not the current.

            **Connects to:** the next card names this rule.
    takeaway: "Each parallel branch gets the full battery voltage and draws its own current. More branches, more current."

  # ───────────────────────── c3 · concept (name it) ─────────────────────────
  - id: c3
    type: concept
    body: |
      This is a **parallel** connection: side-by-side branches. Each branch gets the **full battery
      voltage** and draws its own current; the battery supplies the sum. So adding a branch *lowers*
      the total resistance:

      $$\frac{1}{R_{par}} = \frac{1}{R_1} + \frac{1}{R_2}$$

      Two equal resistors in parallel act like **half** of one.

  # ───────────────────────── s6 ─────────────────────────
  - id: s6
    type: question
    role: core
    concept: parallel-resistance
    uses: [s3, s5]
    establishes: "Parallel pair draws {{2*P}} W — 4× the series pair's {{P/2}} W."
    standaloneContext: |
      A {{V}} V battery and {{R}} Ω resistors. One resistor draws {{P}} W; two in series draw {{P/2}} W in total.
    variants:
      easier:
        id: s6-e
        kind: numeric
        difficulty: 3
        prompt: |
          Two {{R}} Ω resistors are connected in **parallel** across the {{V}} V battery, so each has the
          full {{V}} V across it. What total current leaves the battery?
        answer: { expr: "2*V / R", unit: "A" }
        wrongAnswers:
          - { expr: "V / (2*R)", misconception: series-parallel-confusion }
          - { expr: "V / R", misconception: parallel-one-branch }
          - { expr: "4*V / R", misconception: square-law }
        hints:
          nudge: "Find the current in one branch, then count the branches."
          partial: "Each branch: $I = {{V}}/{{R}} = {{I}}$ A. The battery supplies both."
        explanation: |
          **Answer:** {{2*V/R}} A

          **Why:** Each branch has the full {{V}} V, so each carries {{I}} A. The battery supplies both:
          {{I}} + {{I}} = {{2*V/R}} A. Equivalently, $R_{par} = {{R/2}}$ Ω and $I = V/R_{par}$.

          **Common mistakes:**
          - {{V/(2*R)}} A — that's the *series* current.
          - {{V/R}} A — that's one branch only.
          - {{4*V/R}} A — currents add per branch; they don't square.

          **Connects to:** more current at the same voltage means more power.
      standard:
        id: s6-s
        kind: order
        difficulty: 4
        prompt: |
          Same {{V}} V battery, four circuits built from {{R}} Ω resistors.
          Drag them into order of **total power drawn from the battery**, most first.
        items:
          - { id: par2, text: "Two resistors in parallel", value: "2 * V^2 / R" }
          - { id: one, text: "One resistor", value: "V^2 / R" }
          - { id: ser2, text: "Two resistors in series", value: "V^2 / (2*R)" }
          - { id: ser3, text: "Three resistors in series", value: "V^2 / (3*R)" }
        orderBy: value-desc
        wrongOrders:
          - { order: [ser3, ser2, one, par2], misconception: more-resistors-more-power }
          - { order: [one, par2, ser2, ser3], misconception: parallel-one-branch }
        hints:
          nudge: "Which circuit has the smallest total resistance?"
          buildsOn: "Series pair: {{P/2}} W. One resistor: {{P}} W."
          partial: "With the battery voltage fixed, $P = V^2/R_{tot}$: the smaller the total resistance, the more power. Parallel pair: $R_{tot} = {{R/2}}$ Ω."
        explanation: |
          **Answer:** parallel pair ({{2*P}} W) → one resistor ({{P}} W) → series pair ({{P/2}} W) → three in series ({{P/3}} W).

          **Why:** The battery voltage is the same in every circuit, so $P = V^2/R_{tot}$. Order the circuits by
          total resistance, smallest first: {{R/2}} Ω, {{R}} Ω, {{2*R}} Ω, {{3*R}} Ω.
          The parallel pair draws 4× the power of the series pair.

          **Common mistakes:**
          - Series circuits first — more resistors in one loop *reduce* the current and the power.
          - Single resistor above the parallel pair — side by side, each branch gets the full {{V}} V, so the pair draws double.

          **Connects to:** the final challenge — design a circuit for a target current.
      harder:
        id: s6-h
        kind: numeric
        difficulty: 5
        prompt: |
          An ideal {{V}} V battery powering the single {{R}} Ω resistor lasts 8 hours.
          How many hours does it last powering the two {{R}} Ω resistors connected in parallel?
        answer: { expr: "8 * P / (2*P)", unit: "h" }
        wrongAnswers:
          - { expr: "8 * P / (4*P)", misconception: wrong-baseline }
          - { expr: "8 * 2", misconception: resistance-means-more-work }
          - { expr: "8", misconception: power-fixed-by-battery }
        hints:
          nudge: "Battery life = stored energy ÷ power drawn."
          buildsOn: "Single resistor: {{P}} W. Each parallel branch also dissipates {{P}} W."
          partial: "Parallel total: {{2*P}} W — twice the single resistor's."
        explanation: |
          **Answer:** 4 hours.

          **Why:** The stored energy is fixed. The parallel pair draws {{2*P}} W, twice the single
          resistor's {{P}} W, so the battery lasts half as long: 8 h ÷ 2 = 4 h.

          **Common mistakes:**
          - 2 h — that uses the parallel-vs-*series* factor (4×), but the baseline here is the single resistor.
          - 16 h — more resistors in parallel *lower* the total resistance and drain the battery faster.
          - 8 h — the battery's energy is fixed; its power output is not.

          **Connects to:** the final challenge — design a circuit for a target current.

  # ───────────────────────── s7 · quick check ─────────────────────────
  - id: s7
    type: question
    role: check
    concept: parallel-resistance
    variants:
      standard:
        id: s7-s
        kind: categorize
        difficulty: 3
        prompt: "The battery stays the same. Sort each change by what it does to the current leaving the battery."
        buckets: ["Increases", "Decreases", "No change"]
        cards:
          - { text: "Add a resistor in series", bucket: "Decreases", misconception: more-resistors-more-power }
          - { text: "Add a resistor in parallel", bucket: "Increases", misconception: series-parallel-confusion }
          - { text: "Swap a resistor for one with higher resistance", bucket: "Decreases", misconception: ohm-multiply }
          - { text: "Move the ammeter to the other side of a resistor", bucket: "No change", misconception: current-used-up }
          - { text: "Bypass one series resistor with a wire", bucket: "Increases", misconception: short-means-no-current }
          - { text: "Swap the order of two series resistors", bucket: "No change", misconception: current-used-up }
        hints:
          nudge: "For each change: does the total resistance go up, down, or stay the same?"
          partial: "Battery current $= V / R_{tot}$. Series adds resistance, parallel lowers it, and rearranging parts of one loop changes nothing."
        explanation: |
          **Answer:** Increases — add a parallel resistor; bypass a series resistor.
          Decreases — add a series resistor; use a higher resistance.
          No change — move the ammeter; swap two series resistors.

          **Why:** The battery current is $V / R_{tot}$. Only changes to the total resistance matter,
          and the order of parts in a single loop doesn't change the total.

          **Common mistakes:**
          - "Adding any resistor reduces the current" — a parallel branch adds a new path, so the current goes up.
          - "The ammeter reads less after a resistor" — current isn't used up.

          **Connects to:** the next question asks which resistor in a mixed circuit gets the most power.

  # ───────────────────────── s8 · quick check (tap the diagram) ─────────────────────────
  - id: s8
    type: question
    role: check
    concept: parallel-resistance
    clueFor: [ch2]
    variants:
      standard:
        id: s8-s
        kind: hotspot
        difficulty: 4
        prompt: "All three resistors are identical ({{R}} Ω). **Tap the resistor that gets hottest**, the one that dissipates the most power."
        on:
          type: circuit-builder
          mode: view
          config:
            locked: true
            hideReadings: true
            preset: ["B1 n1 0 V", "R1 n1 n2 R", "R2 n2 0 R", "R3 n2 0 R"]
        targets: [R1, R2, R3]
        answer: [R1]
        verify:
          - { expr: "P_R1 > P_R2 and P_R1 > P_R3" }
        wrongTargets:
          R2: parallel-gets-more
          R3: parallel-gets-more
        hints:
          nudge: "Which resistor does *all* of the battery's current pass through?"
          partial: "The current splits between R2 and R3, so each carries half of R1's current. Power is $I^2R$."
        explanation: |
          **Answer:** R1.

          **Why:** All the current flows through R1, then splits equally between R2 and R3.
          With $P = I^2R$ and equal resistances, R1 carries twice the current of each branch, so it
          dissipates **4×** the power of R2 or R3. The parallel pair acts like {{R/2}} Ω, so
          $R_{tot} = {{1.5*R}}$ Ω and the battery current is {{V/(1.5*R)}} A.

          **Common mistakes:**
          - R2 or R3 — each branch gets only part of the current.

          **Connects to:** the final challenge uses exactly this kind of mixed circuit.

  # ───────────────────────── ch2 · final challenge ─────────────────────────
  - id: ch2
    type: challenge
    title: "Hit the target current"
    concept: parallel-resistance
    interactive: circuit-builder
    uses: [s6, s8]
    params:
      sets:
        - { V: 6, R: 4 }
        - { V: 12, R: 8 }
    variants:
      easier:
        difficulty: 3
        goal: "Using the {{V}} V battery and any of the {{R}} Ω resistors, make exactly {{2*V/R}} A flow out of the battery."
        config:
          battery: { voltage: "V" }
          palette:
            - { kind: resistor, resistance: "R", count: 3 }
            - { kind: wire, count: unlimited }
          grid: { cols: 6, rows: 4 }
        check: { expr: "near(I, 2*V / R)" }
        feedback:
          - { if: "near(I, V/R)", say: "One resistor gives {{V/R}} A. You need twice as much — give the current a second path." }
          - { if: "I < V/R", say: "Series connections reduce the current. Try side by side.", misconception: series-parallel-confusion }
          - { if: "near(I, 3*V/R)", say: "Three in parallel is one branch too many." }
        hints:
          nudge: "What total resistance gives {{2*V/R}} A at {{V}} V?"
          buildsOn: "Q6: two equal resistors in parallel act like half of one."
          partial: "You need $R_{tot} = {{R/2}}$ Ω: two resistors side by side."
        solution: { netlist: ["B1 n1 0", "R1 n1 0", "R2 n1 0"] }
        par: { parts: 2 }
        explanation: |
          $R_{tot} = V/I = {{R/2}}$ Ω — two {{R}} Ω resistors in parallel.
      standard:
        difficulty: 4
        goal: "Using up to three {{R}} Ω resistors, make exactly {{V/(1.5*R)}} A flow out of the {{V}} V battery."
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
          buildsOn: "Series adds resistance (Q3). Two equal resistors in parallel give half of one (Q6), as in the circuit you just tapped."
          partial: "You need $R_{tot} = {{1.5*R}}$ Ω = one resistor plus half of one."
        solution: { netlist: ["B1 n1 0", "R1 n1 n2", "R2 n2 0", "R3 n2 0"] }
        par: { parts: 3 }
        explanation: |
          You need $R_{tot} = V/I = {{1.5*R}}$ Ω $= R + R/2$. Put one resistor in series with a
          parallel pair: $R_{tot} = {{R}} + ({{R}} \parallel {{R}}) = {{R}} + {{R/2}} = {{1.5*R}}$ Ω.
      harder:
        difficulty: 5
        goal: "Use **all three** {{R}} Ω resistors to make exactly {{1.5*V/R}} A flow out of the {{V}} V battery."
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
        par: { parts: 3 }
        explanation: |
          $R_{tot} = V/I = {{2*R/3}}$ Ω. One resistor in parallel with a series pair gives
          $\dfrac{R \cdot 2R}{R + 2R} = \dfrac{2R}{3} = {{2*R/3}}$ Ω, so $I = {{1.5*V/R}}$ A.

  # ───────────────────────── recap ─────────────────────────
  - id: wrap
    type: recap
    takeaways:
      - "$I = V/R$: with the voltage fixed, current is inversely proportional to resistance."
      - "Series: one path, the same current everywhere, resistances add, the voltage is shared."
      - "Parallel: each branch gets the full voltage; adding a branch lowers the total resistance and raises the current."
      - "$P = VI = I^2R = V^2/R$. With a fixed battery, less total resistance means more power."
    explain:
      prompt: "In two or three sentences, explain why two bulbs in series are each dimmer than one bulb on the same battery. Use the words *resistance*, *current* and *power*."
      expert: |
        Adding the second bulb in series doubles the total resistance, so the battery current halves.
        Each bulb's power is $I^2R$, so with half the current each bulb gets a quarter of the single
        bulb's power — that's why both are dimmer.
      checklist:
        - "I said the total resistance increases (doubles)."
        - "I said the current decreases (halves)."
        - "I linked brightness to power, $I^2R$."
    next: phys2.u3.l3

# ───────────────────────── extras (inserted by the engine) ─────────────────────────
extras:
  - id: r1
    role: remediation
    remediates: s3
    concept: series-resistance
    variants:
      standard:
        id: r1-s
        kind: mcq
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

# ───────────────────────── practice pool (§7.7) ─────────────────────────
practice:
  - id: p1
    concept: ohms-law
    kind: numeric
    difficulty: 2
    params: { sets: [ { V: 9, R: 3 }, { V: 24, R: 8 }, { V: 5, R: 2 } ] }
    prompt: "A {{R}} Ω heating element is connected to a {{V}} V supply. What current does it draw?"
    answer: { expr: "V / R", unit: "A" }
    wrongAnswers:
      - { expr: "V * R", misconception: ohm-multiply }
      - { expr: "R / V", misconception: ohm-inverted }
    hints:
      nudge: "Which law links voltage, current and resistance?"
      partial: "$I = V/R$"
    explanation: |
      **Answer:** {{V/R}} A

      **Why:** $I = V/R = {{V}}/{{R}} = {{V/R}}$ A.

      **Common mistakes:**
      - {{V*R}} A — multiplied instead of dividing.
      - {{R/V}} A — flipped the fraction.

      **Connects to:** Ohm's law, $V = IR$.

  - id: p2
    concept: ohms-law
    kind: numeric
    difficulty: 2
    params: { sets: [ { I: 2, R: 5 }, { I: 0.5, R: 12 }, { I: 3, R: 4 } ] }
    prompt: "A current of {{I}} A flows through a {{R}} Ω resistor. What is the voltage across it?"
    answer: { expr: "I * R", unit: "V" }
    wrongAnswers:
      - { expr: "I / R", misconception: ohm-inverted }
      - { expr: "R / I", misconception: ohm-rearrange }
    hints:
      nudge: "Ohm's law already has $V$ on its own."
      partial: "$V = IR$"
    explanation: |
      **Answer:** {{I*R}} V

      **Why:** $V = IR = {{I}} \times {{R}} = {{I*R}}$ V.

      **Common mistakes:**
      - {{I/R}} V — divided instead of multiplying.
      - {{R/I}} V — rearranged $V = IR$ incorrectly.

      **Connects to:** Ohm's law, $V = IR$.

  - id: p3
    concept: ohms-law
    kind: numeric
    difficulty: 3
    params: { sets: [ { V: 12, I: 0.5 }, { V: 6, I: 2 }, { V: 9, I: 3 } ] }
    prompt: "A lamp draws {{I}} A from a {{V}} V supply. What is its resistance?"
    answer: { expr: "V / I", unit: "Ω" }
    wrongAnswers:
      - { expr: "V * I", misconception: computed-power-instead }
      - { expr: "I / V", misconception: ohm-inverted }
    hints:
      nudge: "Rearrange $V = IR$ for $R$."
      partial: "$R = V/I$"
    explanation: |
      **Answer:** {{V/I}} Ω

      **Why:** $R = V/I = {{V}}/{{I}} = {{V/I}}$ Ω.

      **Common mistakes:**
      - {{V*I}} — that's the power in watts, not the resistance.
      - {{I/V}} — the fraction is upside down.

      **Connects to:** Ohm's law, $V = IR$.

  - id: p4
    concept: series-resistance
    kind: mcq
    difficulty: 2
    params: { sets: [ { a: 2, b: 3, c: 5 }, { a: 4, b: 6, c: 2 }, { a: 1, b: 8, c: 6 } ] }
    prompt: "Resistors of {{a}} Ω, {{b}} Ω and {{c}} Ω are connected in series. What is the total resistance?"
    answer: { expr: "a + b + c", unit: "Ω" }
    distractors:
      - { expr: "1 / (1/a + 1/b + 1/c)", unit: "Ω", misconception: series-parallel-confusion }
      - { expr: "max(a, b, c)", unit: "Ω", misconception: largest-only }
      - { expr: "a * b * c", unit: "Ω", misconception: multiply-resistances }
    hints:
      nudge: "In series the current passes through every resistor in turn."
      partial: "Series resistances add."
    explanation: |
      **Answer:** {{a+b+c}} Ω

      **Why:** In series, the oppositions add: ${{a}} + {{b}} + {{c}} = {{a+b+c}}$ Ω.

      **Common mistakes:**
      - {{1/(1/a+1/b+1/c)}} Ω — that's the parallel formula.
      - {{max(a,b,c)}} Ω — every resistor adds to the total, not just the largest.
      - {{a*b*c}} Ω — resistances add; they don't multiply.

      **Connects to:** series circuits, $R_{tot} = R_1 + R_2 + \dots$

  - id: p5
    concept: parallel-resistance
    kind: numeric
    difficulty: 3
    params: { sets: [ { a: 6, b: 3 }, { a: 4, b: 12 }, { a: 10, b: 10 } ] }
    prompt: "A {{a}} Ω resistor and a {{b}} Ω resistor are connected in parallel. What is their equivalent resistance?"
    answer: { expr: "a*b / (a + b)", unit: "Ω" }
    wrongAnswers:
      - { expr: "a + b", misconception: series-parallel-confusion }
      - { expr: "(a + b) / 2", misconception: average-resistance }
    hints:
      nudge: "Should the answer be bigger or smaller than the smaller resistor?"
      partial: '$\frac{1}{R} = \frac{1}{ {{a}} } + \frac{1}{ {{b}} }$, or use product over sum.'
    explanation: |
      **Answer:** {{a*b/(a+b)}} Ω

      **Why:** $R_{par} = \dfrac{R_1 R_2}{R_1 + R_2} = \dfrac{ {{a}} \times {{b}} }{ {{a}} + {{b}} } = {{a*b/(a+b)}}$ Ω —
      smaller than either resistor, because a second path always helps the current.

      **Common mistakes:**
      - {{a+b}} Ω — that's the series total.
      - {{(a+b)/2}} Ω — parallel resistance is not the average.

      **Connects to:** parallel circuits, $\frac{1}{R_{par}} = \frac{1}{R_1} + \frac{1}{R_2}$.

  - id: p6
    concept: electric-power
    kind: numeric
    difficulty: 3
    params: { sets: [ { P: 60, V: 120 }, { P: 24, V: 12 }, { P: 9, V: 6 } ] }
    prompt: "A {{P}} W lamp runs on a {{V}} V supply. What current does it draw?"
    answer: { expr: "P / V", unit: "A" }
    wrongAnswers:
      - { expr: "V / P", misconception: power-rearrange }
      - { expr: "P * V", misconception: power-formula-mixup }
    hints:
      nudge: "Which power formula contains $P$, $V$ and $I$?"
      partial: "$P = VI$, so $I = P/V$."
    explanation: |
      **Answer:** {{P/V}} A

      **Why:** $P = VI$, so $I = P/V = {{P}}/{{V}} = {{P/V}}$ A.

      **Common mistakes:**
      - {{V/P}} A — rearranged $P = VI$ upside down.
      - {{P*V}} A — multiplied instead of dividing.

      **Connects to:** $P = VI$.

  - id: p7
    concept: electric-power
    kind: numeric
    difficulty: 3
    params: { sets: [ { I: 2, R: 5 }, { I: 3, R: 4 }, { I: 0.5, R: 20 } ] }
    prompt: "A current of {{I}} A flows through a {{R}} Ω resistor. What power does it dissipate?"
    answer: { expr: "I^2 * R", unit: "W" }
    wrongAnswers:
      - { expr: "I * R", misconception: power-equals-voltage }
      - { expr: "I * R^2", misconception: power-formula-mixup }
    hints:
      nudge: "You know $I$ and $R$. Which power formula uses exactly those?"
      partial: "$P = I^2 R$"
    explanation: |
      **Answer:** {{I^2*R}} W

      **Why:** $P = I^2R = {{I}}^2 \times {{R}} = {{I^2*R}}$ W.

      **Common mistakes:**
      - {{I*R}} — that's the voltage, $IR$, not the power.
      - {{I*R^2}} — the current is squared, not the resistance.

      **Connects to:** $P = VI = I^2R = V^2/R$.

  - id: p8
    concept: series-resistance
    kind: categorize
    difficulty: 2
    prompt: "Series or parallel? Sort each statement."
    buckets: ["Series", "Parallel"]
    cards:
      - { text: "The same current flows through every component", bucket: "Series", misconception: series-parallel-confusion }
      - { text: "Every component has the full battery voltage", bucket: "Parallel", misconception: series-parallel-confusion }
      - { text: "Total resistance is bigger than the largest resistor", bucket: "Series", misconception: series-parallel-confusion }
      - { text: "Total resistance is smaller than the smallest resistor", bucket: "Parallel", misconception: average-resistance }
      - { text: "Removing one component breaks the whole circuit", bucket: "Series", misconception: series-parallel-confusion }
      - { text: "Household sockets are connected this way", bucket: "Parallel", misconception: series-parallel-confusion }
    hints:
      nudge: "Series means one path; parallel means several side-by-side paths."
      partial: "One path → same current, resistances add. Several paths → same voltage, total resistance drops."
    explanation: |
      **Answer:** Series — same current; total bigger than the largest; one break stops everything.
      Parallel — full voltage each; total smaller than the smallest; household sockets.

      **Why:** A single path forces the same current through everything and adds the oppositions.
      Side-by-side paths each connect straight across the battery, so each gets the full voltage,
      and every extra path lowers the total resistance.

      **Common mistakes:**
      - Mixing up "same current" (series) and "same voltage" (parallel).

      **Connects to:** both concept cards in this lesson.

  - id: p9
    concept: parallel-resistance
    kind: order
    difficulty: 4
    params: { sets: [ { V: 12, R: 4 }, { V: 9, R: 3 }, { V: 24, R: 6 } ] }
    prompt: "A {{V}} V battery and identical {{R}} Ω resistors. Order these circuits by the current leaving the battery, **most first**."
    items:
      - { id: a, text: "One resistor", value: "V / R" }
      - { id: b, text: "Two resistors in series", value: "V / (2*R)" }
      - { id: c, text: "Two resistors in parallel", value: "2 * V / R" }
      - { id: d, text: "Three resistors in series", value: "V / (3*R)" }
      - { id: e, text: "One resistor in series with a parallel pair", value: "V / (1.5*R)" }
    orderBy: value-desc
    hints:
      nudge: "Order them by total resistance instead — smallest total resistance means most current."
      partial: "Totals: {{R}}, {{2*R}}, {{R/2}}, {{3*R}} and {{1.5*R}} Ω."
    explanation: |
      **Answer:** parallel pair ({{2*V/R}} A) → one resistor ({{V/R}} A) → series + parallel pair ({{V/(1.5*R)}} A)
      → series pair ({{V/(2*R)}} A) → three in series ({{V/(3*R)}} A).

      **Why:** With a fixed battery, $I = V/R_{tot}$, so the order of currents is the reverse order of total resistance:
      {{R/2}} < {{R}} < {{1.5*R}} < {{2*R}} < {{3*R}} Ω.

      **Common mistakes:**
      - Ranking by the number of resistors — what matters is how they're connected.

      **Connects to:** designing a circuit for a target current.

  - id: p10
    concept: series-resistance
    kind: numeric
    difficulty: 4
    params: { sets: [ { V: 12, a: 2, b: 4 }, { V: 9, a: 6, b: 3 }, { V: 10, a: 1, b: 4 } ] }
    prompt: "A {{a}} Ω and a {{b}} Ω resistor are in series across a {{V}} V battery. What is the voltage across the {{a}} Ω resistor?"
    answer: { expr: "V * a / (a + b)", unit: "V" }
    wrongAnswers:
      - { expr: "V * b / (a + b)", misconception: divider-swapped }
      - { expr: "V", misconception: each-gets-full-voltage }
      - { expr: "V / 2", misconception: equal-split }
    hints:
      nudge: "Find the current first; it's the same through both."
      partial: '$I = {{V}}/({{a}}+{{b}})$ A, then $V_a = I \times {{a}}$.'
    explanation: |
      **Answer:** {{V*a/(a+b)}} V

      **Why:** $I = V/R_{tot} = {{V}}/{{a+b}}$ A, the same through both. So
      $V_a = I \times {{a}} = {{V*a/(a+b)}}$ V. The bigger resistor gets the bigger share of the voltage.

      **Common mistakes:**
      - {{V*b/(a+b)}} V — that's the voltage across the *other* resistor.
      - {{V}} V — in series the voltage is shared, not repeated.
      - {{V/2}} V — it splits equally only when the resistors are equal.

      **Connects to:** series circuits share the battery voltage in proportion to resistance.

  - id: p11
    concept: parallel-resistance
    kind: multi
    difficulty: 3
    prompt: "Two identical bulbs are connected in parallel to an ideal battery. Select **all** the true statements."
    options:
      - { text: "Each bulb has the full battery voltage across it", correct: true }
      - { text: "The battery current is twice the current of one bulb alone", correct: true }
      - { text: "Together they have half the resistance of one bulb", correct: true }
      - { text: "Each bulb is dimmer than a single bulb on the same battery", misconception: parallel-dimmer }
      - { text: "If one bulb breaks, the other goes out", misconception: series-parallel-confusion }
    hints:
      nudge: "Each bulb is connected straight across the battery."
      partial: "Same voltage as a single bulb → same current and brightness per bulb; the battery supplies both."
    explanation: |
      **Answer:** the first three statements.

      **Why:** Each bulb connects straight across the battery, so it behaves exactly like a single bulb:
      same voltage, same current, same brightness. The battery supplies both currents, so its current
      doubles and the pair acts like half the resistance.

      **Common mistakes:**
      - "Each is dimmer" — that's true in *series*, not parallel.
      - "One breaks, both go out" — each parallel branch is its own path.

      **Connects to:** parallel circuits — each branch behaves as if it were alone on the battery.

  - id: p12
    concept: electric-power
    kind: expression
    difficulty: 4
    prompt: "Two resistors, each of resistance $R$, are connected in parallel across a battery of voltage $V$. Write the total power drawn from the battery in terms of $V$ and $R$."
    answer: { expr: "2 * V^2 / R", vars: { V: [1, 24], R: [1, 20] } }
    wrongAnswers:
      - { expr: "V^2 / (2*R)", misconception: series-parallel-confusion }
      - { expr: "V^2 / R", misconception: parallel-one-branch }
    allowedSymbols: [V, R]
    hints:
      nudge: "What is the voltage across each resistor?"
      partial: "Each branch dissipates $V^2/R$. Add the branches."
    explanation: |
      **Answer:** $P = \dfrac{2V^2}{R}$

      **Why:** Each resistor has the full $V$ across it and dissipates $V^2/R$. Two branches give $2V^2/R$.
      Equivalently, $R_{par} = R/2$ and $P = V^2/R_{par}$.

      **Common mistakes:**
      - $V^2/(2R)$ — that's the series pair.
      - $V^2/R$ — that's one branch only.

      **Connects to:** $P = V^2/R$ applied to each branch of a parallel circuit.

  - id: p13
    concept: parallel-resistance
    kind: numeric
    difficulty: 5
    prompt: |
      Three identical resistors are connected to a battery: one in series with a parallel pair made of
      the other two. What **fraction** of the total power is dissipated in **one** of the two parallel resistors?
    answer: { expr: "1/6", tolerance: 0.03 }
    wrongAnswers:
      - { expr: "1/3", misconception: equal-split }
      - { expr: "1/4", misconception: wrong-baseline }
      - { expr: "1/2", misconception: parallel-gets-more }
    hints:
      nudge: "Call the battery current $I$. How much current flows through each parallel resistor?"
      partial: "Series resistor: $I^2R$. Each parallel resistor: $(I/2)^2R = I^2R/4$. Now find the total."
    explanation: |
      **Answer:** $\tfrac{1}{6}$ (about 0.167)

      **Why:** Let the battery current be $I$. The series resistor carries $I$ and dissipates $I^2R$.
      Each parallel resistor carries $I/2$ and dissipates $I^2R/4$. The total is
      $I^2R\,(1 + \tfrac14 + \tfrac14) = \tfrac32 I^2R$, so one parallel resistor's share is
      $\tfrac{1/4}{3/2} = \tfrac16$.

      **Common mistakes:**
      - 1/3 — the three resistors don't share the power equally; the series one carries all the current.
      - 1/4 — that compares with the series resistor, not with the total.
      - 1/2 — the parallel branches get *less* power than the series resistor, not more.

      **Connects to:** series–parallel combinations and $P = I^2R$.
```

**Misconception ids used above.** Define all of them in `content/phys2/misconceptions.yaml`:
ohm-multiply, ohm-inverted, ohm-rearrange, current-equals-voltage, current-used-up, battery-constant-current, square-law, series-no-change, series-parallel-confusion, multiply-resistances, largest-only, average-resistance, double-halving, each-gets-full-voltage, equal-split, divider-swapped, current-voltage-confusion, computed-power-instead, power-is-current, power-formula-mixup, power-equals-voltage, power-rearrange, power-proportional-R, power-fixed-by-battery, more-resistors-more-power, forgot-total-R, short-means-no-current, parallel-one-branch, parallel-gets-more, parallel-dimmer, resistance-means-more-work, wrong-baseline, current-takes-easiest-path.

---

## 8. Lesson player & practice player behaviour

### 8.1 Lesson player

**Layout of a screen**
- One screen at a time, with a slim progress bar showing all screens (dots coloured by result).
- A back arrow and a collapsible "Earlier in this lesson" history let the learner re-read any previous screen.
- The **Facts panel** sits beside the main column (desktop) or in a bottom drawer (mobile).
- The **Explanations** tab sits beside the main **Lesson** tab.

**Start of an attempt**
- Draw lesson params once from a **seeded RNG** (mulberry32):
  - `sets`: choose an index;
  - `vars`: sample each variable;
  - then evaluate `derived` in order.
- Challenges with their own `params` draw separately from the same seed.
- Store the seed, so the numbers survive a refresh.

**Per screen type**

| Type | Behaviour |
|---|---|
| `hook` | Show the prompt and the prediction widget. After the learner commits, show the reveal interactive with its tasks (or the try-first comparison). Show the caption once the tasks are done. No score. |
| `explore` | Show the interactive and the first task. Each task unlocks the next when its check passes (or, for `predict`/`ask` tasks, when answered). A task's `hint` appears after 30 seconds without progress or on request. Show the takeaway at the end and add it to the Facts panel. No score. |
| `concept` | Render the card. **Continue** is enabled immediately. |
| `worked` | Reveal steps one at a time with "Next step". `[[…]]` blanks must be filled (2 attempts each, then revealed) before the next step appears; they are never scored. With `fade: adaptive`, the fadeable spans `[[?…]]` become blanks one at a time, starting from the last step, for every 100 rating points above 1000 in the screen's `concept`. |
| `question` | Choose a variant (core steps, §3.2), render the widget, handle attempts, hints and scoring (§2.5–2.6), update ratings (§3.1) and memory (§3.3), push `establishes`, insert remediation or bonus steps when triggered. |
| `challenge` | `InteractiveHost` renders: goal, the interactive, a **Check** button, hint ladder, attempt count, feedback line. On success: explanation panel, score, stars against `par`. After 5 failed checks: "Show solution". |
| `recap` | Takeaways; the self-explanation box (free text, never graded) with "Compare with an expert answer" and the checklist; lesson summary (score per step, stars, rating changes per concept, misconceptions met); buttons **Practise this lesson** and **Next lesson**. |

**Explanations tab**
- Lists every answered question with: prompt, the learner's answer, the correct answer, and the full explanation.
- Unanswered questions show "Answer this question to unlock its explanation."

**Resume**
- Leaving mid-lesson and coming back resumes at the same screen with the same numbers, variants and interactive state.

### 8.2 Practice player

Used by every practice mode in §3.5.

- One item per screen, built by `buildSession` (§3.6), with a progress bar and a running score.
- Items show their `standaloneContext` (core-step variants) or nothing extra (practice-pool items).
- Hints: lesson practice sets allow tier 1 and tier 3; daily practice and mistakes review allow all tiers; checkpoints and hard mode allow none.
- **Choose the method** items show a method-picker question first (`methods` from the mixed set, graded), then the problem.
- **Speed rounds** show a countdown, one short item at a time, and immediate right/wrong flashes. No explanations during the round; a review list at the end.
- End screen as described in §3.6.

---

## 9. Interaction framework: question widgets, interactives, puzzle packs

There are two families of interaction, built so content can combine them freely:

- **Question widgets** (`src/widgets/`): ways to *answer* — choose, type, arrange, place, draw. Used in question screens, practice items, explore tasks and predictions.
- **Interactives** (`src/interactives/`): manipulable *models* — circuits, graphs, simulations, data structures. Used in hooks, explore screens, challenges, puzzle packs, the sandbox, as tap targets for `hotspot` questions, and as answer surfaces via the `interactive` widget.

**Model/view split.** Every widget and interactive lives in a folder with a `model.ts` (schemas, grading, solver, scopes — plain TypeScript, no React, no DOM) and a `view.tsx` (the React component). The Node validator imports only `model.ts` files, so it never loads React, three.js or Pyodide.

### 9.1 Widget contract

```ts
// src/widgets/<kind>/model.ts
interface WidgetModel<Q, Answer> {
  kind: string;
  schema: ZodType<Q>;                                // the kind-specific fields of a Question
  grade(q: Q, answer: Answer, scope: Scope): {
    correct: boolean;
    parts?: boolean[];                               // per-part correctness for feedback
    misconception?: string;                          // matched misconception id, if any
    interpretation?: React.ReactNode;                // interpretive feedback (§2.5)
  };
  validate(q: Q, scope: Scope): string[];            // validator hook: errors for this param set (§13.2)
  describe(q: Q, answer: Answer): string;            // plain-text summary for screen readers
}

// src/widgets/<kind>/view.tsx
type WidgetView<Q, Answer> = React.FC<{
  question: Q;                                       // templates already resolved
  scope: Scope;                                      // params + derived, for live previews
  disabled: boolean;
  reveal?: { correct: Answer; learner: Answer };     // after the final attempt: show both
  onChange(answer: Answer | null): void;             // null = incomplete
}>;
```

### 9.2 Question widget catalog

| Kind | The learner… | Kind-specific fields | Grading and misconception hooks |
|---|---|---|---|
| `mcq` | picks one option | `options` (static, 3–5, one `correct`, others tagged) **or** `answer` + 3 `distractors` (computed, with `unit`). Predictions (`graded: false`) may mark at most one option `correct` and need no tags. | Tagged option → misconception. Computed options are shown sorted. |
| `multi` | selects all that apply | `options` with ≥ 1 `correct` and ≥ 1 wrong | All-or-nothing; shows wrong picks and missed ones. Wrong options tagged. |
| `odd-one-out` | picks the item that doesn't belong, then why | `items` (4, text or KaTeX or mini plot), `odd`, `why` (an `mcq`) | Both parts must be right. |
| `hotspot` | taps an element of a diagram or interactive | `on` (interactive in `view` mode), `targets`, `answer` (ids), `ordered` (bool), `wrongTargets` (id → misconception), `verify` | Ordered mode is for visit orders (BFS, heap). `verify` rules are evaluated on the interactive's initial state, so the validator proves the answer from the model. |
| `numeric` | types a number (decimals, or fractions such as `1/6`) | `answer {expr, unit?, tolerance? (relative, default 0.01), abs?}`, `wrongAnswers [{expr, misconception}]`, `sigFigs?` | A typed value within tolerance of a `wrongAnswers` value triggers that misconception. Right value with wrong sig figs is accepted with a note. Unit is shown, not typed. |
| `expression` | types a formula (live KaTeX preview, symbol keypad on mobile) | `answer {expr, vars: {name: [min, max]}}`, `allowedSymbols`, `wrongAnswers`, `forbid?` (functions not allowed) | Equivalent if equal at 20 random points in `vars` (skip points where either side is undefined). Wrong answers matched the same way. The learner's expression is plotted against the answer. |
| `blanks` | fills blanks inside a sentence or derivation | `text` with `[[expr]]` (numeric), `[[expr ± tol]]`, `[[= expr]]` (expression), `[[a\|b\|c]]` (choice, first is correct) | Each blank graded; all must be right. |
| `table` | fills cells of a table | `columns`, `rows` (cells are given text or blanks with `expr`) | Truth tables, DP tables, value tables. Per-cell marking. |
| `matrix` | enters a matrix or vector | `rows`, `cols`, `answer` (matrix of exprs), `tolerance` | Per-entry marking. |
| `estimate` | drags a slider or types a guess | `answer {expr}`, `range`, `bands` (e.g. within 10% → 1.0, 25% → 0.6, else 0.3) | Never "wrong"; shows how close. Good for hooks and estimation. |
| `order` | drags items into order | `items` (`id`, `text`, optional `value` expr), `orderBy: value-desc \| value-asc` **or** `correctOrder`, `wrongOrders [{order, misconception}]` | With `value`, the validator computes the correct order. Feedback marks items in the right position. |
| `categorize` | sorts cards into buckets | `buckets`, `cards [{text, bucket, misconception?}]` | Misplaced cards are marked; a card's tag fires when it's misplaced. |
| `match` | links pairs | `pairs [{left, right}]`, `extraRights?` (decoys); sides may be text, KaTeX or `plot: expr` | Per-pair marking. |
| `tokens` | builds an expression or equation from tiles (with decoys) | `tiles`, `answer` (expr or equation), `vars` | Graded by equivalence, so any correct arrangement is accepted. |
| `parsons` | orders code lines (with indentation) | `lines [{id, text, indent}]`, `distractors`, `language` | Exact order and indentation; feedback highlights the first wrong line. |
| `proof-blocks` | orders proof steps | `lines [{id, text}]`, `depends {id: [ids]}`, `distractors` | Any order consistent with the dependency graph is correct. Feedback names the first step whose prerequisite is missing. |
| `graph-point` | places points, lines, vectors or a parabola on axes | `axes`, `shapes` (what to place), `check {expr}` over placed coordinates, `solution` | E.g. "place the line with slope = f′(2) through (2, f(2))". |
| `sketch` | draws a curve | `axes`, `domain`, `features [{type: zero \| sign \| increasing \| decreasing \| max \| min \| asymptote, …}]`, `tolerance`, `target?` expr | Checked by features within tolerance; afterwards the true curve is overlaid on the sketch. |
| `find-the-error` | taps the first wrong line of a worked solution, then fixes it | `lines`, `errorLine`, `fix` (a `numeric`, `expression` or `mcq`) | Both parts graded. |
| `explain` | writes a short explanation | `prompt`, `expert`, `checklist` | Never graded; compares with the expert answer and a self-check list. |
| `code` | writes a function | see `code-runner` (§9.4) | Tests pass. |
| `interactive` | answers by setting an interactive's state | `on` (interactive ref), `check {expr}`, `solution` | E.g. "set the launch angle that gives the longest range". |

**Core set for Phase 2:** `mcq`, `multi`, `numeric`, `expression`, `blanks`, `order`, `categorize`, `match`, `estimate`, `explain`, `hotspot`, `find-the-error`, `odd-one-out`. **Phase 3:** `interactive`. The rest arrive with the subjects that need them (§14).

### 9.3 Interactive contract

```ts
// src/interactives/<type>/model.ts
interface InteractiveModel<Config, State, Solution> {
  type: string;
  configSchema: ZodType<Config>;
  solutionSchema: ZodType<Solution>;
  modes: ('view' | 'explore' | 'challenge' | 'sandbox')[];
  initialState(config: Config): State;
  checkScope(state: State, config: Config): Record<string, number | boolean>; // variables for check/feedback/verify exprs
  builtInFeedback?(state: State, config: Config): string | null;             // e.g. "Short circuit!"
  applySolution(state: State, solution: Solution, config: Config): State;    // used by explore tasks and "Show solution"
  solutionScope(solution: Solution, config: Config): Record<string, number | boolean>; // validator
  describeState(state: State): string;  // plain-text summary for screen readers (§11)
  encode?(scene: unknown): string;      // custom challenges (§9.6)
}

// src/interactives/<type>/view.tsx
type InteractiveView<Config, State, Solution> = React.FC<{
  mode: 'view' | 'explore' | 'challenge' | 'sandbox';
  config: Config;                       // templates and expressions already resolved
  state: State;
  disabled: boolean;
  targets?: string[];                   // hotspot mode: tappable element ids
  onTap?(id: string): void;
  onStateChange(state: State): void;
  showSolution?: Solution;              // render the solution read-only
}>;
```

**Evaluation**
- `check.expr`, `feedback[].if` and `verify` are evaluated with mathjs over params + derived + `checkScope(...)` + the `near` helper. Interactive variables win on a name clash; the validator errors if an expression uses a clashing name (§7.5).
- `builtInFeedback` runs first. If it returns a message (for example "Short circuit!"), the check fails with that message and no authored `feedback` rule is evaluated.
- **Validator, explore tasks:** start from `initialState(config)`; for each goal in order, check that it is **false** on the current state, then set `state = applySolution(state, solution)` and check that it is **true** on `checkScope(state)`.
- **Validator, challenges and puzzle levels:** evaluate `check.expr` on `solutionScope(solution)`, for every parameter set, and check that no `feedback` rule fires on it.

**Explore mode** shows only the controls listed in `config.controls` (productive constraints, §2.8), with the ranges and defaults given.

### 9.4 Interactive catalog

Each entry: what the learner does · check-scope variables · solution format · where it's used. "Packs" names its puzzle packs (§9.5).

#### Physics

1. **`circuit-builder`**
   - **Does:** builds or adjusts a DC circuit on a snap grid. Elements: battery, resistor, bulb (brightness ∝ power), capacitor, wire, switch, ammeter, voltmeter. Locked presets with sliders for explore screens; free building for challenges.
   - **Solver:** Modified Nodal Analysis (DC steady state). Wires, closed switches and ideal ammeters are zero-volt sources; ideal voltmeters and capacitors are open. A tiny conductance to ground on every node keeps floating parts solvable.
   - **Display:** live meter readings; current-flow animation (off with reduced motion); bulbs glow by power.
   - **Config:**

     ```ts
     interface CircuitConfig {
       locked?: boolean;                // true: the preset layout is fixed; only `controls` can change
       preset?: string[];               // netlist shown at start (view/explore modes, hotspot questions)
       controls?: {                     // explore mode: the only things the learner can change
         element: string;               // label in the preset, e.g. "R1"
         param: 'voltage' | 'resistance' | 'closed';
         min?: number; max?: number; step?: number;   // sliders; `closed` is a toggle
         initial?: number | string;     // overrides the preset value; may be an expression
       }[];
       hideReadings?: boolean;          // hide meter and element readings (e.g. "tap the hottest resistor")
       batteries?: { voltage: number | string; internalResistance?: number | string }[]; // build mode; labelled B1, B2, …
       battery?: { voltage: number | string; internalResistance?: number | string };    // shorthand for one battery
       palette?: {                      // build mode: parts the learner may place
         kind: 'resistor' | 'bulb' | 'capacitor' | 'switch' | 'ammeter' | 'voltmeter';
         resistance?: number | string; capacitance?: number | string;
         count: number;
       }[];                             // wires are always available and never listed
       meters?: { ammeterResistance?: number | string; voltmeterResistance?: number | string }; // non-ideal meters (loading effects)
       grid?: { cols: number; rows: number };
     }
     ```

   - **Netlist format** (presets and solutions): `"<label> <node+> <node−> [valueExpr]"`. Label prefixes: B battery, R resistor, L bulb, C capacitor, S switch, A ammeter, M voltmeter. Node `0` is the negative terminal of B1. In build mode, values come from the palette and batteries in order.
   - **Layout of presets and solutions:** automatic and only needs to be readable: B1 on the left edge, nodes placed in columns by their distance from B1's positive terminal, parts between them, wires routed orthogonally. "Show solution" uses the same layout.
   - **Scope:**
     - `I` (current out of B1's positive terminal), `Req` (B1 voltage ÷ `I`), `Ptot`, `n` (resistors + bulbs), `isShort`, `isOpen`;
     - per element `I_<label>`, `V_<label>`, `P_<label>`, `R_<label>`, `closed_<label>` (1 or 0); per battery `I_B<n>`;
     - readings are **magnitudes**; signed values are available as `Is_<label>` and `Vs_<label>` (positive from the + node to the − node).
   - **Built-in feedback:** "Short circuit!" when a source is shorted; "No complete loop" when no current can flow (`isOpen`). Either stops the check before authored feedback.
   - **Solution:** a netlist (challenges, puzzle levels) or control values keyed by element label (explore tasks; the parameter is implied: B → voltage, R/L → resistance, S → closed).
   - **Used in:** phys2 U3, U5. **Packs:** Series & Parallel, Meters, Brightest Bulb, Kirchhoff Knots.

2. **`transient-plotter`**
   - **Does:** RC or RL charging/discharging curves plotted live; sliders for R, C (or L) and V; a draggable time cursor.
   - **Scope:** `R`, `C`, `L`, `tau`, `V_at_t`, `I_at_t`, slider values.
   - **Solution:** slider values. **Used in:** phys2 U3, U5. **Packs:** Time-Constant Targets.

3. **`charge-field`**
   - **Does:** places and drags point charges; shows field vectors, optional field lines and equipotentials, and readings at probe points.
   - **Game mode — Field Hockey:** place fixed charges so a released charged puck reaches the goal around obstacles.
   - **Scope:** `Ex`, `Ey`, `E`, `Vp` at named probes, `F` on a test charge, `nCharges`, `goalReached`.
   - **Solution:** list of `{q, x, y}`. **Used in:** phys2 U1–U2. **Packs:** Zero-Field Points, Field Hockey.

4. **`particle-in-field`**
   - **Does:** sets charge, velocity, uniform B (into/out of page) and optional uniform E; the path is traced. **Wire mode:** a current-carrying wire segment in the field with a current slider and a force arrow.
   - **Scope:** `radius`, `hitTarget`, `straight`, `period`, `F_wire`.
   - **Solution:** parameter values. **Used in:** phys2 U4. **Packs:** Cyclotron Shots, Velocity Selector.

5. **`projectile-launcher`**
   - **Does:** sets angle, speed and height; launches; optional obstacles, moving targets and ghost trails of earlier shots for comparison.
   - **Scope:** `angle`, `v`, `h`, `range`, `maxHeight`, `flightTime`, `hit`.
   - **Solution:** parameter values. **Used in:** phys1 U1. **Packs:** Target Practice, Over the Wall.

6. **`motion-graph`**
   - **Does:** drags a walker along a track while x–t, v–t and a–t graphs record; or drags control points to draw a graph matching a description.
   - **Scope:** `maxError`, `meanError`.
   - **Solution:** control points. **Used in:** phys1 U1. **Packs:** Match the Graph.

7. **`vector-adder`** *(new)*
   - **Does:** drags vectors tip to tail; component readouts; goals like "reach the target" or "add the vector that balances the others".
   - **Scope:** `Rx`, `Ry`, `R`, `angle`, `hitTarget`, `balanced`.
   - **Solution:** vector list. **Used in:** phys1 U1–U2, linalg U1. **Packs:** Vector Navigation.

8. **`force-diagram`**
   - **Does:** drags force arrows (gravity, normal, friction, tension, applied, spring) onto a body, with direction snapping to 16 angles and optional magnitudes; "Run" shows the resulting motion.
   - **Scope:** `correctSet`, `directionsOk`, `netFx`, `netFy`.
   - **Solution:** list of `{force, angle, magnitude?}`. **Used in:** phys1 U2. **Packs:** FBD Gym.

9. **`energy-track`** *(new)*
   - **Does:** shapes a track by dragging control points (or picks presets), releases a cart, and watches KE, PE and thermal-energy bars; friction slider.
   - **Scope:** `reachedGoal`, `maxHeight`, `speedAt_<marker>`, `energyLost`, `fellOff`.
   - **Solution:** control points + friction. **Used in:** phys1 U3. **Packs:** Roller Coaster Designer.

10. **`collision-lab`**
    - **Does:** sets masses, velocities and elasticity for two carts; predicts the outcome; runs it.
    - **Scope:** `v1f`, `v2f`, `pBefore`, `pAfter`, `keLoss`, prediction values.
    - **Solution:** parameter values. **Used in:** phys1 U4. **Packs:** Billiards Lab.

11. **`torque-balance`**
    - **Does:** places masses on a beam or seesaw at grid positions; releases it.
    - **Scope:** `netTorque`, `balanced`, `alpha`.
    - **Solution:** placements. **Used in:** phys1 U5. **Packs:** Balance It.

12. **`oscillator`** *(new)*
    - **Does:** spring–mass or pendulum with sliders (m, k, L, amplitude, damping); live x(t) and energy graphs; target curves to match.
    - **Scope:** `T`, `f`, `omega`, `A`, `matchError`.
    - **Solution:** slider values. **Used in:** phys1 U6. **Packs:** Match the Rhythm.

13. **`orbit-sim`** *(new)*
    - **Does:** launches a satellite from a planet with chosen speed and angle; traces the orbit under gravity.
    - **Scope:** `eccentricity`, `escaped`, `period`, `minAltitude`, `crashed`.
    - **Solution:** speed + angle. **Used in:** phys1 U6. **Packs:** Orbit Missions.

14. **`wave-sim`** *(new)*
    - **Does:** a wave on a string (frequency, amplitude, tension); two-wave superposition; standing-wave mode; polariser mode for light.
    - **Scope:** `lambda`, `f`, `v`, `nodes`, `transmitted`.
    - **Solution:** slider values. **Used in:** phys2 U6. **Packs:** Standing Waves.

#### Calculus

15. **`graph-manipulator`**
    - **Does:** a plot (function, parametric or polar) with sliders for named parameters and draggable points.
    - **Overlays:** tangent at `x0`; secant with step `h`; shaded area on `[a, b]`; derivative curve; accumulation function; a target curve to match; data points for fitting; a **zoom window** for limits (ε–δ band).
    - **Scope:** slider values by name, `x0`, `fx0`, `fpx0`, `a`, `b`, `area`, `secantSlope`, `matchError`, `sse`, `zoomOk`.
    - **Solution:** values for all controls. **Used in:** calc1, calc2, phys1 (energy diagrams), linalg U6, probstat U4. **Packs:** Tangent Hunt, Limit Zoom.

16. **`function-target`** *(new; Marbleslides-style)*
    - **Does:** edits a function's parameters and domain restrictions (or types the function) so that marbles rolling along the graph collect every star.
    - **Scope:** `starsHit`, `totalStars`, parameter values.
    - **Solution:** parameters or expression + domain. **Used in:** calc1 U1–U3, calc2 U4. **Packs:** Lines, Parabolas, Transformations, Exponentials & Logs, Trig, Piecewise.

17. **`riemann-sum`**
    - **Does:** chooses `n` and a rule (left / right / midpoint / trapezoid / Simpson) for f on `[a, b]`.
    - **Scope:** `n`, `rule`, `approx`, `exact`, `error`.
    - **Solution:** `{n, rule}`. **Used in:** calc1 U4, calc2 U2. **Packs:** Fewest Rectangles.

18. **`series-explorer`**
    - **Does:** terms and partial sums with an `N` slider; Taylor-polynomial overlay with a degree slider.
    - **Scope:** `N`, `SN`, `limit`, `error`, `degree`, `maxErrorOnInterval`.
    - **Solution:** `{N}` or `{degree}`. **Used in:** calc2 U3. **Packs:** Converge or Not, Taylor Fit.

19. **`revolve-viewer`** *(new; three.js, lazy)*
    - **Does:** a region between curves revolving around an axis; slice slider shows a disk, washer or shell; the learner chooses the method and sets the radius functions.
    - **Scope:** `volume`, `methodOk`, `radiusMatches`.
    - **Solution:** method + radius expressions. **Used in:** calc2 U1.

#### Linear algebra

20. **`matrix-transform`**
    - **Does:** enters a 2×2 matrix (or composes given ones) and watches the unit square, a shape or the whole grid transform, against a target outline.
    - **Scope:** `a`, `b`, `c`, `d`, `det`, `matchError`, `matches`.
    - **Solution:** a matrix. **Used in:** linalg U2, U4, U5. **Packs:** Shape Shifter.

21. **`vector-play`**
    - **Does:** drags vectors in 2D. Modes: linear combination (set c₁, c₂ to reach a target), span/independence, eigen (drag v until Av ∥ v), projection.
    - **Scope:** `c1`, `c2`, `hitTarget`, `angleAvV`, `isEigen`, `projError`.
    - **Solution:** values. **Used in:** linalg U1, U3, U5, U6. **Packs:** Eigen Hunt, Span Reach.

22. **`row-reducer`**
    - **Does:** applies row operations by tapping (swap, scale, add a multiple), aiming for RREF, a solution or an inverse via `[A | I]`.
    - **Scope:** `isRREF`, `matchesTarget`, `ops`.
    - **Solution:** a list of operations. **Used in:** linalg U1–U3. **Packs:** RREF in Par.

#### Discrete mathematics

23. **`truth-table`**
    - **Does:** fills a truth table for an expression, or builds an expression from tokens to match a table.
    - **Scope:** `rowsCorrect`, `allCorrect`, `exprMatches`, `tokens`.
    - **Solution:** table or expression. **Used in:** discrete U1.

24. **`logic-gates`** *(new)*
    - **Does:** drags AND/OR/NOT/XOR/NAND gates and wires inputs to an output; a live truth table updates.
    - **Scope:** `matches`, `gateCount`.
    - **Solution:** gate netlist. **Used in:** discrete U1. **Packs:** Gate Puzzles, NAND Only.

25. **`knights-knaves`** *(new)*
    - **Does:** logic puzzles in which characters make statements; the learner marks each as truth-teller or liar, and the tool checks consistency statement by statement.
    - **Scope:** `assignmentCorrect`, `contradictions`.
    - **Solution:** assignment. **Used in:** discrete U1–U2. **Packs:** Island of Knights & Knaves.

26. **`venn-shader`** *(new)*
    - **Does:** taps regions of a 2- or 3-set Venn diagram to shade a set expression, or builds the expression for a shaded diagram; probability mode labels regions with probabilities.
    - **Scope:** `shadedMatches`, `regionProb`.
    - **Solution:** region set or expression. **Used in:** discrete U3, probstat U1.

27. **`graph-builder`**
    - **Does:** adds and removes vertices and edges (directed or not, optionally weighted); draws paths by tapping edges in sequence.
    - **Computed:** `connected`, `bipartite`, `hasEulerPath`, `hasEulerCircuit`, `isTree`, `chromatic` (exact for ≤ 8 vertices), `nV`, `nE`, `degrees`, relation properties (`reflexive`, `symmetric`, `transitive`, `antisymmetric`), `pathValid`.
    - **Solution:** edge list (or path). **Used in:** discrete U3, U6; dsa U6. **Packs:** Draw It in One Stroke, Colour the Map.

#### Data structures & algorithms

28. **`algorithm-stepper`**
    - **Does:** sees a visual data structure and **performs the next operation** by tapping (the swap, the next node to visit, the pivot position, the DP cell value…). Each action is checked against a reference trace; a wrong action explains why and lets the learner retry.
    - **Algorithms:** bubble, insertion, selection, merge (merge step), quicksort (Lomuto partition), binary search ("guess my number" mode), two pointers, sliding window, stack/queue operations, recursion call stack, hash insert (linear probing, chaining), heap insert/extract, BST insert/delete, AVL rotations, traversals, trie insert/search, BFS, DFS, topological sort (Kahn), Dijkstra (distance table), Prim, Kruskal with union–find, greedy coin change, DP table fill, backtracking (N-queens, subsets), Euclid / extended Euclid, Newton's method.
    - **Scope:** `stepsCorrect`, `totalSteps`, `mistakes`, `done`.
    - **Solution:** the generated reference trace. **Used in:** dsa (all units), discrete U5, calc1 U3. **Packs:** Sort Sprint, Heap Hero, Shortest Path Race.

29. **`code-runner`**
    - **Does:** CodeMirror 6 editor, Python or JavaScript, starter code per language; runs in a Web Worker with a timeout (Pyodide loaded on first use).
    - **Tests:** visible tests with results; hidden tests show pass/fail only. Comparator `exact | unordered | float(1e-6)`. Optional performance test with a named generator (`src/interactives/code-runner/generators.ts`), to reject brute force. Devices differ in speed, so the limit is relative: the runner first times the reference solution on the same device and input, and the learner's code must finish within `max(4 × reference time, 200 ms)`.
    - **Scope:** `passed`, `total`, `perfPassed`, `timeMs`.
    - **Solution:** reference code per language. The validator runs JS in Node `vm` and Python in a `python3` subprocess in CI.
    - **Used in:** dsa (all units), discrete U5. **Packs:** one kata pack per DSA unit.

30. **`memory-diagram`** *(new)*
    - **Does:** boxes and pointers for linked structures; the learner re-points arrows to perform an operation (insert, delete, reverse), or steps through code and predicts the diagram after each line.
    - **Scope:** `matchesTarget`, `lostNodes`, `steps`.
    - **Solution:** pointer assignments. **Used in:** dsa U2, U5. **Packs:** Pointer Surgery.

31. **`growth-race`** *(new)*
    - **Does:** plots operation counts for several algorithms as n grows; slider for n and log/linear axes; match code snippets to curves; find crossover points.
    - **Scope:** `n`, `crossover`, `matches`.
    - **Solution:** values or matching. **Used in:** dsa U1.

#### Probability & statistics

32. **`probability-sim`**
    - **Does:** runs 1, 100 or 10,000 trials of an experiment and compares empirical with theoretical results, after entering a prediction. Experiments: dice, coins, urns, cards, Monty Hall, birthday problem, random walks, sample means (CLT), confidence-interval coverage, custom. Enumerate mode lists all outcomes for small cases.
    - **Scope:** `prediction`, `theoretical`, `empirical`, `N`, `withinTolerance`.
    - **Solution:** prediction value. **Used in:** probstat U1–U4, discrete U4. **Packs:** Beat the Casino.

33. **`distribution-fitter`**
    - **Does:** adjusts distribution parameters (binomial, Poisson, normal, exponential) with sliders to match a histogram or meet a condition such as "P(X > 3) = 0.2".
    - **Scope:** parameter values, `fitError`, `targetProb`.
    - **Solution:** parameter values. **Used in:** probstat U2–U4. **Packs:** Shape Match.

34. **`bayes-grid`** *(new)*
    - **Does:** an icon array of 1,000 people; sliders for base rate, sensitivity and false-positive rate; tap to highlight groups and count.
    - **Scope:** `posterior`, `truePos`, `falsePos`, `estimate`.
    - **Solution:** slider values or estimate. **Used in:** probstat U1.

#### General-purpose and additional

35. **`diagram`** *(new; a small declarative engine, like Brilliant's "Diagrammar")*
    - **Does:** renders a parametric SVG scene from YAML, so authors can build small models without new code: dominoes falling for induction, a modular clock, Euclid's rectangle cut into squares, pigeons into holes, Pascal's triangle, a torque wrench, a skater pulling her arms in, a box folded from a sheet, a Markov population with an "advance one year" button.
    - **Config:**
      - `state`: named numbers or arrays;
      - `controls`: sliders and toggles bound to state, buttons whose `do` assigns new state from expressions, draggable points bound to state (optionally constrained to a line or curve);
      - `shapes`: line, rect, circle, polygon, arrow, text and plot, whose attributes are mathjs expressions over state, with `repeat` for arrays;
      - `readouts`: labelled expressions shown live.
    - **Scope:** every state variable and readout.
    - **Solution:** state values. **Used in:** any subject, wherever a §16 idea needs a small model that no catalog interactive covers.

36. **`induction-lab`** *(new)*
    - **Does:** move a magnet through a coil (or a rod along rails) by dragging or with a speed slider; live flux Φ(t) and EMF graphs side by side; a galvanometer shows the induced current's direction.
    - **Scope:** `flux`, `emf`, `currentDir`, `speed`, `turns`.
    - **Solution:** control values. **Used in:** phys2 U5. **Packs:** Light the Bulb.

**Ideas without a catalog interactive.** When a §16 idea has no matching interactive, build it in this order of preference:
1. a **preset or mode** of the nearest interactive (an Atwood machine or incline as `force-diagram` presets; the rolling race as an `energy-track` preset; a polariser as a `wave-sim` mode);
2. a **`diagram`** scene;
3. only if neither works, a new small interactive, recorded in `DECISIONS.md` (an allowed exception to rule 8 in §0).

### 9.5 Puzzle packs and sandbox

**Puzzle packs** are the main source of extra interactive practice. Each pack is a YAML file of levels (§7.7) for one interactive.

- **Size:** 10–20 levels per pack.
- **Curve:**
  - level 1 is solvable in under 30 seconds;
  - each level adds **one** new idea or constraint;
  - difficulty is non-decreasing (validator), and the last 3 levels are band ≥ 4.
- **Stars per level:** ★ solved · ★★ solved without hints · ★★★ solved at or under `par` (fewest parts, moves, gates or launches).
- **Unlocking:** a pack unlocks after its `unlockAfter` lesson; levels unlock in order, and the next 2 levels are always open, so one hard level never blocks progress.
- **Pack page:** level grid with stars, total stars, "Continue" button.
- **Minimum content:** every pack named in §9.4 and §16 for a unit is built before that unit ships. Interactives used mainly for exploration — `revolve-viewer`, `truth-table`, `venn-shader`, `growth-race`, `bayes-grid` and `diagram` — need no pack.
- **Progress** is keyed by `packId#levelId` (§12), so levels can be reordered or inserted later.

**Sandbox** (`#/sandbox/:interactive`): the interactive with every control unlocked, no goal, an undo button and a reset button. Useful for free play after a lesson and as the starting point for custom challenges.

### 9.6 Custom challenges (share by link)

For interactives with a challenge creator (`circuit-builder`, `function-target`, `charge-field` hockey, `graph-builder`, `logic-gates`, `vector-adder`, `energy-track`, `orbit-sim`). Each gains its creator in Phase 7 if it already exists, otherwise when it is built:

1. The learner builds a scene in the sandbox.
2. They pick a goal from that interactive's **goal templates** (e.g. "battery current = …", "collect all stars", "match this truth table"); free-form check expressions are not allowed.
3. They must **solve it once** themselves; the solution is stored with it.
4. They get a share link: `#/play?c=<lz-string payload>`.

**Opening a shared link**
- The payload is decoded and validated with the interactive's Zod schema; anything invalid shows "This challenge link is broken."
- Text fields (title, goal note) are limited to 120 characters and rendered as **plain text**, never as Markdown or HTML.
- Shared challenges award XP but never affect ratings or mastery.

---

## 10. UI: pages, layout, design

### 10.1 Routes (hash-based)

| Route | Page |
|---|---|
| `#/` | **Today:** daily-goal ring, streak with charges, "Continue lesson", Daily practice card (items due), Daily puzzle card, recommended next step |
| `#/subjects` | All subjects with progress rings |
| `#/s/:subjectId` | **Path map:** units as sections; nodes for lessons, practice sets, checkpoint, hard mode and puzzle packs; "Recommended first" notices; "Coming soon" placeholders |
| `#/l/:lessonId` | **Lesson player** (§8.1) |
| `#/practice` | **Practice hub:** daily practice, mistakes review, practice sets by lesson, mixed sets, checkpoints, speed rounds, hard mode |
| `#/practice/:mode/:id?` | Practice session (§8.2) |
| `#/checkpoint/:unitId` | Unit checkpoint (also "Test out") |
| `#/puzzles` | Puzzle pack gallery, grouped by subject, with star totals |
| `#/puzzles/:packId/:level?` | Level player |
| `#/sandbox/:interactive` | Sandbox and challenge creator |
| `#/play?c=…` | Shared custom challenge |
| `#/profile` | Concept levels per subject (Practised / Proficient / Mastered / Needs review), top misconceptions with links, XP chart, streak history, personal bests, export / import / reset |
| `#/settings` | Theme (system / light / dark), font size, reduced motion, daily goal, confidence prompts, preferred code language |

### 10.2 Layout

- **Desktop:**
  - main column, text max-width ≈ 720 px; interactives may use up to 960 px;
  - right sidebar: Facts panel, progress dots, hint ladder.
- **Mobile:**
  - single column; interactives fill the width;
  - Facts panel as a collapsible bottom drawer;
  - controls sized for touch (≥ 44 px); recommend landscape for `circuit-builder`, `logic-gates` and `graph-builder`.

### 10.3 Visual design

- Calm, focused and bright, with game-like moments only where they reward real work.
- Generous whitespace, clear typography, KaTeX for math.
- Light and dark themes via CSS variables.
- Interactives share one visual language: the same colours for "your input", "the model's output" and "the target"; draggable things look draggable.
- Correct and incorrect states use **icon + text + colour**, never colour alone.
- Subtle motion only; everything respects `prefers-reduced-motion`.

---

## 11. Accessibility

- Meet WCAG 2.2 AA contrast. Every control is keyboard-reachable with a visible focus ring.
- Feedback and score changes are announced via `aria-live="polite"`.
- **Widgets:**
  - MCQ and multi are proper radio and checkbox groups.
  - Drag-and-drop widgets (`order`, `categorize`, `match`, `tokens`, `parsons`, `proof-blocks`) use `@dnd-kit`'s keyboard sensor: select with Space, move with arrows, drop with Space.
  - `sketch` offers a point-entry alternative (type or place a few key points).
  - `expression` has a symbol keypad and accepts plain-text input.
- **Interactives:**
  - Each implements `describeState()`, rendered in a visually hidden live region.
  - Where feasible, offer a keyboard alternative. For example, `circuit-builder` has a list-based editor ("add resistor between node 1 and node 2"), and graph interactives accept typed coordinates.
- Colour palettes are colour-blind safe; series in plots are also distinguished by dash pattern or label.
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
    concept: Record<string, {                              // keys are namespaced: "<subject>/<slug>" (§7.3)
      r: number; n: number;                                  // rating; graded answers counted
      recent: { itemId: string; score: number }[];           // last 4 graded answers (Proficient rule, §3.4)
      ratingAtLessonStart?: Record<string, number>;          // lessonId → rating when the attempt began (recap deltas)
    }>;
  };
  memory: Record<string, { h: number; last: string; dueOverride?: boolean; freshNext?: boolean }>; // §3.3, §2.5
  mastery: Record<string, { level: 'practised' | 'proficient' | 'mastered'; proficientAt?: string }>;
  lessons: Record<string, {
    status: 'not-started' | 'in-progress' | 'completed' | 'tested-out';
    bestScore: number;            // mean core score, 0–1
    stars: 0 | 1 | 2 | 3;
    practised: boolean;           // practice set ≥ 80%
    completedAt?: string;
    attempt?: AttemptState;       // present while in progress
  }>;
  units: Record<string, { checkpointBest?: number; mastered: boolean; hardModeDone?: boolean }>;
  items: Record<string, { lastScore: number; attempts: number; lastAt: string; version: number }>; // key: lessonId#itemId
  mistakes: Record<string, { firstAt: string; correctDays: string[] }>;  // mistakes-review queue
  misconceptions: Record<string, { count: number; lastSeen: string }>;
  puzzles: Record<string, { stars: 0 | 1 | 2 | 3; bestPar?: Record<string, number>; solvedAt?: string }>; // key: packId#levelId
  sandbox: Record<string, { name: string; scene: unknown; savedAt: string }[]>;   // interactive type → saved builds
  speed: Record<string, { best: number; lastAt: string }>;
  xp: { total: number; byDay: Record<string, number> };
  streak: { current: number; longest: number; lastDay: string; charges: number };
  settings: {
    theme: 'system' | 'light' | 'dark'; fontScale: number; reducedMotion: boolean;
    dailyGoal: 50 | 100 | 200; confidencePrompts: boolean; codeLang: 'python' | 'javascript';
  };
}

interface AttemptState {
  lessonVersion: number;          // if the lesson's version has changed, the attempt is discarded and restarted
  seed: number;
  screenIndex: number;
  chosenVariants: Record<string, 'easier' | 'standard' | 'harder'>;
  insertedSteps: string[];
  answers: Record<string, { answer: unknown; hintsUsed: number; attempts: number; score?: number }>;
  explore: Record<string, { taskIndex: number; state: unknown }>;
  challenges: Record<string, { variant: string; state: unknown; hintsUsed: number; checks: number; solved: boolean }>;
  facts: string[];
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
  - Elo update, expected score and the MCQ guessing correction;
  - variant selection bands and streak rules, and the question-rating formula centred on `baseDifficulty`;
  - seeded param draws (deterministic);
  - template evaluation and number formatting (edge cases: 0, negatives, 1e-4, 123456, 0.1 + 0.2);
  - scoring;
  - memory half-life updates, due computation, implicit credit and failure propagation;
  - mastery level transitions;
  - XP and streak rules, including charges and the day boundary.
- **Practice:** `buildSession` composition for each mode (no repeats, no back-to-back concepts, difficulty targets).
- **Widgets:** `grade()` for each kind, including misconception matching, expression equivalence (with undefined points), proof-block DAG ordering.
- **Interactives:** solvers and `checkScope`/`solutionScope` on fixtures. Circuit solver: single, series, parallel, mixed, bridge, two-source Kirchhoff case, meters, switches, short and open detection.
- **Storage:** migrations; round-trip of export/import; share-link encode/decode, including rejection of malformed payloads.

### 13.2 Content validator (`npm run content:check`)

Errors fail CI; warnings are printed.

**Structure (errors)**
- Every YAML file passes its Zod schema. Ids are unique. Lesson id matches its file path.
- Every lesson referenced in `subject.yaml` either has a file or is shown as a placeholder. Every lesson file is listed in `subject.yaml`.
- Every concept and misconception id referenced exists.
- **Lesson shape** (§2.2):
  - 15–25 screens; first is `hook`, last is `recap`;
  - ≥ 2 `explore` screens and exactly 2 `challenge` screens;
  - ≥ 75% of screens are not `concept`;
  - no two `concept` screens in a row; each concept card ≤ 80 words (math counted as one word);
  - on `standard` variants: ≥ 5 distinct question kinds, `mcq` ≤ 35%, ≥ 2 core steps with a generative kind, no kind more than twice in a row;
  - on each of the easier, standard and harder tracks: `mcq` ≤ 50% and no kind more than 3 times in a row;
  - ≥ 1 remediation step in `extras`;
  - explore screens have 2–5 tasks with at least one `goal`.
- **Steps:**
  - ≥ 6 core steps, each with `easier`, `standard` and `harder` at strictly increasing difficulty; `standard` between 2 and 4, non-decreasing through the lesson;
  - `check`, remediation and bonus steps have `standard` only; remediation steps have a valid `remediates`;
  - core steps have `establishes` and `standaloneContext`.
- **Chain links:** `uses` only points to earlier steps; `clueFor` only to later steps or challenges; ≥ 2 `uses` and ≥ 1 `clueFor` per lesson; the last core step uses ≥ 2 steps.
- **Questions:**
  - every kind's own `validate()` passes (§9.1);
  - graded questions have `nudge` and `partial` hints and an explanation with the labels `**Answer:**`, `**Why:**`, `**Common mistakes:**`, `**Connects to:**`;
  - every wrong option, wrong answer, wrong order, card and wrong target that has a tag uses a defined misconception.
- **Practice pool:** ≥ 12 items, ≥ 3 kinds, every lesson concept covered, ≥ 3 items at band ≥ 4 including ≥ 1 at band 5, and every `params` spec gives ≥ 2 visibly different versions.
- **Challenges and puzzle levels:** 3 challenge variants at strictly increasing difficulty; config and solution pass the interactive's schemas; packs have 10–20 levels with unique ids and non-decreasing difficulty.
- **Mixed sets and speed rounds:** pass their schemas (§7.7); every `method` tag in the listed lessons is one of the set's `methods`, and each method has ≥ 2 items.
- **Scope:** no check, feedback or verify expression uses a name defined both by params/derived and by the interactive (§7.5).
- **Ids:** concept and misconception slugs are unique within their subject; cross-subject references use `<subject>/<slug>`.

**Numbers and models (errors)** — for **every** param set (or 200 seeded samples for `vars`):
- all templates and expressions evaluate to finite numbers with no unknown symbols;
- `mcq`: the displayed options are **pairwise distinct after formatting**;
  - example the validator must catch: with V = 9 and R = 3, the options $V \cdot R$ and $V^2/R$ both show "27";
- `numeric`: no `wrongAnswers` value is within tolerance of the answer, and no two wrong answers coincide;
- `expression`: no wrong answer is equivalent to the answer;
- `order`: item values are distinct, and no `wrongOrders` entry equals the correct order;
- `hotspot` and `interactive` questions with `verify`: every rule is true on the interactive's initial state;
- `verify` pairs for symbolic answers agree at 20 random points (relative tolerance 1e-9);
- **explore tasks:** starting from the interactive's initial state, each goal is **false before** its solution is applied and **true after**, in order;
- **challenges and puzzle levels:** the `solution` satisfies `check.expr`, uses no more parts than the palette allows, and **no `feedback` rule fires on it**;
- code challenges: reference solutions pass all tests in CI.

**Rendering (errors)**
- Every `$…$` and `$$…$$` renders with KaTeX `throwOnError: true` after template substitution.

**Quality (warnings)**
- Prompt over 80 words; explore intro over 40 words.
- Lesson mean core `standard` difficulty more than 0.5 away from its unit's `baseDifficulty`.
- A misconception defined but never used; the same misconception tag on two options or wrong answers of one question (categorize cards and hotspot targets are exempt).
- A practice item that refers to "Qn" or "above".
- A worked example containing the same numbers as a param set.
- A unit with no `find-the-error` question, or a subject with fewer than 3 `tryFirst` lessons.

A working prototype of these checks, run against §7.8, is the bar: the reference lesson must pass with zero errors, and deliberately broken copies (a colliding param set, a wrong challenge solution, bad LaTeX, an explore goal that is already met) must each be caught.

**Interactives not built yet.** The validator needs each interactive's `model.ts`. In phases where an interactive's model doesn't exist yet, content using it fails validation, so build the model (schemas, solver, scopes; no UI) before or together with the first content that uses it (§14).

### 13.3 E2E smoke (Playwright)

1. Today page loads; all 8 subjects are listed under Subjects.
2. Open phys2 → open the reference lesson.
3. Commit the hook prediction and finish its reveal; complete both explore screens; answer every question; solve both challenges:
   - the e2e build (`--mode e2e`, `VITE_DEBUG=1`) exposes `window.__stepwiseDebug` with `answerCurrent()`, `loadSolution()` and `setSeed()`;
   - the debug API is compiled out of the production build (`import.meta.env.VITE_DEBUG` is undefined there), and a unit test checks that `dist/` contains no `__stepwiseDebug`.
4. The recap shows stars; "Practise this lesson" starts an 8-item practice set with fresh numbers *(from Phase 4)*.
5. Reload mid-lesson and confirm resume works (same screen, numbers and interactive state).
6. Daily practice builds a session once a lesson is complete; a streak day is recorded.
7. Open a circuit puzzle pack, solve level 1 via the debug hook, see stars.
8. Create a custom circuit challenge in the sandbox, open its share link in a new page, and see it load.
9. Export progress, reset, import, and confirm progress is restored.

---

## 14. Build phases (do them in order)

Each phase ends deployed, with tests and `content:check` green.

**Phase 0 — Scaffold & deploy**
- Vite + React + TS + Tailwind, HashRouter, `config.ts`, base path from `BASE_PATH`.
- Deploy workflow, an empty Today page live on GitHub Pages, lint and test setup, `DECISIONS.md`.
- ✅ The site loads at `https://<user>.github.io/<repo>/`; refreshing on a hash route works.

**Phase 1 — Content pipeline & path maps**
- Zod schemas for every content file type, the validator, the build script, per-subject JSON output.
- `subjects.yaml` plus `subject.yaml` and `concepts.yaml` for **all 8 subjects** from Section 16 (lessons as placeholders).
- Subjects page and path maps.
- ✅ All units and lessons from Section 16 are browsable; placeholders show "Coming soon"; the validator catches deliberately broken fixtures.

**Phase 2 — Lesson player, core widgets & engine**
- All screen types (§2.3, §8.1); the core widget set (§9.2), including `hotspot`; Facts panel, Explanations tab, hint ladder, interpretive feedback, scoring.
- Engine: ratings, variant selection, memory model, mastery, progress storage.
- The `circuit-builder` **model** only (config and solution schemas, MNA solver, check scope; no UI), so the validator can check the reference lesson.
- Load the reference lesson (§7.8). Interactives render as placeholders that can be completed via the debug API.
- ✅ The reference lesson passes `content:check` and plays end to end (with placeholder interactives); variant selection reacts to performance; resume works; engine unit tests pass.

**Phase 3 — Interactive framework + circuits (MVP release)**
- `InteractiveHost`, the registry with lazy loading, the `circuit-builder` view in all modes (view, explore, challenge, sandbox), `transient-plotter`, the `interactive` widget, and the puzzle-pack player.
- Write **all 8 lessons of phys2 U3** at the §7.8 quality bar, each with its practice pool, plus the unit's mixed set and speed round.
- Build all five U3 puzzle packs: **Series & Parallel**, **Meters**, **Brightest Bulb**, **Kirchhoff Knots**, **Time-Constant Targets**.
- ✅ The full phys2 U3 unit plays end to end; every task, challenge and level solution validates; e2e steps 1–3, 5 and 7 pass. **This is the MVP.**

**Phase 4 — Practice system & motivation**
- Practice hub, lesson practice sets, daily practice, daily puzzle, mistakes review, unit checkpoints (with test-out), speed rounds, hard mode.
- XP, daily goal, streaks and charges, Today page, profile page with concept levels and misconceptions, export / import / reset, settings.
- ✅ A missed question returns in mistakes review with new numbers; daily practice follows the fill rules; a checkpoint pass promotes Proficient concepts to Mastered and marks the unit mastered; e2e steps 4, 6 and 9 pass.

**Phase 5 — DSA tooling + content**
- `code-runner` (JS + Pyodide), `algorithm-stepper`, `memory-diagram`, `growth-race`; widgets `parsons`, `table`, `code`.
- Write dsa U1 and U2 with practice pools, the "Big-O of snippets" speed round, the Pointer Surgery pack and the U1–U2 kata packs.
- ✅ Python and JS reference solutions validate in CI; stepper traces match reference implementations.

**Phase 6 — Calculus tooling + content**
- `graph-manipulator`, `function-target`, `riemann-sum`, `series-explorer`, `diagram`; widgets `graph-point`, `sketch`, `tokens`.
- Write calc1 U1 and U2, their mixed sets and speed rounds, and their packs: function-target **Lines**, **Parabolas**, **Transformations**, **Piecewise**, **Trig**; graph-manipulator **Limit Zoom** and **Tangent Hunt**.
- ✅ Symbolic answers use `verify`; every graph task and level validates.

**Phase 7 — Sandbox & custom challenges**
- Sandbox for every built interactive; the challenge creator and share links (§9.6) for the interactives listed there.
- ✅ e2e step 8 passes; malformed share links are rejected safely.

**Phase 8 — Remaining interactives and content rollout**
- Build the remaining interactives and widgets as each subject needs them (`matrix`, `proof-blocks`, `odd-one-out` and the rest).
- Write content in this order:
  1. calc1 (rest)
  2. phys1
  3. phys2 (rest)
  4. linalg
  5. discrete
  6. dsa (rest)
  7. calc2
  8. probstat
- Each unit is released only when all its lessons, practice pools, its mixed set (if any) and its puzzle packs pass `content:check` and a manual play-through.

**Per-lesson definition of done**
- [ ] 15–25 screens following §2.2, with ≥ 2 explore screens and 2 challenges.
- [ ] ≥ 6 core steps × 3 variants, at least 1 remediation step, and optionally 1 bonus step.
- [ ] Variety rules met on the standard track and on every track (§2.2).
- [ ] Practice pool of ≥ 12 items in ≥ 3 kinds, with ≥ 1 band-5 item.
- [ ] Chain rules satisfied; explanations follow the template.
- [ ] Zero validator errors.
- [ ] Played through once at each difficulty extreme, on desktop and on a phone.

---

## 15. Content authoring rules

### 15.1 Hooks, explores and concept cards

- **Hook:** one situation, one prediction, one surprise. No formulas. The caption names what the lesson will explain.
- **Try-first hooks** (`tryFirst: true` lessons): pose a problem the learner can attempt with what they know but can't fully solve. Never mark the attempt right or wrong. Then show 2–3 short sample student attempts (one partly right, one with a typical misconception) and the canonical method.
- **Explore:**
  - expose only the controls that matter, with limited ranges and deliberate defaults;
  - the starting state must not already meet the first goal;
  - 2–5 tasks, at least one of them a goal; each goal is a single action with a measurable check;
  - put a `predict` task before any goal whose outcome is surprising;
  - end with a one-line takeaway in plain words.
- **Concept card:** ≤ 80 words; names what was just discovered; one formula or diagram; define every symbol with its unit.

### 15.2 Questions

- One idea per question; prompt ≤ 80 words; no trick wording.
- Avoid "which is NOT …". If unavoidable, use it only in `harder` variants and **bold** the NOT.
- **Prefer generating to choosing.** Use `numeric`, `expression`, `blanks`, `table`, `tokens`, `graph-point` or `sketch` when the answer is a value, formula or shape. Use `mcq` for conceptual choices where the distractors are real misconceptions.
- **Vary the widget.** Within a lesson, use at least 5 kinds; don't use the same kind more than twice in a row.
- **Scenario continuity.**
  - A lesson's chain shares one scenario (one circuit, one function, one array) unless a step explicitly says "Now consider …".
  - All three variants of a step keep that step's scenario and establish the same fact.
- Refer to earlier steps by description ("the series circuit from before"), not only by number. The UI adds the "↩ builds on Qn" chips.
- **Variants:** `easier` scaffolds the same idea (gives an intermediate value, or asks for one step only); `harder` adds a twist (a new situation, a conceptual trap, or a second step) — not just bigger numbers.

### 15.3 Wrong answers and distractors

- Each wrong option, `wrongAnswers` value, `wrongOrders` order, tagged card or `wrongTargets` element is a **specific, plausible mistake** that real students make, tagged with a misconception id. Within a question, give different options and wrong answers different tags (cards and hotspot targets may share one).
- For `numeric` and `expression` questions, list the 2–3 most common wrong results as `wrongAnswers`, so typed mistakes get targeted feedback.
- Wrong options have the same units and format as the answer, similar length, and plausible magnitude.
- Never use "all of the above", "none of the above", or joke options.
- Computed wrong answers must come from the misconception's actual wrong formula. Do not invent random nearby numbers.

### 15.4 Explanation template (mandatory for graded questions)

```
**Answer:** <the answer>

**Why:** <3–8 short lines of reasoning with equations; show the substitution with real numbers>

**Common mistakes:**
- <wrong answer> — <the mistake behind it, in one line>
- …

**Connects to:** <which earlier step this used and/or which later step or challenge it helps with>
```

### 15.5 Hints

- `nudge`: a question or pointer; never a formula with numbers substituted.
- `buildsOn`: optional authored override; otherwise auto-generated from `uses` plus the Facts panel.
- `partial`: does about half the work; never states the final answer.

### 15.6 Challenges and puzzle levels

- The goal is one measurable sentence.
- At least 3 `feedback` rules for the most common wrong states, none of which fire on the solution.
- `harder` adds a constraint (use all parts, fewer moves, a tighter tolerance, a meter reading, a performance limit). It must not just change the numbers.
- Set `par` to the solution's part or move count.
- The solution is always provided and validated.
- In packs: level 1 under 30 seconds; one new idea per level; name each level (short and playful is fine).

### 15.7 Practice pools

- ≥ 12 standalone items: no references to the lesson's screens, no Facts panel needed.
- Cover every concept of the lesson; ≥ 3 kinds; ≥ 3 items at band ≥ 4.
- Use `params` so every item has fresh numbers each time it's served.
- Tag items with `method` when they belong in a "choose the method" set.

### 15.8 Per-subject conventions

- **Physics:** SI units, g = 9.8 m/s² (state it in the prompt when used), 3 significant figures, vectors with components.
- **Calculus / Linear algebra:**
  - Symbolic answers use `expression` (graded by equivalence) or static options in LaTeX with `verify` pairs (e.g. lhs `derivative('x^2*sin(x)', 'x')`, rhs `2x*sin(x) + x^2*cos(x)`).
  - Exact values are preferred over decimals.
- **DSA:**
  - Python first; show JS in explanations when syntax differs meaningfully.
  - Complexity in Big-O with the variable defined.
  - Arrays are 0-indexed.
- **Discrete:** use standard notation (∧ ∨ ¬ → ↔, ∀ ∃). Proof steps in `proof-blocks` are complete sentences.
- **Probability & Statistics:** probabilities as fractions or to 3 decimal places; state assumptions (independence, fair coin) explicitly.

---

## 16. Syllabi for every subject

**Format of each subject below:**
- **Interactives** the subject relies on (§9.4) and the widgets to feature (§9.2).
- **Try-first lessons:** set `tryFirst: true` on these in `subject.yaml`; their hooks use productive failure (§2.8).
- **Mixed sets** ("choose the method", §3.5): create one file per set in `content/<subject>/mixed/`.
- **Speed rounds** (§3.5): one file per round in `content/<subject>/speed/`.

**Format of each unit below:**
- A table of lessons: id suffix, title, key concepts.
- **Misconceptions to target:** the starting list for `misconceptions.yaml`; add more as needed.
- **Interactives & practice:** starting ideas for the unit's explore screens, challenges, puzzle packs and widgets. Every lesson still needs its own hook, ≥ 2 explore screens and 2 challenges (§2.2); use these ideas first and invent more in the same spirit.
- `baseDifficulty` (base) rises through each subject.

Turn the concept phrases into slugs in each subject's `concepts.yaml` (with `requires` links). Lesson-level `prerequisites` default to the previous lesson in the unit, unless the content clearly needs a different one.

`content/subjects.yaml` order: `calc1, calc2, phys1, phys2, linalg, discrete, dsa, probstat`.

---

### 16.1 Calculus I — `calc1`

**Prerequisites:** algebra, trigonometry.

- **Interactives:** graph-manipulator (incl. limit zoom), function-target, riemann-sum, algorithm-stepper (Newton). Widgets to feature: `expression`, `sketch`, `graph-point`, `match`, `find-the-error`.
- **Try-first lessons:** u1.l2 (the idea of a limit), u2.l1 (the derivative as a limit), u4.l2 (area and Riemann sums), u4.l4 (the Fundamental Theorem).
- **Mixed sets:** "Which limit technique?" (u1.l3–l6: substitution, factoring, rationalizing, squeeze, dominant terms); "Which derivative rule?" (u2.l2–l6: power, product, quotient, chain, implicit); "Guess the antiderivative or substitute?" (u4.l1, u4.l5).
- **Speed rounds:** Derivative rules sprint; Limits at a glance; Basic antiderivatives.

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
- **Interactives & practice:**
  - Explore: function-target warm-up, shifting and stretching a parabola to hit stars (l1); limit zoom, shrinking the window around x = a and watching f(x) settle (l2–l3); fill the "hole" to make f continuous (l5).
  - Challenges: "drag x toward a until every point in the window is within ε = 0.1 of L"; IVT: "trap a root in an interval of width ≤ 0.01 by bisection"; ε–δ: "choose the largest δ that works for ε = 0.05".
  - Puzzle packs: function-target **Lines**, **Parabolas**, **Transformations**, **Piecewise**; graph-manipulator **Limit Zoom**.
  - Widgets: `sketch` (end behaviour), `blanks` (limit laws), `odd-one-out` (which limit doesn't exist).

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
- **Interactives & practice:**
  - Explore: drag the secant point into the tangent point and watch the slope (l1); drag x0 along f and watch f′ being traced (l2); linked "composition machine" plots where rates multiply (l4).
  - Challenges: "shrink h until the secant slope is within 0.01 of the tangent"; "drag x0 to every point with a horizontal tangent"; sketch f′ from the graph of f; related rates: "set the ladder's sliding speed so the top falls at 0.5 m/s when it is 3 m up".
  - Puzzle packs: graph-manipulator **Tangent Hunt**; function-target **Trig**.
  - Widgets: `expression` (derivatives), `match` (graphs of f ↔ graphs of f′), `find-the-error` (product and chain rule slips).

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
- **Interactives & practice:**
  - Explore: drag a point along f and watch the signs of f′ and f″ light up (l4); box from a sheet: slide the cut size and watch the volume curve (l6); Newton's method drawn as tangent lines (l8).
  - Challenges: "set the cut size to maximise the box volume (within 1%)"; `graph-point`: "place a point at every local extremum and inflection point"; algorithm-stepper Newton: "reach the root within 1e-6 in ≤ 4 steps from a start you choose"; sketch a curve from a sign table.
  - Puzzle pack: function-target **Exponentials & Logs**.
  - Widgets: `sketch`, `graph-point`, `find-the-error` (L'Hôpital misused).

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
- **Interactives & practice:**
  - Explore: add rectangles under a curve and watch the error shrink (l2); drag the upper limit and watch the accumulation function A(x) grow, with slope f(x) (l4); substitution as a stretched x-axis (l5).
  - Challenges: riemann-sum "error < 0.01 with the fewest rectangles"; graph-manipulator "drag x until A(x) = 3"; "choose a and b so the signed area is 0".
  - Puzzle pack: **Fewest Rectangles**.
  - Widgets: `expression` (antiderivatives), `blanks` (FTC steps), `categorize` (signed area positive, negative or zero).

---

### 16.2 Calculus II — `calc2`

**Prerequisites:** calc1.

- **Interactives:** revolve-viewer, graph-manipulator, riemann-sum, series-explorer, function-target (parametric and polar modes). Widgets to feature: `expression`, `parsons`, `find-the-error`, `categorize`, `match`.
- **Try-first lessons:** u1.l2 (volumes by slicing), u3.l2 (series and geometric series), u3.l8 (Taylor series).
- **Mixed sets:** "Which integration technique?" (u2.l1–l4); "Which convergence test?" (u3.l3–l6); "Disk, washer or shell?" (u1.l2–l3).
- **Speed rounds:** Spot the technique; Geometric series sums; Standard Maclaurin series.

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
- **Interactives & practice:**
  - Explore: drag the boundary curves and watch the area between them (l1); revolve a region and slide the slice: disk vs washer vs shell (l2–l3); pumping a tank, where each slice's work adds up (l5).
  - Challenges: revolve-viewer "choose the method and set the radius functions so the volume matches"; graph-manipulator "move the curves so the area between them is exactly 4".
  - Widgets: `expression` (set up the integral), `match` (solid ↔ integral), `find-the-error` (washer as (R − r)²).

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
- **Interactives & practice:**
  - Explore: `worked` screens with adaptive fading for each technique; `tokens`: choose u and dv and see whether the new integral gets simpler (l1); push the upper limit of an improper integral and watch the area settle — or not (l6).
  - Challenges: `parsons` "order the steps of an integration-by-parts solution"; riemann-sum (Simpson) "error < 1e-4 with the smallest n".
  - Widgets: `expression`, `parsons`, `find-the-error` (missing back-substitution).

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
- **Interactives & practice:**
  - Explore: geometric-series blocks filling a square (l2); partial sums racing to a limit or drifting off (l3); Taylor polynomials hugging sin x as the degree slider rises (l8).
  - Challenges: series-explorer "smallest N with |S − S_N| < 0.001"; Taylor mode "lowest degree with error < 0.01 on [−1, 1]".
  - Puzzle packs: **Converge or Not**, **Taylor Fit**.
  - Widgets: `categorize` (converges / diverges), `expression` (radius of convergence), `find-the-error` (ratio test with L = 1).

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
- **Interactives & practice:**
  - Explore: a point moving along a parametric curve with a time slider and velocity vector (l1–l2); a polar plotter where θ sweeps and r draws petals (l3).
  - Challenges: function-target in parametric or polar mode "set a and b so the curve passes through every star"; graph-manipulator "find the θ-limits that cover exactly one petal".
  - Widgets: `match` (polar equation ↔ curve), `expression`.

---

### 16.3 Physics I: Mechanics — `phys1`

**Prerequisites:** calc1 (can be taken alongside).

- **Interactives:** projectile-launcher, motion-graph, vector-adder, force-diagram, energy-track, collision-lab, torque-balance, oscillator, orbit-sim, graph-manipulator. Widgets to feature: `numeric` (with units), `sketch`, `estimate`, `hotspot`, `order`.
- **Try-first lessons:** u1.l5 (projectile motion), u2.l2 (Newton's second law), u3.l3 (conservation of energy), u4.l3 (collisions), u5.l4 (rotational dynamics).
- **Mixed sets:** "Which conservation law?" (u3.l3, u4.l2–l3, u5.l6); "Forces or energy?" (u2.l5, u3.l3–l4); "Which kinematics equation?" (u1.l4–l5).
- **Speed rounds:** Unit conversions & prefixes; Vector components; Kinematics quick-fire.

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
- **Interactives & practice:**
  - Explore: vector-adder tip to tail with components (l1); motion-graph walker drawing its own x–t and v–t graphs (l2–l3); projectile-launcher with ghost trails comparing angles (l5); a boat crossing a river with a current slider (l6).
  - Challenges: "hit the target at 30 m"; "find both launch angles that work"; motion-graph "draw the x–t graph for this v–t graph"; vector-adder "add the vector that brings the hiker home".
  - Puzzle packs: **Target Practice**, **Over the Wall**, **Match the Graph**, **Vector Navigation**.
  - Widgets: `sketch` (v–t from x–t), `estimate` (order-of-magnitude questions), `numeric` with units.

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
- **Interactives & practice:**
  - Explore: force-diagram "Run" mode: push a block and watch it accelerate (l2); an Atwood machine with mass sliders (l3); tilt an incline until the block slips (l4–l5).
  - Challenges: force-diagram "draw the FBD of a block sliding up a rough incline"; graph-manipulator "set μ so the block just starts to slide at 25°"; "choose the bank angle so a car rounds the curve with no friction".
  - Puzzle pack: **FBD Gym**.
  - Widgets: `hotspot` (tap the third-law partner), `categorize` (third-law pair vs balanced pair), `find-the-error`.

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
- **Interactives & practice:**
  - Explore: energy-track: shape a hill and watch KE and PE trade (l3); add friction and watch thermal energy appear (l4); a U(x) curve with a draggable total-energy line (l6).
  - Challenges: energy-track "design a track so the cart stops exactly on the platform", "clear the loop with the lowest starting height"; graph-manipulator "set E so the particle is trapped between x = 1 and x = 3".
  - Puzzle pack: **Roller Coaster Designer**.
  - Widgets: `order` (rank the speeds at marked points), `numeric`.

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
- **Interactives & practice:**
  - Explore: collision-lab with an elasticity slider: momentum bars stay level while KE bars change (l2–l3); explosion and recoil mode (l2).
  - Challenges: collision-lab "choose m₂ so cart 1 stops dead after an elastic collision", "set the elasticity so half the KE is lost"; predict-then-run final velocities.
  - Puzzle pack: **Billiards Lab**.
  - Widgets: `categorize` (elastic / inelastic / perfectly inelastic), `numeric`, predictions.

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
- **Interactives & practice:**
  - Explore: a torque wrench with lever-arm and angle sliders (l2); a rolling race of hoop, disk and sphere down a ramp — predict, then run (l5); a spinning skater pulling her arms in (l6).
  - Challenges: torque-balance "balance the beam using exactly three masses", "place the pivot so 2 kg balances 5 kg"; the rolling race with your own predictions.
  - Puzzle pack: **Balance It**.
  - Widgets: `order` (rank the rolling objects), `find-the-error`.

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
- **Interactives & practice:**
  - Explore: oscillator: change mass, stiffness and amplitude — which ones change the period? (l1–l2); orbit-sim: launch faster and faster until the orbit opens up (l5–l6).
  - Challenges: oscillator "set m and k to match the target x(t)"; orbit-sim "put the satellite into a circular orbit at this radius", "escape with the lowest launch speed".
  - Puzzle packs: **Match the Rhythm**, **Orbit Missions**.
  - Widgets: `categorize` (changes the period / doesn't), `numeric`.

---

### 16.4 Physics II: Electricity & Magnetism — `phys2`

**Prerequisites:** phys1, calc1 (calc2 helpful).

- **Interactives:** circuit-builder, transient-plotter, charge-field (incl. Field Hockey), particle-in-field (incl. wire mode), induction-lab, wave-sim, graph-manipulator. Widgets to feature: `numeric`, `hotspot`, `categorize`, `order`, `sketch`.
- **Try-first lessons:** u1.l3 (the electric field), u2.l2 (Gauss's law), u3.l5 (Kirchhoff's rules), u5.l1 (Faraday's law).
- **Mixed sets:** "Series, parallel or Kirchhoff?" (u3.l3–l5); "Coulomb, superposition or Gauss?" (u1.l2–l5, u2.l2); "Which hand rule?" (u4.l1–l3, u5.l2).
- **Speed rounds:** Circuit quick-fire (Ohm's law and power); Field directions; Unit prefixes (μ, n, k, M).

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
- **Interactives & practice:**
  - Explore: charge-field: drag a test charge around one and then two source charges and watch the force arrow (l1–l2); field vectors appear as charges are added (l3–l4).
  - Challenges: "place a third charge so the net force on q is zero"; "make the field at P point along +x"; Field Hockey levels.
  - Puzzle packs: **Zero-Field Points**, **Field Hockey**.
  - Widgets: `hotspot` (tap where the field is strongest), `graph-point` (draw the force vector), `sketch` (E against r).

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
- **Interactives & practice:**
  - Explore: drag a Gaussian surface around charges; the flux counter changes only when a charge crosses it (l1–l2); a potential heat map with equipotentials and perpendicular field arrows (l4–l6).
  - Challenges: charge-field potential mode "make V = 0 at P while E ≠ 0", "arrange charges so P lies on the 5 V equipotential".
  - Widgets: `categorize` (flux changes / doesn't), `hotspot` (tap the highest potential).

**U3 — Current & DC Circuits** (base 3) — **MVP unit; build first**

| Lesson | Title | Key concepts |
|---|---|---|
| l1 | Current, resistance & resistivity | current as charge flow, drift, R = ρL/A, conservation of charge |
| l2 | Ohm's law & electrical power | **reference lesson, §7.8** |
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
- **Interactives & practice:**
  - Explore: follow the reference lesson (§7.8): switch-and-slider circuits, meter placement, and a charging capacitor with a time cursor (l7–l8).
  - Challenges: circuit-builder "hit the target current", "make bulb A the brightest", "measure V across R₂ correctly", two-loop Kirchhoff builds; transient-plotter "choose R so the capacitor reaches 63% at 2 s".
  - Puzzle packs: **Series & Parallel**, **Meters**, **Brightest Bulb**, **Kirchhoff Knots**, **Time-Constant Targets**.
  - Widgets: `numeric`, `hotspot`, `categorize`, `order`, `find-the-error` (voltmeter in series).

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
- **Interactives & practice:**
  - Explore: particle-in-field: change speed and B and watch the radius (l1–l2); a current-carrying wire in a field with a current slider and force arrow (l3).
  - Challenges: particle-in-field "set B so the proton hits the detector", "set E so the beam goes straight"; right-hand-rule drills with `hotspot`.
  - Puzzle packs: **Cyclotron Shots**, **Velocity Selector**.
  - Widgets: `hotspot` (tap the force direction), `match` (configuration ↔ force direction).

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
- **Interactives & practice:**
  - Explore: induction-lab: move a magnet through a coil and watch flux and EMF graphs side by side (l1–l2); slide a rod on rails at different speeds (l3); transient-plotter: RL current rise with a time cursor (l5).
  - Puzzle pack: induction-lab **Light the Bulb**.
  - Challenges: graph-manipulator "sketch Φ(t) that produces this EMF pattern"; transient-plotter (RL) "set L for τ = 0.1 s"; `hotspot` "tap the direction of the induced current".
  - Widgets: `sketch`, `find-the-error` (Lenz's-law sign).

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
- **Interactives & practice:**
  - Explore: wave-sim: change the frequency and watch the wavelength (l2); polariser mode: rotate filters and watch the transmitted intensity (l4).
  - Challenges: wave-sim "set λ and amplitude to match the wave", "rotate the polariser to transmit 25%", "add a middle polariser so light passes crossed filters".
  - Puzzle pack: **Standing Waves**.
  - Widgets: `numeric`, `match` (spectrum band ↔ wavelength).

---

### 16.5 Linear Algebra — `linalg`

**Prerequisites:** algebra (calc1 helpful).

- **Interactives:** row-reducer, matrix-transform, vector-play, vector-adder, graph-manipulator. Widgets to feature: `matrix`, `table`, `proof-blocks`, `match`, `odd-one-out`.
- **Try-first lessons:** u1.l3 (vector equations and span), u4.l1 (linear transformations), u5.l1 (eigenvectors), u6.l4 (least squares).
- **Mixed sets:** "Row-reduce, determinant or inverse?" (u1.l2, u2.l2, u2.l5); "Subspace, independent, spanning?" (u1.l6, u3.l1–l3).
- **Speed rounds:** 2×2 matrix products; 2×2 and 3×3 determinants; Dot products.

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
- **Interactives & practice:**
  - Explore: two lines with coefficient sliders — one, none or infinitely many intersections (l1); row-reducer, where the lines move as you apply row operations (l2); vector-play: reach targets with c₁v₁ + c₂v₂ (l3).
  - Challenges: row-reducer "reach RREF in ≤ 6 operations"; vector-play "reach the target", "make the zero vector with non-zero weights".
  - Puzzle packs: **RREF in Par**, **Span Reach**.
  - Widgets: `matrix`, `blanks` (parametric form), `categorize` (one / none / infinitely many solutions).

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
- **Interactives & practice:**
  - Explore: matrix-transform: compose two transformations in both orders and see AB ≠ BA (l1); the unit square's area becomes |det| (l6).
  - Challenges: row-reducer "compute A⁻¹ via [A | I]"; matrix-transform "find a matrix with det = −2 that maps the square onto the target", "undo this transformation".
  - Puzzle pack: **Shape Shifter**.
  - Widgets: `matrix`, `find-the-error` ((AB)⁻¹ = A⁻¹B⁻¹), `odd-one-out` (the singular matrix).

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
- **Interactives & practice:**
  - Explore: vector-play span mode: two vectors in ℝ² spanning a line or the plane (l1, l3); a coordinate grid that follows a new basis (l5).
  - Challenges: vector-play "pick a basis in which the target has coordinates (2, −1)"; row-reducer "find a basis for Nul A".
  - Widgets: `categorize` (subspace or not), `proof-blocks` (the subspace test), `matrix`.

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
- **Interactives & practice:**
  - Explore: matrix-transform with draggable basis vectors: the columns are where e₁ and e₂ land (l1–l2).
  - Challenges: matrix-transform "match the target shape", "compose two given matrices to get a 90° rotation"; `hotspot` "tap the transformations that are linear".
  - Puzzle pack: **Shape Shifter** (later levels).
  - Widgets: `match` (matrix ↔ transformation), `matrix`.

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
- **Interactives & practice:**
  - Explore: vector-play eigen mode: drag v around the circle and watch Av — when do they line up? (l1); a Markov-chain population with an "advance one year" button (l5).
  - Challenges: "find both eigen-directions"; "build a matrix with eigenvalues 2 and −1"; Markov "predict the long-run share, then run 50 years".
  - Puzzle pack: **Eigen Hunt**.
  - Widgets: `matrix`, `expression` (characteristic polynomial), `find-the-error`.

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
- **Interactives & practice:**
  - Explore: vector-play projection mode: drop the perpendicular (l2); drag data points and watch the least-squares line respond (l4).
  - Challenges: graph-manipulator "drag the line to minimise SSE, then compare with the exact fit"; vector-play "project b onto the line through a".
  - Widgets: `numeric`, `matrix`, `proof-blocks` (order the Gram–Schmidt steps).

---

### 16.6 Discrete Mathematics — `discrete`

**Prerequisites:** algebra.

- **Interactives:** truth-table, logic-gates, knights-knaves, venn-shader, graph-builder, algorithm-stepper (Euclid), probability-sim (enumerate mode), code-runner. Widgets to feature: `proof-blocks`, `table`, `tokens`, `find-the-error`, `categorize`.
- **Try-first lessons:** u2.l4 (induction), u4.l2 (permutations and combinations), u4.l4 (pigeonhole), u6.l3 (Euler paths).
- **Mixed sets:** "Which proof technique?" (u2.l1–l5); "Does order matter? Is repetition allowed?" (u4.l1–l2, u4.l6); "Which counting principle?" (u4.l1–l5).
- **Speed rounds:** Truth values; Modular arithmetic; Set operations.

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
- **Interactives & practice:**
  - Explore: a truth table that fills itself as you toggle p and q (l1–l2); logic-gates sandbox (l2).
  - Challenges: truth-table "build an expression matching this table using only ¬ and ∧"; logic-gates "build XOR from NAND gates"; knights-knaves puzzles (l5).
  - Puzzle packs: **Gate Puzzles**, **NAND Only**, **Island of Knights & Knaves**.
  - Widgets: `table`, `tokens` (build the negation), `find-the-error` (negating quantifiers).

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
- **Interactives & practice:**
  - Explore: induction as dominoes: knock over the first, set the "if k falls then k + 1 falls" rule, and watch (l4); knights-knaves as proof by contradiction (l2).
  - Challenges: `proof-blocks` "order the proof steps" with 2 distractor steps; `find-the-error` "spot the flaw in this induction proof (all horses are the same colour)".
  - Widgets: `proof-blocks`, `find-the-error`, `odd-one-out`.

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
- **Interactives & practice:**
  - Explore: venn-shader: type an expression and watch the shading (l1); arrow diagrams for functions, where injective and surjective badges update as you drag arrows (l2); graph-builder in directed mode for relations (l4).
  - Challenges: venn-shader "shade (A ∪ B) ∖ C"; graph-builder "build a relation that is reflexive and transitive but not symmetric"; "make this function a bijection by moving one arrow".
  - Widgets: `categorize` (relation properties), `match` (diagram ↔ property).

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
- **Interactives & practice:**
  - Explore: probability-sim enumerate mode: list every arrangement for small n and watch the count grow (l2); build Pascal's triangle (l3); pigeons into holes (l4).
  - Challenges: "predict the count, then enumerate small cases to check"; stars and bars: "place the bars to represent this distribution".
  - Widgets: `numeric`, `categorize` (permutation / combination), `find-the-error` (double counting).

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
- **Interactives & practice:**
  - Explore: a modular clock you can spin (l2); Euclid's algorithm as a rectangle cut into squares (l3).
  - Challenges: algorithm-stepper "fill the extended Euclid table"; code-runner "implement fast modular exponentiation"; "encrypt and decrypt with toy RSA keys".
  - Widgets: `table`, `numeric`, `code`.

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
- **Interactives & practice:**
  - Explore: graph-builder: degrees and the handshake sum update as you add edges (l1); try to walk the Königsberg bridges (l3); colour a map with as few colours as possible (l4).
  - Challenges: graph-builder "build a graph with an Euler circuit but no Hamilton cycle", "build a 7-vertex tree with 4 leaves", "2-colour this graph or show you can't".
  - Puzzle packs: **Draw It in One Stroke**, **Colour the Map**.
  - Widgets: `hotspot` (tap the odd-degree vertices), `numeric`.

---

### 16.7 Data Structures & Algorithms — `dsa`

**Prerequisites:** an introductory programming course (Python or JS); discrete helps.

- **Interactives:** algorithm-stepper, code-runner, memory-diagram, growth-race, graph-builder. Widgets to feature: `code`, `parsons`, `table`, `hotspot` (ordered), `match`.
- **Try-first lessons:** u1.l3 (recursion), u4.l1 (binary search, via "guess my number"), u6.l4 (Dijkstra's algorithm), u7.l3 (dynamic programming I).
- **Mixed sets:** "Which data structure?" (u2, u3, u5); "Which paradigm?" (u7.l1–l5: greedy, divide & conquer, DP, backtracking); "What's the complexity?" (u1.l1–l2, u4).
- **Speed rounds:** Big-O of snippets; Trace the stack and queue; Heap index arithmetic.

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
- **Interactives & practice:**
  - Explore: "guess my number" to discover halving (l1); growth-race: slide n and watch n², n log n and 2ⁿ race (l1–l2); a call-stack view of a recursive function (l3).
  - Challenges: growth-race "match each code snippet to its growth curve", "find the n where the n log n algorithm overtakes the n² one"; `parsons` for a recursive function.
  - Puzzle pack: unit kata pack (code-runner).
  - Widgets: `match` (snippet ↔ complexity), `parsons`, `table` (recursion trace).

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
- **Interactives & practice:**
  - Explore: memory-diagram: insert into a linked list by re-pointing arrows (l2); stack and queue machines with push and pop buttons (l3–l4); two-pointer and sliding-window animations (l5–l6).
  - Challenges: memory-diagram "reverse this list without losing a node"; algorithm-stepper "process the brackets on the stack"; code-runner "two-sum on a sorted array", "longest substring without repeats".
  - Puzzle packs: **Pointer Surgery**, unit kata pack.
  - Widgets: `code`, `parsons`, `hotspot` (tap where the pointer moves next).

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
- **Interactives & practice:**
  - Explore: a hash table with a load-factor meter: insert keys and watch collisions and probing (l1–l3).
  - Challenges: algorithm-stepper "linear-probing inserts"; code-runner "group anagrams"; "choose a table size that keeps average probes ≤ 2".
  - Widgets: `table`, `code`, `categorize` (good vs bad hash-function properties).

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
- **Interactives & practice:**
  - Explore: a binary-search window with a draggable middle pointer (l1); sorting races on the same array (l2–l4); a heap shown as array and tree side by side (l5).
  - Challenges: algorithm-stepper "perform the partition", "perform the merge", "sift down"; code-runner "first bad version", "k-th largest element".
  - Puzzle packs: **Sort Sprint**, **Heap Hero**.
  - Widgets: `order` (predict the array after one pass), `code`, `find-the-error` (off-by-one).

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
- **Interactives & practice:**
  - Explore: BST insertion with a live height counter (l2); AVL rotations triggered by tapping (l3); trie autocomplete (l5).
  - Challenges: algorithm-stepper "insert and delete in a BST", "identify the AVL rotation"; ordered `hotspot` "tap the nodes in in-order"; code-runner "validate a BST", "lowest common ancestor".
  - Widgets: `hotspot` (ordered), `code`, memory-diagram (re-link after deletion).

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
- **Interactives & practice:**
  - Explore: graph-builder switching between adjacency-list and matrix views (l1); BFS wavefront vs DFS dive on the same graph (l2–l3); Dijkstra with a live distance table (l4).
  - Challenges: algorithm-stepper "BFS order", "fill the Dijkstra table", "pick Kruskal's next edge"; code-runner "number of islands", "course schedule".
  - Puzzle pack: **Shortest Path Race**.
  - Widgets: ordered `hotspot`, `table`, `code`.

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
- **Interactives & practice:**
  - Explore: greedy vs optimal coin change with editable coin sets (l1); a DP table filling with arrows to its subproblems (l3–l4); a backtracking tree that prunes as you place queens (l5).
  - Challenges: "find a coin set where greedy fails"; algorithm-stepper "fill the DP table cell by cell"; code-runner "coin change", "LCS", "climbing stairs" with performance tests.
  - Puzzle pack: unit kata pack (code-runner).
  - Widgets: `table`, `code`, `find-the-error` (a greedy counterexample).

---

### 16.8 Probability & Statistics — `probstat`

**Prerequisites:** calc1 (calc2 helpful for continuous distributions).

- **Interactives:** probability-sim, distribution-fitter, bayes-grid, venn-shader, graph-manipulator. Widgets to feature: `estimate`, `numeric`, `match`, `categorize`, `find-the-error`.
- **Try-first lessons:** u1.l5 (Bayes' theorem), u3.l5 (central limit theorem), u4.l3 (confidence intervals), u4.l4 (hypothesis testing).
- **Mixed sets:** "Which distribution?" (u2.l3–l7); "Conditional, independent or mutually exclusive?" (u1.l3–l4); "Which test or interval?" (u4.l3–l5).
- **Speed rounds:** z-scores; Basic probability rules; Expected value quick-fire.

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
- **Interactives & practice:**
  - Explore: probability-sim: flip and roll 1, 100 and 10,000 times and watch frequencies settle (l1); venn-shader probability mode (l3–l4); bayes-grid for a medical test (l5).
  - Challenges: "Monty Hall: predict, then simulate"; "birthday problem: find the group size for P > 0.5"; bayes-grid "estimate P(sick | positive) by counting".
  - Puzzle pack: **Beat the Casino**.
  - Widgets: `estimate` (gut-feel probabilities), `categorize` (independent / mutually exclusive / neither), `numeric` (fractions).

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
- **Interactives & practice:**
  - Explore: distribution-fitter: move n and p and watch the binomial change shape (l3); Poisson as a limit of binomials (l4); shade normal-curve areas by dragging z (l7).
  - Challenges: distribution-fitter "set p so the binomial matches the histogram", "set λ so P(X > 3) = 0.2"; probability-sim "design a dice game with expected value 0".
  - Puzzle pack: **Shape Match**.
  - Widgets: `match` (scenario ↔ distribution), `numeric`, `find-the-error` (Var(aX)).

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
- **Interactives & practice:**
  - Explore: a scatter plot with a correlation slider (l2); sample-mean histograms turning bell-shaped as n grows (l5).
  - Challenges: probability-sim "choose n so the SD of the sample mean is below 0.1"; `graph-point` "make a dataset with correlation 0 but clear dependence".
  - Widgets: `graph-point`, `categorize` (correlated / independent / both), `sketch` (sampling distribution).

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
- **Interactives & practice:**
  - Explore: probability-sim confidence-interval coverage: generate 100 intervals and count the hits (l3); the p-value as a tail you drag (l4); drag a regression line and watch the residuals (l6).
  - Challenges: "simulate 100 intervals; predict how many contain μ"; graph-manipulator "fit the line by dragging, then compare with least squares"; "choose the sample size for a ±3% margin".
  - Widgets: `find-the-error` (p-value interpretation), `categorize` (claim supported / not), `numeric`.

---

## 17. Final acceptance checklist

**Platform**
- [ ] Deployed on GitHub Pages from `main` by GitHub Actions; deep links and refreshes work.
- [ ] All 8 subjects and every unit and lesson in §16 are browsable on path maps; unfinished lessons show "Coming soon".
- [ ] Initial JS ≤ 250 KB gzipped; widgets, interactives, Pyodide and three.js lazy-load; interactives run at 60 fps on a mid-range phone.
- [ ] Keyboard-only play-through of a full lesson is possible, including every drag-and-drop widget; contrast meets AA; reduced motion respected.

**Lessons**
- [ ] The reference lesson (§7.8) is implemented exactly and passes the validator with zero errors.
- [ ] phys2 U3 is complete (8 lessons, each with practice pool, plus its puzzle packs) — the MVP.
- [ ] Every lesson follows the anatomy in §2.2: hook → explore → name it → linked chain → 2 challenges → recap; ≥ 75% of screens ask for action; ≥ 5 widget kinds; MCQ ≤ 35%.
- [ ] Predictions are committed before every reveal; try-first lessons never mark the attempt.
- [ ] Facts panel, Explanations tab, hint ladder, interpretive feedback, "↩ builds on" chips, remediation and bonus insertion all work.
- [ ] Adaptive variant selection targets ~78% success; ratings update; difficulty rises across units.

**Practice**
- [ ] Every completed lesson offers a practice set with fresh numbers and no scaffolds.
- [ ] Daily practice follows the composition rules in §3.5 and is driven by the memory model in §3.3.
- [ ] Mistakes review, mixed "choose the method" sets, unit checkpoints (with test-out), speed rounds and hard mode all work.
- [ ] Every puzzle pack named for a shipped unit exists, with stars and par; the sandbox and share-link challenges work, and malformed links are rejected safely.
- [ ] XP, daily goal, streak and streak charges follow §3.7; there are no lives, penalties or leaderboards.

**Quality**
- [ ] Progress persists, resumes mid-lesson, and exports/imports.
- [ ] `content:check`, unit tests and the e2e smoke tests all pass in CI.
- [ ] `DECISIONS.md` lists every judgement call made during the build.
