/**
 * Reference traces for the algorithm stepper (§9.2). Each algorithm turns an input into the exact
 * sequence of operations the student must perform. Unit tests compare these traces with
 * independent reference implementations.
 */
import { z } from 'zod';
import { cell, node, parseCell, parseNode, type Tone, type Trace, type TraceStep, type View } from './trace';

const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

// ─────────────────────────── guess my number (binary search discovery) ───────────────────────────
export const guessNumberInput = z.strictObject({
  n: z.number().int().min(2).max(200),
  secret: z.number().int().min(1),
});

export function guessNumber({ n, secret }: z.infer<typeof guessNumberInput>): Trace {
  const steps: TraceStep[] = [];
  let lo = 1;
  let hi = n;
  const guesses: number[] = [];
  const view = (): View => ({
    array: {
      values: range(1, n),
      indexLabels: range(1, n).map(() => ''),
      tones: Object.fromEntries(
        range(1, n).flatMap((v): [number, Tone][] =>
          v < lo || v > hi ? [[v - 1, 'muted']] : guesses.includes(v) ? [[v - 1, 'active']] : [],
        ),
      ),
      clickable: range(lo - 1, hi - 1),
    },
    vars: { 'still possible': `${lo}–${hi} (${hi - lo + 1} numbers)`, guesses: guesses.length },
  });
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const [l, h] = [lo, hi];
    steps.push({
      view: view(),
      prompt: `The number is between ${lo} and ${hi}. Which guess guarantees you rule out the most numbers?`,
      correct: cell(mid - 1),
      wrong: (id) => {
        const g = (parseCell(id) ?? 0) + 1;
        if (g < l || g > h) return `We already know it's between ${l} and ${h}; ${g} can't be it.`;
        const worst = Math.max(g - l, h - g);
        const best = Math.max(mid - l, h - mid);
        return `If the answer is "${g < mid ? 'higher' : 'lower'}", guessing ${g} still leaves ${worst} numbers. The middle, ${mid}, leaves at most ${best}.`;
      },
      after:
        mid === secret
          ? `${mid} — got it!`
          : `${mid} is too ${mid < secret ? 'low' : 'high'}: the answer is ${mid < secret ? 'higher' : 'lower'}.`,
    });
    guesses.push(mid);
    if (mid === secret) break;
    if (mid < secret) lo = mid + 1;
    else hi = mid - 1;
  }
  const final = view();
  final.array!.tones = { ...final.array!.tones, [secret - 1]: 'found' };
  final.array!.clickable = [];
  return {
    steps,
    final,
    summary: `Found ${secret} in ${guesses.length} guesses. Halving each time needs at most ⌈log₂(${n + 1})⌉ = ${Math.ceil(Math.log2(n + 1))}.`,
  };
}

// ─────────────────────────── binary search on a sorted array ───────────────────────────
export const binarySearchInput = z.strictObject({ values: z.array(z.number()).min(1), target: z.number() });

