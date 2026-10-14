import { z } from 'zod';

/**
 * Zod schemas for every content file (§7). Shared by the validator, the build and the app.
 * Kind-specific question fields and interactive configs are validated by the widget's or
 * interactive's own `model.ts` schema (§9.1, §9.3); here they pass through.
 */

const id = z.string().min(1);
const md = z.string();
export const DifficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const ParamSpecSchema = z.union([
  z.strictObject({ sets: z.array(z.record(z.string(), z.number())).min(1) }),
  z.strictObject({
    vars: z.record(
      z.string(),
      z.union([
        z.strictObject({ values: z.array(z.number()).min(1) }),
        z.strictObject({ min: z.number(), max: z.number(), step: z.number().positive() }),
      ]),
    ),
  }),
]);
const DerivedSchema = z.record(z.string(), z.string());

export const HintsSchema = z.strictObject({
  nudge: z.string().min(1),
  buildsOn: z.string().optional(),
  partial: z.string().min(1),
});

export const QUESTION_KINDS = [
  'mcq',
  'multi',
  'odd-one-out',
  'hotspot',
  'numeric',
  'expression',
  'blanks',
  'table',
  'matrix',
  'estimate',
  'order',
  'categorize',
  'match',
  'tokens',
  'parsons',
  'proof-blocks',
  'graph-point',
  'sketch',
  'find-the-error',
  'explain',
  'code',
  'interactive',
] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

/** Kinds that make the learner produce an answer rather than pick one (§2.2). */
export const GENERATIVE_KINDS: QuestionKind[] = [
  'numeric',
  'expression',
  'blanks',
  'table',
  'matrix',
  'tokens',
  'graph-point',
  'sketch',
  'code',
];

export const VerifyRuleSchema = z.union([
  z.strictObject({ expr: z.string().min(1) }),
  z.strictObject({
    lhs: z.string().min(1),
    rhs: z.string().min(1),
    vars: z.record(z.string(), z.tuple([z.number(), z.number()])).optional(),
  }),
]);

/** Common question fields; the widget model validates the rest (options, answer, cards, …). */
export const QuestionSchema = z.looseObject({
  id,
  version: z.number().int().min(1).optional(),
  kind: z.enum(QUESTION_KINDS),
  difficulty: DifficultySchema,
  prompt: md,
  graded: z.boolean().optional(),
  fixedOrder: z.boolean().optional(),
  verify: z.array(VerifyRuleSchema).optional(),
  hints: HintsSchema.optional(),
  explanation: md.optional(),
});

export const InteractiveRefSchema = z.strictObject({
  type: id,
  mode: z.enum(['view', 'explore']).optional(),
  config: z.unknown(),
});

export const TaskSchema = z.union([
  z.strictObject({
    goal: z.string().min(1),
    check: z.strictObject({ expr: z.string().min(1) }),
    hint: z.string().optional(),
    solution: z.unknown(),
  }),
  z.strictObject({ predict: QuestionSchema }),
  z.strictObject({ ask: QuestionSchema }),
]);

export const StepSchema = z.strictObject({
  id,
  role: z.enum(['core', 'check', 'remediation', 'bonus']),
  concept: id,
  uses: z.array(id).optional(),
  clueFor: z.array(id).optional(),
  remediates: id.optional(),
  establishes: z.string().optional(),
  standaloneContext: z.string().optional(),
  variants: z.strictObject({
    easier: QuestionSchema.optional(),
    standard: QuestionSchema,
    harder: QuestionSchema.optional(),
  }),
});

export const FeedbackRuleSchema = z.strictObject({
  if: z.string().min(1),
  say: z.string().min(1),
  misconception: id.optional(),
});

export const ChallengeVariantSchema = z.strictObject({
  difficulty: DifficultySchema,
  goal: z.string().min(1),
  question: QuestionSchema.optional(),
  config: z.unknown(),
  check: z.strictObject({ expr: z.string().min(1) }).optional(),
  feedback: z.array(FeedbackRuleSchema).optional(),
  hints: HintsSchema,
  solution: z.unknown(),
  par: z.record(z.string(), z.number()).optional(),
  explanation: md,
});

export const ChallengeSchema = z.strictObject({
  id,
  title: z.string().min(1),
  concept: id,
  interactive: id.optional(),
  uses: z.array(id).optional(),
  params: ParamSpecSchema.optional(),
  derived: DerivedSchema.optional(),
  variants: z.strictObject({
    easier: ChallengeVariantSchema,
    standard: ChallengeVariantSchema,
    harder: ChallengeVariantSchema,
  }),
});

export const HookScreenSchema = z.strictObject({
  id,
  type: z.literal('hook'),
  prompt: md,
  predict: QuestionSchema,
  reveal: z
    .strictObject({
      instruction: z.string().optional(),
      interactive: InteractiveRefSchema,
      tasks: z.array(TaskSchema).optional(),
      caption: md,
    })
    .optional(),
  compare: z
    .strictObject({
      attempts: z
        .array(z.strictObject({ label: z.string().min(1), work: md, verdict: md }))
        .min(2)
        .max(3),
      canonical: md,
    })
    .optional(),
});

export const ExploreScreenSchema = z.strictObject({
  id,
  type: z.literal('explore'),
  intro: md,
  interactive: InteractiveRefSchema,
  tasks: z.array(TaskSchema).min(1),
  takeaway: z.string().min(1),
});

export const ConceptScreenSchema = z.strictObject({
  id,
  type: z.literal('concept'),
  body: md,
  visual: InteractiveRefSchema.optional(),
});

export const WorkedScreenSchema = z.strictObject({
  id,
  type: z.literal('worked'),
  concept: id,
  problem: md,
  steps: z.array(z.strictObject({ text: md })).min(1),
  fade: z.enum(['none', 'adaptive']),
});

