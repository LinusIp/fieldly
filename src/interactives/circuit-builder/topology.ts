/**
 * How the parts of a circuit are connected, in words: "R1 in series with (R2 ∥ R3)". Used by
 * `describeState` (§11) so a screen reader — or a learner reading the text — knows the topology,
 * not just the parts list.
 *
 * Wires (and nothing else) join their terminals into one node. Between battery B1's terminals the
 * two-terminal parts are reduced series-parallel style; voltmeters and capacitors are described
 * separately by what they sit across. A network that doesn't reduce (a bridge) falls back to node
 * pairs.
 */
import type { NetElement, Netlist } from './solver';

interface Edge {
  a: string;
  b: string;
  /** Text of this sub-network; `simple` when it is a single part (needs no brackets). */
  text: string;
  simple: boolean;
}

function nodeMap(net: Netlist): (n: string) => string {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  for (const e of net.elements) {
    if (!parent.has(e.a)) parent.set(e.a, e.a);
    if (!parent.has(e.b)) parent.set(e.b, e.b);
  }
  for (const e of net.elements)
    if (e.kind === 'wire') {
      const ra = find(e.a);
      const rb = find(e.b);
      if (ra !== rb) parent.set(ra, rb);
    }
  return find;
}

function partName(e: NetElement): string {
  return e.kind === 'switch' ? `${e.label} (${e.closed === false ? 'open' : 'closed'})` : e.label;
}

const wrap = (e: Edge) => (e.simple ? e.text : `(${e.text})`);

/** Series-parallel reduction between `from` and `to`; null when the network is not series-parallel. */
function reduce(edges: Edge[], from: string, to: string): Edge | null {
  let es = edges.filter((e) => e.a !== e.b);
  for (let guard = 0; guard < 500; guard++) {
    // Parallel: two edges between the same pair of nodes.
    let changed = false;
    outer: for (let i = 0; i < es.length; i++)
      for (let j = i + 1; j < es.length; j++) {
        const x = es[i];
        const y = es[j];
        if ((x.a === y.a && x.b === y.b) || (x.a === y.b && x.b === y.a)) {
          const merged: Edge = { a: x.a, b: x.b, text: `${wrap(x)} ∥ ${wrap(y)}`, simple: false };
          es = [...es.slice(0, i), merged, ...es.slice(i + 1, j), ...es.slice(j + 1)];
          changed = true;
          break outer;
        }
      }
    if (changed) continue;
    // Series: an inner node with exactly two edges.
    const degree = new Map<string, Edge[]>();
    for (const e of es) {
      degree.set(e.a, [...(degree.get(e.a) ?? []), e]);
      degree.set(e.b, [...(degree.get(e.b) ?? []), e]);
    }
    for (const [n, list] of degree) {
      if (n === from || n === to || list.length !== 2) continue;
      const [x, y] = list;
      const xo = x.a === n ? x.b : x.a;
      const yo = y.a === n ? y.b : y.a;
      const merged: Edge = { a: xo, b: yo, text: `${wrap(x)} in series with ${wrap(y)}`, simple: false };
      es = [...es.filter((e) => e !== x && e !== y), merged];
      changed = true;
      break;
    }
    if (changed) continue;
    // Dangling parts (one end connected to nothing else) carry no current: drop them.
    const dangling = [...degree].find(([n, list]) => n !== from && n !== to && list.length === 1);
    if (dangling) {
      es = es.filter((e) => e !== dangling[1][0]);
      continue;
    }
    break;
  }
  if (es.length === 1 && ((es[0].a === from && es[0].b === to) || (es[0].a === to && es[0].b === from)))
    return es[0];
  if (es.length === 0) return null;
  return null;
}

/** One sentence (or a few) saying how the parts are connected. */
export function topologyText(net: Netlist): string {
  const find = nodeMap(net);
  const b1 = net.elements.find((e) => e.label === 'B1');
  const across = net.elements.filter((e) => e.kind === 'voltmeter' || e.kind === 'capacitor');
  const parts = net.elements.filter(
    (e) => e !== b1 && e.kind !== 'wire' && e.kind !== 'voltmeter' && e.kind !== 'capacitor',
  );
  const sentences: string[] = [];
  if (b1) {
    const from = find(b1.a);
    const to = find(b1.b);
    // Other batteries are two-terminal parts in the network too.
    const edges: Edge[] = parts.map((e) => ({ a: find(e.a), b: find(e.b), text: partName(e), simple: true }));
    if (edges.length === 0)
      sentences.push(from === to ? 'B1 is shorted by a wire' : 'Nothing is connected to B1 yet');
    else if (from === to) sentences.push('A wire connects B1’s terminals directly (a short circuit)');
    else {
      const r = reduce(edges, from, to);
      if (r) sentences.push(`Across B1: ${r.text}`);
      else
        sentences.push(
          `B1’s + side is node ${from}, its − side node ${to}. ${parts
            .map((e) => `${partName(e)} joins ${find(e.a)} to ${find(e.b)}`)
            .join('; ')}`,
        );
    }
  }
  for (const m of across) {
    const a = find(m.a);
    const b = find(m.b);
    const same = parts.filter(
      (p) => (find(p.a) === a && find(p.b) === b) || (find(p.a) === b && find(p.b) === a),
    );
    const what =
      b1 && ((find(b1.a) === a && find(b1.b) === b) || (find(b1.a) === b && find(b1.b) === a))
        ? 'the battery B1'
        : same.length
          ? same.map((p) => p.label).join(' and ')
          : `nodes ${a} and ${b}`;
    sentences.push(`${m.kind === 'voltmeter' ? 'Voltmeter' : 'Capacitor'} ${m.label} is across ${what}`);
  }
  return sentences.join('. ');
}
