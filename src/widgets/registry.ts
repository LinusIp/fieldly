import type { FC } from 'react';
import type { QuestionKind } from '../content/schema';
import { BlanksView } from './blanks/view';
import { CategorizeView } from './categorize/view';
import { EstimateView } from './estimate/view';
import { ExplainView } from './explain/view';
import { ExpressionView } from './expression/view';
import { FindTheErrorView } from './find-the-error/view';
import { HotspotView } from './hotspot/view';
import { MatchView } from './match/view';
import { McqView } from './mcq/view';
import { widgetModels } from './models';
import { MultiView } from './multi/view';
import { NumericView } from './numeric/view';
import { OddOneOutView } from './odd-one-out/view';
import { OrderView } from './order/view';
import type { WidgetModule, WidgetViewProps } from './types';

/** Views for every widget with a model (§9.1). The player looks widgets up here by kind. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const views: Partial<Record<QuestionKind, FC<WidgetViewProps<any, any>>>> = {
  mcq: McqView,
  multi: MultiView,
  numeric: NumericView,
  expression: ExpressionView,
  blanks: BlanksView,
  order: OrderView,
  categorize: CategorizeView,
  match: MatchView,
  estimate: EstimateView,
  explain: ExplainView,
  hotspot: HotspotView,
  'find-the-error': FindTheErrorView,
  'odd-one-out': OddOneOutView,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function widgetFor(kind: QuestionKind): WidgetModule<any, any> | undefined {
  const model = widgetModels[kind];
  const View = views[kind];
  return model && View ? { ...model, View } : undefined;
}