export function binarySearch({ values, target }: z.infer<typeof binarySearchInput>): Trace {
  const steps: TraceStep[] = [];
  let lo = 0;
  let hi = values.length - 1;
  const probed: number[] = [];
  const view = (): View => ({
    array: {
      values,
      tones: Object.fromEntries(
        values.flatMap((_, i): [number, Tone][] =>
          i < lo || i > hi ? [[i, 'muted']] : probed.includes(i) ? [[i, 'active']] : [],
        ),
      ),
      pointers: lo <= hi ? { lo, hi } : {},
      clickable: lo <= hi ? range(lo, hi) : [],
    },
    vars: { target, checks: probed.length },
  });
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const [l, h] = [lo, hi];
    steps.push({
      view: view(),
      prompt: `Searching indices ${lo}–${hi} for ${target}. Which index do you check next?`,
      correct: cell(mid),
      wrong: (id) => {
        const i = parseCell(id) ?? -1;
        if (i < l || i > h) return `Index ${i} is outside the range still in play (${l}–${h}).`;
        return `Binary search checks the middle of the range: (${l} + ${h}) // 2 = ${mid}. Checking ${i} could leave more than half of the range.`;
      },
      after:
        values[mid] === target
          ? `values[${mid}] = ${target}. Found!`
          : `values[${mid}] = ${values[mid]} is ${values[mid] < target ? 'less' : 'more'} than ${target}, so search the ${values[mid] < target ? 'right' : 'left'} half.`,
    });
    probed.push(mid);
    if (values[mid] === target) break;
    if (values[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  if (lo > hi) {
    steps.push({
      view: view(),
      prompt: 'The range is empty. What do you conclude?',
      actions: [
        { id: 'absent', label: `${target} is not in the array` },
        { id: 'restart', label: 'Search again from the start' },
      ],
      correct: 'absent',
      wrong: () => 'An empty range means every place the target could be has been ruled out.',
    });
  }
  const final = view();
  const found = values.indexOf(target);
  if (found >= 0) final.array!.tones = { ...final.array!.tones, [found]: 'found' };
  return {
    steps,
    final,
    summary: `${found >= 0 ? `Found at index ${found}` : 'Not present'} after ${probed.length} checks.`,
  };
}

// ─────────────────────────── dynamic array with doubling ───────────────────────────
export const dynamicArrayInput = z.strictObject({
  appends: z.number().int().min(1).max(40),
  capacity: z.number().int().min(1).default(1),
});

export function dynamicArray({ appends, capacity: cap0 }: z.infer<typeof dynamicArrayInput>): Trace {
  const steps: TraceStep[] = [];
  let capacity = cap0;
  let size = 0;
  let copies = 0;
  const view = (): View => ({
    array: {
      label: `capacity ${capacity}`,
      values: Array.from({ length: capacity }, (_, i) => (i < size ? i + 1 : null)),
      tones: size > 0 ? { [size - 1]: 'new' } : {},
    },
    vars: { size, capacity, 'element copies so far': copies },
  });
  for (let k = 1; k <= appends; k++) {
    const full = size === capacity;
    const [s, c] = [size, capacity];
    steps.push({
      view: view(),
      prompt: `Append element ${k}. Size ${size}, capacity ${capacity}: what happens?`,
      actions: [
        { id: 'write', label: 'Write it into the next free slot' },
        { id: 'grow', label: `Allocate capacity ${capacity * 2}, copy ${size}, then write` },
      ],
      correct: full ? 'grow' : 'write',
      wrong: () =>
        full
          ? `All ${c} slots are used (size ${s} = capacity ${c}), so there is no free slot: the array must grow.`
          : `There's still room (size ${s} < capacity ${c}), so no copying is needed.`,
      after: full
        ? `Copied ${s} element${s === 1 ? '' : 's'} into a new array of capacity ${c * 2}.`
        : undefined,
    });
    if (full) {
      copies += size;
      capacity *= 2;
    }
    size++;
  }
  return {
    steps,
    final: view(),
    summary: `${appends} appends cost ${appends} writes plus ${copies} copies — about ${((appends + copies) / appends).toFixed(2)} operations per append. Doubling keeps that below 3 however long the array gets.`,
  };
}

// ─────────────────────────── inserting into an array (shifting right) ───────────────────────────
export const arrayInsertInput = z.strictObject({
  values: z.array(z.number()).min(1).max(12),
  index: z.number().int().min(0),
  value: z.number(),
});

export function arrayInsert({ values, index, value }: z.infer<typeof arrayInsertInput>): Trace {
  const steps: TraceStep[] = [];
  const arr: (number | null)[] = [...values, null];
  const n = values.length;
  const view = (active?: number): View => ({
    array: {
      values: [...arr],
      tones: active !== undefined ? { [active]: 'active' } : {},
      clickable: range(0, n),
    },
    vars: { insert: `${value} at index ${index}`, shifts: n - 1 - (active ?? n - 1) },
  });
  for (let i = n - 1; i >= index; i--) {
    const at = i;
    steps.push({
      view: view(),
      prompt: `To make room at index ${index}, which element do you shift one place right next?`,
      correct: cell(at),
      wrong: (id) => {
        const j = parseCell(id) ?? -1;
        if (j < index) return `Elements before index ${index} stay where they are.`;
        if (j < at)
          return `Shifting index ${j} now would overwrite index ${j + 1}, which hasn't moved yet. Work from the right end.`;
        return `That cell has already moved (or is the free slot). The next to move is index ${at}.`;
      },
      after: `Moved ${arr[at]} from index ${at} to ${at + 1}.`,
    });
    arr[at + 1] = arr[at];
    arr[at] = null;
  }
  steps.push({
    view: view(),
    prompt: `Index ${index} is free. Where do you write ${value}?`,
    correct: cell(index),
    wrong: () => `The new value goes in the gap at index ${index}.`,
  });
  arr[index] = value;
  return {
    steps,
    final: { array: { values: [...arr], tones: { [index]: 'found' } }, vars: { shifts: n - index } },
    summary: `Inserting at index ${index} shifted ${n - index} elements — O(n) in the worst case (inserting at the front).`,
  };
}

// ─────────────────────────── reversing a singly linked list ───────────────────────────
export const listReverseInput = z.strictObject({
  values: z
    .array(z.union([z.number(), z.string()]))
    .min(2)
    .max(8),
});

export function listReverse({ values }: z.infer<typeof listReverseInput>): Trace {
  const nodes = values.map((v, i) => ({ id: i, value: v, next: i + 1 < values.length ? i + 1 : null }));
  const steps: TraceStep[] = [];
  let prev: number | null = null;
  let curr: number | null = 0;
  const view = (): View => ({
    list: {
      nodes: nodes.map((n) => ({ ...n })),
      pointers: { prev, curr, next: curr === null ? null : nodes[curr].next },
      clickable: nodes.map((n) => n.id),
    },
  });
  while (curr !== null) {
    const c: number = curr;
    const p: number | null = prev;
    const nx: number | null = nodes[c].next;
    steps.push({
      view: view(),
      prompt: `curr is node ${nodes[c].value}. Where should curr.next point now?`,
      actions: [{ id: 'null', label: 'None (null)' }],
      correct: p === null ? 'null' : node(p),
      wrong: (id) => {
        const t = id === 'null' ? null : parseNode(id);
        if (t === c) return 'A node pointing to itself would create a loop.';
        if (t === nx) return `That's where curr.next already points — the list wouldn't be reversed.`;
        if (p === null && t !== null)
          return `${nodes[c].value} becomes the new tail, so its next must be None.`;
        return `Reversing means each node points back to the node before it — that's prev (${p === null ? 'None' : nodes[p].value}).`;
      },
      after: `Saved next = ${nx === null ? 'None' : nodes[nx].value}, set ${nodes[c].value}.next = ${p === null ? 'None' : nodes[p].value}, then moved prev and curr forward.`,
    });
    nodes[c].next = p;
    prev = c;
    curr = nx;
  }
  return {
    steps,
    final: { list: { nodes: nodes.map((n) => ({ ...n })), pointers: { head: prev } } },
    summary: `Reversed in one pass: ${values.length} pointer changes, O(n) time and O(1) extra space. The new head is ${values[values.length - 1]}.`,
  };
}

// ─────────────────────────── balanced brackets with a stack ───────────────────────────
export const bracketsInput = z.strictObject({
  text: z
    .string()
    .min(1)
    .max(24)
    .regex(/^[()[\]{}]+$/),
});
const PAIR: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

export function brackets({ text }: z.infer<typeof bracketsInput>): Trace {
  const steps: TraceStep[] = [];
  const stack: string[] = [];
  const view = (i: number): View => ({
    input: { text, index: i },
    stack: { label: 'stack (top on the right)', items: [...stack] },
  });
  let failed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const top = stack[stack.length - 1];
    const actions = [
      { id: 'push', label: `Push ${ch}` },
      { id: 'pop', label: `Pop ${top ?? '(empty)'} — it matches` },
      { id: 'mismatch', label: 'Stop: unbalanced' },
    ];
    if (ch in PAIR) {
      const ok = top === PAIR[ch];
      steps.push({
        view: view(i),
        prompt: `Next character: ${ch}. What do you do?`,
        actions,
        correct: ok ? 'pop' : 'mismatch',
        wrong: (id) =>
          id === 'push'
            ? 'Only opening brackets are pushed; a closing bracket must match the top of the stack.'
            : ok
              ? `The top of the stack is ${top}, which matches ${ch}, so pop it.`
              : top === undefined
                ? `The stack is empty: there's no opening bracket for ${ch} to close.`
                : `The top is ${top}, which doesn't match ${ch}: the brackets are unbalanced.`,
        after: ok ? `${top}${ch} matched.` : undefined,
      });
      if (!ok) {
        failed = true;
        break;
      }
      stack.pop();
    } else {
      steps.push({
        view: view(i),
        prompt: `Next character: ${ch}. What do you do?`,
        actions,
        correct: 'push',
        wrong: () => `${ch} is an opening bracket: push it and wait for its partner.`,
      });
      stack.push(ch);
    }
  }
  if (!failed) {
    steps.push({
      view: view(text.length),
      prompt: 'All characters read. Is the string balanced?',
      actions: [
        { id: 'balanced', label: 'Balanced' },
        { id: 'unbalanced', label: 'Unbalanced' },
      ],
      correct: stack.length === 0 ? 'balanced' : 'unbalanced',
      wrong: () =>
        stack.length === 0
          ? 'Every opening bracket was matched and the stack is empty.'
          : `The stack still holds ${stack.join('')}: those were never closed.`,
    });
  }
  const balanced = !failed && stack.length === 0;
  return {
    steps,
    final: view(text.length),
    summary: `${text} is ${balanced ? 'balanced' : 'unbalanced'}. One pass, each bracket pushed and popped at most once: O(n).`,
  };
}

// ─────────────────────────── circular buffer queue ───────────────────────────
export const circularInput = z.strictObject({
  capacity: z.number().int().min(2).max(10),
  /** "e:<value>" enqueues; "d" dequeues. */
  ops: z
    .array(z.string().regex(/^(e:-?\d+|d)$/))
    .min(1)
    .max(20),
});

export function circularBuffer({ capacity, ops }: z.infer<typeof circularInput>): Trace {
  const slots: (number | null)[] = Array(capacity).fill(null);
  let head = 0;
  let size = 0;
  const steps: TraceStep[] = [];
  const view = (): View => ({
    array: {
      values: [...slots],
      pointers: { head, tail: (head + size) % capacity },
      clickable: range(0, capacity - 1),
    },
    vars: { size, capacity },
  });
  for (const op of ops) {
    if (op === 'd') {
      if (size === 0) throw new Error('circular buffer: dequeue from empty queue');
      const h = head;
      steps.push({
        view: view(),
        prompt: 'Dequeue: which slot is read?',
        correct: cell(h),
        wrong: () => `The oldest element sits at head = ${h}. A queue removes from the front (FIFO).`,
        after: `Read ${slots[h]} from slot ${h}; head moves to ${(h + 1) % capacity}.`,
      });
      slots[h] = null;
      head = (head + 1) % capacity;
      size--;
    } else {
      if (size === capacity) throw new Error('circular buffer: enqueue into full queue');
      const v = Number(op.slice(2));
      const t = (head + size) % capacity;
      const [h, s] = [head, size];
      steps.push({
        view: view(),
        prompt: `Enqueue ${v}: which slot does it go into?`,
        correct: cell(t),
        wrong: (id) => {
          const j = parseCell(id) ?? -1;
          if (slots[j] !== null) return `Slot ${j} is still occupied.`;
          return `New elements go at the tail: (head + size) mod capacity = (${h} + ${s}) mod ${capacity} = ${t}.`;
        },
        after: t < h + s ? `Wrapped around to slot ${t}.` : undefined,
      });
      slots[t] = v;
      size++;
    }
  }
  return {
    steps,
    final: view(),
    summary: `Every enqueue and dequeue was O(1): only head, size and one slot change — nothing is shifted.`,
  };
}

// ─────────────────────────── registry ───────────────────────────
export const ALGORITHMS = {
  'guess-number': { input: guessNumberInput, trace: guessNumber },
  'binary-search': { input: binarySearchInput, trace: binarySearch },
  'dynamic-array': { input: dynamicArrayInput, trace: dynamicArray },
  'array-insert': { input: arrayInsertInput, trace: arrayInsert },
  'list-reverse': { input: listReverseInput, trace: listReverse },
  brackets: { input: bracketsInput, trace: brackets },
  'circular-buffer': { input: circularInput, trace: circularBuffer },
} as const;

export type AlgorithmId = keyof typeof ALGORITHMS;

export function traceFor(algorithm: AlgorithmId, input: unknown): Trace {
  const a = ALGORITHMS[algorithm];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (a.trace as (i: any) => Trace)(a.input.parse(input));
}
