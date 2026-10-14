import { evaluate, type Scope } from './expr';
import { formatNumber } from './format';

// `{{{x}}}` (a TeX brace around a template) matches the inner `{{x}}`.
const TEMPLATE = /\{\{(?!\{)([\s\S]+?)\}\}/g;

export function hasTemplates(src: string): boolean {
  TEMPLATE.lastIndex = 0;
  return TEMPLATE.test(src);
}

/** For each index of `src`, whether it sits inside `$…$` or `$$…$$` math. */
function mathMask(src: string): boolean[] {
  const mask = new Array<boolean>(src.length).fill(false);
  let inMath: '' | '$' | '$$' = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\' && src[i + 1] === '$') {
      mask[i] = mask[i + 1] = inMath !== '';
      i++;
      continue;
    }
    if (c === '$') {
      const dbl = src[i + 1] === '$';
      if (inMath === '') {
        inMath = dbl ? '$$' : '$';
      } else if (inMath === '$$' && dbl) {
        inMath = '';
      } else if (inMath === '$' && !dbl) {
        inMath = '';
      }
      mask[i] = true;
      if (dbl) {
        mask[i + 1] = true;
        i++;
      }
      continue;
    }
    mask[i] = inMath !== '';
  }
  return mask;
}

export function formatValue(v: unknown, inMath: boolean): string {
  if (typeof v === 'number') return formatNumber(v, { math: inMath });
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return v;
  throw new Error(`template value is not a number (got ${typeof v})`);
}

/** Replace every `{{ expression }}` with its formatted value. */
export function renderTemplate(src: string, scope: Scope): string {
  if (!src.includes('{{')) return src;
  const mask = mathMask(src);
  return src.replace(TEMPLATE, (_m, expr: string, offset: number) => {
    let v: unknown;
    try {
      v = evaluate(expr.trim(), scope);
    } catch (e) {
      throw new Error(`template {{${expr.trim()}}}: ${(e as Error).message}`, { cause: e });
    }
    if (typeof v === 'number' && !Number.isFinite(v)) {
      throw new Error(`template {{${expr.trim()}}} is not finite (${v})`);
    }
    return formatValue(v, mask[offset]);
  });
}

/** Extract the expressions used in templates (for static analysis). */
export function templateExpressions(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(TEMPLATE)) out.push(m[1].trim());
  return out;
}
