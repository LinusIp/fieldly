/**
 * Number formatting for templates and computed options (§7.4):
 * - 3 significant figures by default, trailing zeros trimmed;
 * - exact integers below 1e5 printed as integers;
 * - |x| ≥ 1e5 or 0 < |x| < 1e-3 in scientific form: `2.5 × 10⁻⁴` in text,
 *   `2.5 \times 10^{-4}` inside `$…$`.
 */

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
};

export interface FormatOptions {
  sig?: number;
  /** true when the number is printed inside KaTeX math. */
  math?: boolean;
}

function minus(math: boolean): string {
  return math ? '-' : '−';
}

function plain(x: number, sig: number): string {
  // Round to `sig` significant figures, then let Number→String trim trailing zeros.
  const rounded = Number(x.toPrecision(sig));
  if (Object.is(rounded, -0)) return '0';
  return String(rounded);
}

export function formatNumber(x: number, opts: FormatOptions = {}): string {
  const sig = opts.sig ?? 3;
  const math = opts.math ?? false;
  if (Number.isNaN(x)) return 'NaN';
  if (!Number.isFinite(x)) return x > 0 ? '∞' : `${minus(math)}∞`;
  if (x === 0) return '0';

  const neg = x < 0;
  const ax = Math.abs(x);
  let body: string;

  if (ax >= 1e5 || ax < 1e-3) {
    let exp = Math.floor(Math.log10(ax));
    let mant = Number((ax / 10 ** exp).toPrecision(sig));
    if (mant >= 10) {
      mant /= 10;
      exp += 1;
    }
    const m = String(Number(mant.toPrecision(sig)));
    if (math) {
      body = `${m} \\times 10^{${exp}}`;
    } else {
      const e = String(exp)
        .split('')
        .map((c) => SUPERSCRIPT[c] ?? c)
        .join('');
      body = `${m} × 10${e}`;
    }
  } else if (Number.isInteger(ax)) {
    body = String(ax);
  } else {
    body = plain(ax, sig);
    // Rounding can push a value to an exact integer (2.9999 → 3); that is fine.
  }
  return neg ? `${minus(math)}${body}` : body;
}
