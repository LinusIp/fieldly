import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useMemo, type ReactNode } from 'react';
import type { Scope } from '../../engine/expr';
import { hashString, seededOrder } from '../common';
import type { WidgetViewProps } from '../types';
import { Mark, Tx } from '../ui';
import type { CategorizeAnswer, CategorizeQuestion } from './model';

const POOL = '__pool__';

function Bucket({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={`min-h-[96px] rounded-xl border-2 border-dashed p-2 ${isOver ? 'border-primary bg-surface-tint' : 'border-outline bg-surface-sunk'}`}
      data-bucket={id}
    >
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function Card({
  i,
  text,
  scope,
  bucket,
  buckets,
  disabled,
  mark,
  place,
}: {
  i: number;
  text: string;
  scope: Scope;
  bucket: string | null;
  buckets: string[];
  disabled: boolean;
  mark?: boolean;
  place(b: string | null): void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `card-${i}`,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`flex items-center gap-1 rounded-lg border-2 bg-surface px-2 py-1 text-sm ${mark === undefined ? 'border-outline' : mark ? 'border-correct' : 'border-wrong'} ${isDragging ? 'z-10 shadow-lg' : ''}`}
      data-card={i}
    >
      <button
        type="button"
        className={`min-h-[44px] px-1 text-ink-2 ${disabled ? '' : 'cursor-grab'}`}
        aria-label="Drag card. Space to pick up, arrows to move, Space to drop."
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span>
        <Tx s={text} scope={scope} />
      </span>
      {mark !== undefined && <Mark ok={mark} label={mark ? 'Right bucket' : 'Misplaced'} />}
      {!disabled && (
        <select
          aria-label="Move card to"
          className="ml-1 min-h-[44px] max-w-[8rem] rounded border-2 border-outline bg-surface-sunk text-xs"
          value={bucket ?? ''}
          onChange={(e) => place(e.target.value || null)}
          data-testid="card-select"
        >
          <option value="">Unsorted</option>
          {buckets.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** Sort cards into buckets (§9.2): drag, or use each card's "Move to" menu. Misplaced cards are marked. */
export function CategorizeView({
  question: q,
  ctx,
  disabled,
  answer,
  onChange,
  marks,
  reveal,
}: WidgetViewProps<CategorizeQuestion, CategorizeAnswer>) {
  const order = useMemo(() => seededOrder(q.cards.length, ctx.seed ^ hashString(q.id)), [q, ctx.seed]);
  const placed: CategorizeAnswer = reveal
    ? q.cards.map((c) => c.bucket)
    : (answer ?? q.cards.map(() => null));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );
  const place = (i: number, b: string | null) => {
    const next = [...placed];
    next[i] = b;
    onChange(next.some((x) => x !== null) ? next : null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const i = Number(String(e.active.id).slice(5));
    place(i, e.over.id === POOL ? null : String(e.over.id));
  };
  const markFor = (i: number): boolean | undefined => {
    if (reveal) return reveal.learner?.[i] === q.cards[i].bucket;
    if (!marks || marks.answer[i] !== placed[i]) return undefined;
    return marks.grade.parts?.[i];
  };
  const cardsIn = (b: string | null) =>
    order
      .filter((i) => placed[i] === b)
      .map((i) => (
        <Card
          key={i}
          i={i}
          text={q.cards[i].text}
          scope={ctx.scope}
          bucket={placed[i]}
          buckets={q.buckets}
          disabled={disabled || !!reveal}
          mark={markFor(i)}
          place={(nb) => place(i, nb)}
        />
      ));
  const unsorted = cardsIn(null);
  return (
    <div data-testid="categorize">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        {!reveal && (
          <Bucket id={POOL} title={unsorted.length ? 'Cards to sort' : 'All cards sorted'}>
            {unsorted}
          </Bucket>
        )}
        <div className={`mt-3 grid gap-3 ${q.buckets.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {q.buckets.map((b) => (
            <Bucket key={b} id={b} title={b}>
              {cardsIn(b)}
            </Bucket>
          ))}
        </div>
      </DndContext>
      {reveal && (
        <p className="mt-2 text-sm text-ink-2">
          Every card is shown in its correct bucket; “Misplaced” marks the ones you had elsewhere.
        </p>
      )}
    </div>
  );
}
