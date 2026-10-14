/** Shared helpers for the content validator (§13.2). */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import katex from 'katex';
import YAML from 'yaml';
import type { z } from 'zod';
import type { ParamSpec } from '../../src/content/schema';
import { math, type Scope } from '../../src/engine/expr';
import { applyDerived, enumerateParamValues } from '../../src/engine/params';
import { renderTemplate } from '../../src/engine/template';

export interface Issue {
  file: string;
  where?: string;
  message: string;
}

export class Collector {
  errors: Issue[] = [];
  warnings: Issue[] = [];
  private seen = new Set<string>();
  constructor(private root: string) {}
  rel(file: string): string {
    return relative(this.root, file).replace(/\\/g, '/');
  }
  error(file: string, message: string, where?: string) {
    this.errors.push({ file: this.rel(file), where, message });
  }
  warn(file: string, message: string, where?: string) {
    this.warnings.push({ file: this.rel(file), where, message });
  }
  /** Report a message once per key (param sets often repeat the same failure). */
  errorOnce(key: string, file: string, message: string, where?: string) {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.error(file, message, where);
  }
  warnOnce(key: string, file: string, message: string, where?: string) {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.warn(file, message, where);
  }
}

/** File-and-location bound reporter, handed down to the lesson/question checks. */
export interface Reporter {
  error(message: string, where?: string): void;
  warn(message: string, where?: string): void;
  errorOnce(key: string, message: string, where?: string): void;
  warnOnce(key: string, message: string, where?: string): void;
}

export function reporterFor(c: Collector, file: string): Reporter {
  return {
    error: (m, w) => c.error(file, m, w),
    warn: (m, w) => c.warn(file, m, w),
    errorOnce: (k, m, w) => c.errorOnce(`${file}|${k}`, file, m, w),
    warnOnce: (k, m, w) => c.warnOnce(`${file}|${k}`, file, m, w),
  };
}

export function formatZodError(err: z.ZodError): string {
  return err.issues
    .slice(0, 8)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
}

export function readYaml(file: string): unknown {
  return YAML.parse(readFileSync(file, 'utf8'), { prettyErrors: true, merge: true });
}

export function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/** Word count with every math segment counted as one word (§13.2 concept cards). */
export function proseWordCount(s: string): number {
  return wordCount(s.replace(/\$\$[\s\S]+?\$\$/g, ' M ').replace(/(?<!\\)\$[^$]+?(?<!\\)\$/g, ' M '));
}

/** Every `$…$` and `$$…$$` segment in a Markdown string. */
export function mathSegments(src: string): { tex: string; display: boolean }[] {
  const out: { tex: string; display: boolean }[] = [];
  // Strip fenced and inline code first — `$` there is not math.
  let s = src.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => {
    out.push({ tex, display: true });
    return ' ';
  });
  for (const m of s.matchAll(/(?<!\\)\$([^$]+?)(?<!\\)\$/g)) out.push({ tex: m[1], display: false });
  return out;
}

export function checkKatex(src: string): string | null {
  for (const seg of mathSegments(src)) {
    try {
      katex.renderToString(seg.tex, { throwOnError: true, displayMode: seg.display, strict: 'ignore' });
    } catch (e) {
      return `KaTeX: ${(e as Error).message.split('\n')[0]} in "${seg.tex.trim().slice(0, 80)}"`;
    }
  }
  return null;
}

/** Render templates, then check KaTeX. Returns an error message or null. */
export function renderAndCheck(src: string, scope: Scope): { text: string; error: string | null } {
  let text: string;
  try {
    text = renderTemplate(src, scope);
  } catch (e) {
    return { text: src, error: `template: ${(e as Error).message}` };
  }
  return { text, error: checkKatex(text) };
}

export function numbersIn(s: string): Set<number> {
  const out = new Set<number>();
  for (const m of s.matchAll(/(?<![\w.])\d+(?:\.\d+)?(?![\w.]*\d)/g)) out.add(Number(m[0]));
  return out;
}

/** Every scope a param spec can produce: each set, or up to `max` seeded samples of `vars` (§13.2). */
export function scopesOf(
  params: ParamSpec | undefined,
  derived: Record<string, string> | undefined,
  onError: (msg: string) => void,
  max = 200,
): Scope[] {
  const out: Scope[] = [];
  const values = params ? enumerateParamValues(params, max) : [{}];
  for (const v of values) {
    try {
      out.push(applyDerived(v, derived));
    } catch (e) {
      onError(`derived: ${(e as Error).message} with ${JSON.stringify(v)}`);
    }
  }
  return out;
}

/** Free symbol names in a mathjs expression (excluding functions and constants). */
export function symbolsIn(expr: string): Set<string> {
  const out = new Set<string>();
  try {
    const node = math.parse(expr);
    const fnNames = new Set<string>();
    node.traverse((n) => {
      const f = n as unknown as { isFunctionNode?: boolean; fn?: { name?: string } };
      if (f.isFunctionNode && f.fn?.name) fnNames.add(f.fn.name);
    });
    node.traverse((n) => {
      const s = n as unknown as { isSymbolNode?: boolean; name?: string };
      if (s.isSymbolNode && s.name && !fnNames.has(s.name) && !(s.name in math)) out.add(s.name);
    });
  } catch {
    // Parse errors are reported where the expression is evaluated.
  }
  return out;
}

/** Keys whose string values are expressions, ids or code — never templated or KaTeX-checked. */
export const NON_TEXT_KEYS = new Set([
  'id',
  'kind',
  'type',
  'mode',
  'expr',
  'value',
  'if',
  'check',
  'verify',
  'lhs',
  'rhs',
  'misconception',
  'bucket',
  'orderBy',
  'correctOrder',
  'order',
  'answer',
  'wrongAnswers',
  'wrongTargets',
  'targets',
  'odd',
  'errorLine',
  'netlist',
  'preset',
  'config',
  'solution',
  'interactive',
  'on',
  'tiles',
  'allowedSymbols',
  'forbid',
  'vars',
  'language',
  'starter',
  'entry',
  'tests',
  'params',
  'derived',
  'concept',
  'uses',
  'clueFor',
  'remediates',
  'role',
  'method',
]);

/** All templated Markdown strings in an object (prompts, options, hints, explanations, …). */
export function textLeaves(
  obj: unknown,
  path = '',
  skip: ReadonlySet<string> = new Set(),
): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (v: unknown, p: string, key: string) => {
    if (typeof v === 'string') {
      if (!NON_TEXT_KEYS.has(key) && !skip.has(key)) out.push({ path: p, text: v });
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`, key));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v))
        if (!NON_TEXT_KEYS.has(k) && !skip.has(k)) walk(x, p ? `${p}.${k}` : k, k);
  };
  walk(obj, path, '');
  return out;
}
