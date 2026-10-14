import { z } from 'zod';

/** Zod schemas for every content file (§7). Shared by the validator, the build and the app. */

const id = z.string().min(1);
const md = z.string();
const difficulty = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

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

export const HintsSchema = z.strictObject({
  nudge: z.string().min(1),
  buildsOn: z.string().optional(),
  partial: z.string().min(1),
});

export const NumericOptionSchema = z.strictObject({
  expr: z.string().min(1),
  unit: z.string().optional(),
  sig: z.number().int().min(1).max(10).optional(),
});

export const QuestionSchema = z.strictObject({
  id,
  version: z.number().int().min(1).optional(),
  difficulty,
  prompt: md,
  answer: NumericOptionSchema.optional(),
  distractors: z.array(NumericOptionSchema.extend({ misconception: id })).optional(),
  options: z
    .array(
      z.strictObject({
        text: z.string().min(1),
        correct: z.literal(true).optional(),
        misconception: id.optional(),
      }),
    )
    .optional(),
  fixedOrder: z.boolean().optional(),
  verify: z
    .array(
      z.strictObject({
        lhs: z.string().min(1),
        rhs: z.string().min(1),
        vars: z.record(z.string(), z.tuple([z.number(), z.number()])).optional(),
      }),
    )
    .optional(),
  hints: HintsSchema,
  explanation: md,
});

export const StepSchema = z.strictObject({
  id,
  role: z.enum(['core', 'remediation', 'bonus']),
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
  difficulty,
  goal: z.string().min(1),
  config: z.unknown(),
  check: z.strictObject({ expr: z.string().min(1) }),
  feedback: z.array(FeedbackRuleSchema).optional(),
  hints: HintsSchema,
  solution: z.unknown(),
  explanation: md,
});

export const ChallengeSchema = z.strictObject({
  id,
  type: id,
  title: z.string().min(1),
  concept: id,
  uses: z.array(id).optional(),
  params: ParamSpecSchema.optional(),
  derived: z.record(z.string(), z.string()).optional(),
  variants: z.strictObject({
    easier: ChallengeVariantSchema,
    standard: ChallengeVariantSchema,
    harder: ChallengeVariantSchema,
  }),
});

export const LessonSchema = z.strictObject({
  id,
  title: z.string().min(1),
  version: z.number().int().min(1),
  concepts: z.array(id).min(1),
  estimatedMinutes: z.number().positive(),
  params: ParamSpecSchema.optional(),
  derived: z.record(z.string(), z.string()).optional(),
  intro: md,
  workedExample: md,
  chain: z.array(StepSchema).min(1),
  challenge: ChallengeSchema,
  summary: z.strictObject({
    keyTakeaways: z.array(z.string().min(1)).min(1),
    next: id.optional(),
  }),
});

export const SubjectLessonRefSchema = z.strictObject({
  id,
  title: z.string().min(1),
  concepts: z.array(id).min(1),
  prerequisites: z.array(id).optional(),
});

export const UnitSchema = z.strictObject({
  id,
  title: z.string().min(1),
  baseDifficulty: z.number().int().min(2).max(4),
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

export const ConceptsSchema = z.array(z.strictObject({ id, title: z.string().min(1) }));

export const MisconceptionsSchema = z.array(
  z.strictObject({
    id,
    short: z.string().min(1),
    explain: z.string().min(1),
    lessons: z.array(id).default([]),
  }),
);

export type Lesson = z.infer<typeof LessonSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Hints = z.infer<typeof HintsSchema>;
export type NumericOption = z.infer<typeof NumericOptionSchema>;
export type Challenge = z.infer<typeof ChallengeSchema>;
export type ChallengeVariant = z.infer<typeof ChallengeVariantSchema>;
export type FeedbackRule = z.infer<typeof FeedbackRuleSchema>;
export type Subject = z.infer<typeof SubjectSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type Concept = z.infer<typeof ConceptsSchema>[number];
export type Misconception = z.infer<typeof MisconceptionsSchema>[number];