export const QuestionScreenSchema = StepSchema.extend({ type: z.literal('question') });
export const ChallengeScreenSchema = ChallengeSchema.extend({ type: z.literal('challenge') });

export const RecapScreenSchema = z.strictObject({
  id,
  type: z.literal('recap'),
  takeaways: z.array(z.string().min(1)).min(1),
  explain: z
    .strictObject({ prompt: z.string().min(1), expert: md, checklist: z.array(z.string().min(1)).min(1) })
    .optional(),
  next: id.optional(),
});

export const ScreenSchema = z.discriminatedUnion('type', [
  HookScreenSchema,
  ExploreScreenSchema,
  ConceptScreenSchema,
  WorkedScreenSchema,
  QuestionScreenSchema,
  ChallengeScreenSchema,
  RecapScreenSchema,
]);

/** A practice-pool item: a standalone question with its own params (§7.7). */
export const PracticeItemSchema = QuestionSchema.extend({
  concept: id,
  params: ParamSpecSchema.optional(),
  derived: DerivedSchema.optional(),
  method: z.string().optional(),
});

export const LessonSchema = z.strictObject({
  id,
  title: z.string().min(1),
  version: z.number().int().min(1),
  concepts: z.array(id).min(1),
  estimatedMinutes: z.number().positive(),
  params: ParamSpecSchema.optional(),
  derived: DerivedSchema.optional(),
  screens: z.array(ScreenSchema).min(1),
  extras: z.array(StepSchema).optional(),
  practice: z.array(PracticeItemSchema),
});

export const SubjectLessonRefSchema = z.strictObject({
  id,
  title: z.string().min(1),
  concepts: z.array(id).min(1),
  prerequisites: z.array(id).optional(),
  tryFirst: z.boolean().optional(),
});

export const UnitSchema = z.strictObject({
  id,
  title: z.string().min(1),
  baseDifficulty: z.number().int().min(2).max(4),
  checkpoint: z.strictObject({ items: z.number().int().min(12).max(15) }).optional(),
  lessons: z.array(SubjectLessonRefSchema).min(1),
});

export const SubjectSchema = z.strictObject({
  id,
  title: z.string().min(1),
  short: z.string().min(1),
  description: z.string().min(1),
  prerequisites: z.array(id).default([]),
  background: z.string().optional(),
  tools: z.array(id).optional(),
  units: z.array(UnitSchema).min(1),
});

export const SubjectsListSchema = z.array(id).min(1);

export const ConceptsSchema = z.array(
  z.strictObject({ id, title: z.string().min(1), requires: z.array(id).optional() }),
);

export const MisconceptionsSchema = z.array(
  z.strictObject({
    id,
    short: z.string().min(1),
    explain: z.string().min(1),
    lessons: z.array(id).default([]),
  }),
);

export const MixedSetSchema = z.strictObject({
  id,
  title: z.string().min(1),
  lessons: z.array(id).min(2),
  methods: z.array(z.string().min(1)).min(2),
  items: z.number().int().min(1),
});

export const SpeedItemSchema = z.looseObject({
  id,
  kind: z.enum(['numeric', 'expression', 'mcq']),
  prompt: md,
  params: ParamSpecSchema.optional(),
  derived: DerivedSchema.optional(),
});

export const SpeedRoundSchema = z.strictObject({
  id,
  title: z.string().min(1),
  unlockAfter: id,
  durationSec: z.number().int().min(30).max(180),
  concept: id,
  items: z.array(SpeedItemSchema).min(3),
});

export const PuzzleLevelSchema = ChallengeVariantSchema.extend({
  id,
  title: z.string().min(1),
  params: ParamSpecSchema.optional(),
  derived: DerivedSchema.optional(),
});

export const PuzzlePackSchema = z.strictObject({
  id,
  title: z.string().min(1),
  interactive: id,
  unlockAfter: id,
  levels: z.array(PuzzleLevelSchema).min(10).max(20),
});

export type ParamSpec = z.infer<typeof ParamSpecSchema>;
export type Hints = z.infer<typeof HintsSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type VerifyRule = z.infer<typeof VerifyRuleSchema>;
export type InteractiveRef = z.infer<typeof InteractiveRefSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Step = z.infer<typeof StepSchema>;
export type FeedbackRule = z.infer<typeof FeedbackRuleSchema>;
export type ChallengeVariant = z.infer<typeof ChallengeVariantSchema>;
export type Challenge = z.infer<typeof ChallengeSchema>;
export type HookScreen = z.infer<typeof HookScreenSchema>;
export type ExploreScreen = z.infer<typeof ExploreScreenSchema>;
export type ConceptScreen = z.infer<typeof ConceptScreenSchema>;
export type WorkedScreen = z.infer<typeof WorkedScreenSchema>;
export type QuestionScreen = z.infer<typeof QuestionScreenSchema>;
export type ChallengeScreen = z.infer<typeof ChallengeScreenSchema>;
export type RecapScreen = z.infer<typeof RecapScreenSchema>;
export type Screen = z.infer<typeof ScreenSchema>;
export type PracticeItem = z.infer<typeof PracticeItemSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type Subject = z.infer<typeof SubjectSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type Concept = z.infer<typeof ConceptsSchema>[number];
export type Misconception = z.infer<typeof MisconceptionsSchema>[number];
export type MixedSet = z.infer<typeof MixedSetSchema>;
export type SpeedRound = z.infer<typeof SpeedRoundSchema>;
export type PuzzleLevel = z.infer<typeof PuzzleLevelSchema>;
export type PuzzlePack = z.infer<typeof PuzzlePackSchema>;
