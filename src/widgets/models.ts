import type { QuestionKind } from '../content/schema';
import { blanksModel } from './blanks/model';
import { categorizeModel } from './categorize/model';
import { estimateModel } from './estimate/model';
import { explainModel } from './explain/model';
import { expressionModel } from './expression/model';
import { findTheErrorModel } from './find-the-error/model';
import { hotspotModel } from './hotspot/model';
import { matchModel } from './match/model';
import { mcqModel } from './mcq/model';
import { multiModel } from './multi/model';
import { numericModel } from './numeric/model';
import { oddOneOutModel } from './odd-one-out/model';
import { orderModel } from './order/model';
import type { WidgetModel } from './types';

/**
 * React-free models for every question widget, keyed by kind (§9.2). Used by the validator, the
 * practice engine and tests; the UI loads views through `registry.ts`. Kinds without a model yet
 * fail validation, so content can only use widgets that exist (§13.2).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const widgetModels: Partial<Record<QuestionKind, WidgetModel<any, any>>> = {
  mcq: mcqModel,
  multi: multiModel,
  numeric: numericModel,
  expression: expressionModel,
  blanks: blanksModel,
  order: orderModel,
  categorize: categorizeModel,
  match: matchModel,
  estimate: estimateModel,
  explain: explainModel,
  hotspot: hotspotModel,
  'find-the-error': findTheErrorModel,
  'odd-one-out': oddOneOutModel,
};
