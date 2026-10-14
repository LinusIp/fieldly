import { z } from 'zod';

/** Stored progress (§12). Zod-validated on load and on import. */

const variantKey = z.enum(['easier', 'standard', 'harder']);

export const AttemptStateSchema = z.object({
  seed: z.number(),
  stage: z.enum(['intro', 'practice', 'challenge', 'summary']),
  stepIndex: z.number().int().min(0),
  chosenVariants: z.record(z.string(), variantKey),
  insertedSteps: z.array(z.string()),
  answers: z.record(
    z.string(),
    z.object({
      selected: z.array(z.number().int()),
      hintsUsed: z.number().int().min(0),
      score: z.number().optional(),
    }),
  ),
  facts: z.array(z.string()),
  challenge: z
    .object({
      variant: z.string(),
      state: z.unknown(),
      hintsUsed: z.number().int().min(0),
      checks: z.number().int().min(0),
      solved: z.boolean(),
      usedSolution: z.boolean().optional(),
      seed: z.number().optional(),
      score: z.number().optional(),
    })
    .optional(),
  // Additions beyond §12 (see DECISIONS.md):
  /** Ordered step ids: core steps plus inserted remediation/bonus steps at their positions. */
  sequence: z.array(z.string()),
  /** Ids of steps whose `establishes` fact was already pushed. */
  factSteps: z.array(z.string()).default([]),
  firstInSubject: z.boolean().default(false),
  ratingsBefore: z.record(z.string(), z.number()).default({}),
  lessonVersion: z.number().int().default(1),
  /** Bonus step offered and declined. */
  skippedSteps: z.array(z.string()).default([]),
  startedAt: z.string(),
});

export const SettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  fontScale: z.number().min(0.75).max(1.5),
  reducedMotion: z.boolean(),
  codeLang: z.enum(['python', 'javascript']),
});

export const LessonProgressSchema = z.object({
  status: z.enum(['not-started', 'in-progress', 'completed']),
  bestScore: z.number().min(0).max(1),
  stars: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  completedAt: z.string().optional(),
  attempt: AttemptStateSchema.optional(),
  lastOpenedAt: z.string().optional(),
});

export const ProgressV1Schema = z.object({
  version: z.literal(1),
  createdAt: z.string(),
  ratings: z.object({
    subject: z.record(z.string(), z.number()),
    concept: z.record(z.string(), z.object({ r: z.number(), n: z.number().int().min(0) })),
  }),
  lessons: z.record(z.string(), LessonProgressSchema),
  questions: z.record(
    z.string(),
    z.object({ lastScore: z.number(), attempts: z.number().int().min(0), version: z.number().int() }),
  ),
  misconceptions: z.record(z.string(), z.object({ count: z.number().int().min(0), lastSeen: z.string() })),
  review: z.record(
    z.string(),
    z.object({
      box: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
      due: z.string(),
    }),
  ),
  settings: SettingsSchema,
  /** Additions: answers per local day (for the streak) and totals. */
  activity: z.record(z.string(), z.number().int().min(0)).default({}),
});

export type AttemptState = z.infer<typeof AttemptStateSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type LessonProgress = z.infer<typeof LessonProgressSchema>;
export type ProgressV1 = z.infer<typeof ProgressV1Schema>;
export type Progress = ProgressV1;
