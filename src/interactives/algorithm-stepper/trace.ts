/** Shared trace model for the algorithm stepper. */

export type Tone = 'active' | 'done' | 'muted' | 'found' | 'new';

export interface ArrayView {
  label?: string;
  values: (number | string | null)[];
  /** Index labels under the cells (default 0, 1, 2, …). */
  indexLabels?: (string | number)[];
  tones?: Record<number, Tone>;
  pointers?: Record<string, number>;
  /** Cells the student can click; ids are `cell:<i>`. */
  clickable?: number[];
}

export interface ListView {
  nodes: { id: number; value: number | string; next: number | null }[];
  pointers?: Record<string, number | null>;
  /** Node ids the student can click; ids are `node:<id>`. */
  clickable?: number[];
}

export interface View {
  array?: ArrayView;
  list?: ListView;
  stack?: { label: string; items: (number | string)[] };
  input?: { text: string; index: number };
  vars?: Record<string, string | number>;
  note?: string;
}

export interface TraceStep {
  view: View;
  prompt: string;
  /** Extra action buttons; ids are free-form. */
  actions?: { id: string; label: string }[];
  correct: string;
  /** Explanation shown for a wrong choice. */
  wrong(id: string): string;
  /** Shown after the correct choice. */
  after?: string;
}

export interface Trace {
  steps: TraceStep[];
  final: View;
  summary: string;
}

export const cell = (i: number) => `cell:${i}`;
export const node = (id: number) => `node:${id}`;
export const parseCell = (id: string) => (id.startsWith('cell:') ? Number(id.slice(5)) : null);
export const parseNode = (id: string) => (id.startsWith('node:') ? Number(id.slice(5)) : null);
