import type { QuestionKind } from '../content/schema';
import type { WidgetModel } from './types';

/**
 * React-free models for every question widget, keyed by kind (§9.2). Used by the validator, the
 * practice engine and tests; the UI loads views through `registry.ts`. Kinds without a model yet
 * fail validation, so content can only use widgets that exist (§13.2).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const widgetModels: Partial<Record<QuestionKind, WidgetModel<any, any>>> = {};
