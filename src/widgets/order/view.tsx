import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo } from 'react';
import type { Scope } from '../../engine/expr';
import { hashString, seededOrder } from '../common';
import type { WidgetViewProps } from '../types';
import { Mark, markClass, Tx } from '../ui';
import { correctOrderOf, type OrderAnswer, type OrderQuestion } from './model';

function Row({
  id,
  text,
  scope,
  pos,
  count,
  disabled,
  mark,
  move,
}: {
  id: string;
  text: string;
  scope: Scope;
  pos: number;
  count: number;
  disabled: boolean;
  mark?: boolean;
  move(to: number): void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-xl border-2 bg-surface px-3 py-2 ${markClass(mark === undefined ? 'none' : mark ? 'ok' : 'bad')} ${isDragging ? 'z-10 shadow-lg' : ''}`}
      data-item={id}
    >
      <button
        type="button"
        className={`flex min-h-[44px] min-w-[32px] items-center justify-center rounded text-ink-2 ${disabled ? '' : 'cursor-grab hover:bg-surface-sunk'}`}
        aria-label={`Drag to reorder (position ${pos + 1} of ${count}). Space to pick up, arrows to move, Space to drop.`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span className="w-6 text-sm font-semibold text-ink-2">{pos + 1}.</span>
      <span className="min-w-0 flex-1">
        <Tx s={text} scope={scope} />
      </span>
      {mark !== undefined && <Mark ok={mark} label={mark ? 'In place' : 'Moved'} />}
      {!disabled && (
        <span className="flex gap-1">
          <button
            type="button"
            className="min-h-[44px] min-w-[36px] rounded border-2 border-outline hover:bg-surface-sunk disabled:opacity-40"
            disabled={pos === 0}
            onClick={() => move(pos - 1)}
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            className="min-h-[44px] min-w-[36px] rounded border-2 border-outline hover:bg-surface-sunk disabled:opacity-40"
            disabled={pos === count - 1}
            onClick={() => move(pos + 1)}
            aria-label="Move down"
          >
            ↓
          </button>
        </span>
      )}
    </li>
  );
}

/** Drag items into order (§9.2): @dnd-kit with its keyboard sensor, plus ↑/↓ buttons (§11). */
export function OrderView({
  question: q,
  ctx,
  disabled,
  answer,
  onChange,
  marks,
  reveal,
}: WidgetViewProps<OrderQuestion, OrderAnswer>) {
  const initial = useMemo(() => {
    const ids = q.items.map((i) => i.id);
    const target = correctOrderOf(q, ctx.scope).join();
    // A starting order that isn't already correct.
    for (let k = 0; k < 8; k++) {
      const o = seededOrder(ids.length, (ctx.seed ^ hashString(q.id)) + k).map((i) => ids[i]);
      if (o.join() !== target) return o;
    }
    return [...ids].reverse();
  }, [q, ctx.scope, ctx.seed]);
  useEffect(() => {
    if (answer === null && !disabled) onChange(initial);
  }, [answer, disabled, initial, onChange]);
  const order = reveal ? correctOrderOf(q, ctx.scope) : (answer ?? initial);
  const byId = new Map(q.items.map((i) => [i.id, i]));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    onChange(arrayMove(order, order.indexOf(String(e.active.id)), order.indexOf(String(e.over.id))));
  };
  const markFor = (pos: number): boolean | undefined => {
    if (reveal) return undefined;
    if (!marks || marks.answer.join() !== order.join()) return undefined;
    return marks.grade.parts?.[pos];
  };
  return (
    <div data-testid="order">
      {reveal && (
        <p className="mb-2 text-sm font-semibold text-ink">
          Correct order{reveal.learner ? ' (yours is listed below)' : ''}:
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="grid gap-2">
            {order.map((id, pos) => (
              <Row
                key={id}
                id={id}
                text={byId.get(id)!.text}
                scope={ctx.scope}
                pos={pos}
                count={order.length}
                disabled={disabled || !!reveal}
                mark={markFor(pos)}
                move={(to) => onChange(arrayMove(order, pos, to))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {reveal?.learner && reveal.learner.join() !== order.join() && (
        <p className="mt-2 text-sm text-ink-2">
          Yours:{' '}
          {reveal.learner.map((id, i) => (
            <span key={id}>
              {i > 0 && ' → '}
              <Tx s={byId.get(id)!.text} scope={ctx.scope} />
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
