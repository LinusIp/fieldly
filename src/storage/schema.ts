import { z } from 'zod';

/**
 * Stored progress (§12). Zod-validated on load and on import. The spec calls this shape
 * `ProgressV1`; it is stored as version 2 here because version 1 was the pre-v2 shape (migrated).
 */

const variantKey = z.enum(['easier', 'standard', 'harder']);
const iso = z.string();

export const AnswerRecordSchema = z.object({
  answer: z.unknown(),
  /** Highest hint tier opened (0–3). */
  hintsUsed: z.number().int().min(0),
  attempts: z.number().int().min(0),
  score: z.number().optional(),
  correct: z.boolean().optional(),
  misconception: z.string().optional(),
  /** Variant served, for core steps. */
  variant: variantKey.optional(),
  /** Confidence prompt (§2.5), when turned on in Settings. */
  confidence: z.enum(['sure', 'unsure']).optional(),
});

export const AttemptStateSchema = z.object({
  lessonVersion: z.number().int(),
  seed: z.number(),
  screenIndex: z.number().int().min(0),
  chosenVariants: z.record(z.string(), variantKey),
  insertedSteps: z.array(z.string()),
  answers: z.record(z.string(), AnswerRecordSchema),
  explore: z.record(
    z.string(),
    z.object({ taskIndex: z.number().int().min(0), state: z.unknown(), done: z.boolean().optional() }),
  ),
  challenges: z.record(
    z.string(),
    z.object({
      variant: z.string(),
      state: z.unknown(),
      hintsUsed: z.number().int().min(0),
      checks: z.number().int().min(0),
      solved: z.boolean(),
      usedSolution: z.boolean().optional(),
      score: z.number().optional(),
      feedback: z.string().optional(),
    }),
  ),
  facts: z.array(z.string()),
  // Additions beyond §12 (DECISIONS.md):
  /** Screen and step ids in play order, including inserted remediation/bonus steps. */
  sequence: z.array(z.string()),
  /** Bonus steps offered and skipped. */
  skipped: z.array(z.string()).default([]),
  firstInSubject: z.boolean().default(false),
  startedAt: iso,
});

export const SettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  fontScale: z.number().min(0.75).max(1.5),
  reducedMotion: z.boolean(),
  dailyGoal: z.union([z.literal(50), z.literal(100), z.literal(200)]),
  confidencePrompts: z.boolean(),
  codeLang: z.enum(['python', 'javascript']),
});

export const LessonProgressSchema = z.object({
  status: z.enum(['not-started', 'in-progress', 'completed', 'tested-out']),
  bestScore: z.number().min(0).max(1),
  stars: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  practised: z.boolean().default(false),
  completedAt: iso.optional(),
  attempt: AttemptStateSchema.optional(),
  lastOpenedAt: iso.optional(),
});

export const ConceptRatingSchema = z.object({
  r: z.number(),
  n: z.number().int().min(0),
  recent: z.array(z.object({ itemId: z.string(), score: z.number() })).default([]),
  ratingAtLessonStart: z.record(z.string(), z.number()).optional(),
});

export const ProgressSchema = z.object({
  version: z.literal(2),
  createdAt: iso,
  ratings: z.object({
    subject: z.record(z.string(), z.number()),
    concept: z.record(z.string(), ConceptRatingSchema),
  }),
  memory: z.record(
    z.string(),
    z.object({
      h: z.number().positive(),
      last: iso,
      dueOverride: z.boolean().optional(),
      freshNext: z.boolean().optional(),
    }),
  ),
  mastery: z.record(
    z.string(),
    z.object({ level: z.enum(['practised', 'proficient', 'mastered']), proficientAt: iso.optional() }),
  ),
  lessons: z.record(z.string(), LessonProgressSchema),
  units: z.record(
    z.string(),
    z.object({
      checkpointBest: z.number().optional(),
      mastered: z.boolean(),
      hardModeDone: z.boolean().optional(),
    }),
  ),
  items: z.record(
    z.string(),
    z.object({
      lastScore: z.number(),
      attempts: z.number().int().min(0),
      lastAt: iso,
      version: z.number().int(),
    }),
  ),
  mistakes: z.record(z.string(), z.object({ firstAt: iso, correctDays: z.array(z.string()) })),
  misconceptions: z.record(z.string(), z.object({ count: z.number().int().min(0), lastSeen: iso })),
  puzzles: z.record(
    z.string(),
    z.object({
      stars: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
      bestPar: z.record(z.string(), z.number()).optional(),
      solvedAt: iso.optional(),
    }),
  ),
  sandbox: z.record(z.string(), z.array(z.object({ name: z.string(), scene: z.unknown(), savedAt: iso }))),
  speed: z.record(z.string(), z.object({ best: z.number(), lastAt: iso })),
  xp: z.object({ total: z.number().min(0), byDay: z.record(z.string(), z.number()) }),
  streak: z.object({
    current: z.number().int().min(0),
    longest: z.number().int().min(0),
    lastDay: z.string(),
    charges: z.number().int().min(0).max(2),
  }),
  settings: SettingsSchema,
});

export type AnswerRecord = z.infer<typeof AnswerRecordSchema>;
export type AttemptState = z.infer<typeof AttemptStateSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type LessonProgress = z.infer<typeof LessonProgressSchema>;
export type ConceptRatingEntry = z.infer<typeof ConceptRatingSchema>;
export type Progress = z.infer<typeof ProgressSchema>;
