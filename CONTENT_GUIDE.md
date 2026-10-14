# Content guide

A short guide for writing lessons. The full rules are in `BUILD_SPEC.md` §7 and §15;
`content/phys2/u3/l2.yaml` is the reference lesson — match its quality.

## Workflow

1. Add the lesson to `content/<subject>/subject.yaml` (it shows as "Coming soon" until a file exists).
2. Write `content/<subject>/u<N>/l<M>.yaml`. The id inside must match the path.
3. Add any new misconceptions to `content/<subject>/misconceptions.yaml`.
4. Run `npm run content:check` until it reports **0 errors**. Treat warnings as todo items.
5. `npm run dev` rebuilds content on save; play the lesson at both extremes (a fresh profile gets
   easier variants; `tests/e2e/unit-playthrough.spec.ts` shows how to seed a high rating).

## Shape of a lesson

- **Intro** ≤ 300 words, every symbol defined with its unit, one idea per paragraph.
- **One worked example**, with numbers that appear in no param set.
- **Exactly 6 core steps**, each with `easier` / `standard` / `harder` (difficulties strictly
  increasing; `standard` 2–4 and non-decreasing through the chain, roughly 2, 2, 3, 3, 4, 4).
- **≥ 1 remediation step** (`remediates: sN`), optionally a bonus step.
- **One challenge** with 3 variants, a machine-checked `solution` for each, and ≥ 3 `feedback` rules.

## The chain

- One scenario through the whole lesson (one circuit, one function, one array).
- `uses` points back (shows "↩ builds on Qn"), `clueFor` points forward (authoring aid).
- ≥ 2 `uses` links and ≥ 1 `clueFor` link; the last core step uses ≥ 2 steps.
- Every core step has `establishes` (a short fact for the Facts panel — the same fact for all
  three variants). Steps with `uses` need `standaloneContext` for review mode.
- Refer to earlier steps by description ("the series circuit from before"), not only "Q3".

## Questions

- Exactly 4 options, exactly 1 correct, and 3 wrong options that are each a **real mistake**,
  tagged with **3 different** misconception ids.
- Computed options: `answer` + 3 `distractors`, each an `expr` from the mistake's actual wrong
  formula — never a hand-typed number. They are shown sorted ascending.
- Static options are shuffled unless `fixedOrder: true`. No "all/none of the above".
- Prompts ≤ 80 words. Avoid "NOT"; if unavoidable, only in `harder`, in **bold**.
- `easier` scaffolds (gives an intermediate value); `harder` adds a twist, not bigger numbers.
- Symbolic answers (calculus, linear algebra) need `verify` pairs.

## Explanations (mandatory template)

```
**Answer:** …
**Why:** 3–8 short lines with the real numbers substituted
**Common mistakes:**
- <option> — <the mistake behind it>
- …
**Connects to:** <earlier and/or later step>
```

## Hints

- `nudge`: a question or pointer — never a formula with numbers substituted.
- `buildsOn`: optional; otherwise generated from `uses` + the Facts panel.
- `partial`: about half the work, never the final answer.

## Numbers and templates

- `{{ expression }}` is evaluated with mathjs over params + derived, and formatted to 3
  significant figures (exact integers below 10⁵ stay exact).
- Prefer `params: { sets: [...] }` with clean numbers. The validator checks every set: all
  templates must evaluate and all 4 options must display differently.
- LaTeX goes in `|` blocks or single-quoted strings. In double-quoted strings, backslashes are
  escapes — use Unicode (Ω, ×, ÷, μ) there, or write `\\` for a single backslash.
- SI units; Ω and μ as Unicode; vectors bold or with arrows.

## Challenges

- `circuit-builder`: battery fixed down column 0. Solutions are a `netlist`
  (`"R1 n1 n2 [valueExpr]"`, node `0` = battery −), laid out automatically, or `grid` edits
  (`add` / `remove`) on a `preset` circuit. Check scope: `I`, `Req`, `Ptot`, `n`, `isShort`,
  `isOpen`, and `I_<label>`, `V_<label>`, `P_<label>` per part.
- `transient-plotter`: RC/RL curves with sliders. Scope: `R`, `C`, `L`, `V`, `tau`, and the
  functions `frac_at(t)`, `y_at(t)`, `V_at(t)`, `I_at(t)`.
- `near(a, b, rel = 0.01)` is available in every check and feedback expression.
