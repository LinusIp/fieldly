# Decisions

One line each: date — decision — reason.

- 2026-10-14 — Product name is **Fieldly**, `APP_KEY` is `fieldly:` — the spec's working title is "rename freely" and the repo is `fieldly`.
- 2026-10-14 — TypeScript pinned to 6.0.3, not 7.x — `typescript-eslint` 8.71 supports `<6.1`; TS 7 would break linting.
- 2026-10-14 — React Router 8 (`react-router` package, `HashRouter`) instead of `react-router-dom` — in v7+ `react-router-dom` only re-exports `react-router`.
- 2026-10-14 — Tailwind CSS v4 via `@tailwindcss/vite`, theme colours as CSS variables mapped with `@theme inline` — v4 is current stable and needs no PostCSS config.
- 2026-10-14 — Deploy workflow uses the current majors: checkout@v7, setup-node@v7, setup-python@v7, upload-pages-artifact@v5, deploy-pages@v5 — §6.3 asks to bump to latest majors.
- 2026-10-14 — `build` also runs `tsc --noEmit` — Vite does not type-check, and `strict: true` should be enforced in CI.
- 2026-10-14 — Exact integers below 1e5 print exactly (12345 → "12345"); everything else goes to 3 significant figures — §7.4 says "integers printed as integers", and rounding counts like 1024 to 1020 would be wrong.
- 2026-10-14 — Negative numbers use the Unicode minus "−" in text and "-" inside KaTeX — typographically correct in both places.
- 2026-10-14 — Each challenge type is split into a React-free `logic.ts` (schemas, `resolveConfig`, scopes) and a component — the Node validator must import the logic without React or DOM.
- 2026-10-14 — Challenge `config` holds expression strings; each type's `resolveConfig` turns them into numbers/text before the component sees them — §9.1 says the component receives "templates and expressions already resolved".
- 2026-10-14 — `subject.yaml` gains optional `background` (free-text prerequisites such as "algebra") and `tools` — §16 lists non-subject prerequisites that cannot be subject ids.
- 2026-10-14 — Lesson `prerequisites` default to the previous lesson in the subject (crossing unit boundaries) — §16 says "previous lesson in the unit"; the first lesson of a unit then points at the end of the previous unit.
- 2026-10-14 — "Standard difficulties are non-decreasing" (§2.5) is enforced as a validator error — it is stated as a rule, not a guideline.
- 2026-10-14 — Lesson YAML is parsed with merge keys (`<<: *anchor`) enabled — lets authors reuse blocks without copy-paste.
- 2026-10-14 — A lesson file with validator errors is emitted but marked unavailable ("Coming soon") in the index — `content:build` fails anyway in CI; in watch mode the rest of the site keeps working.
- 2026-10-14 — Lesson player, review, profile and settings are lazy route chunks — keeps mathjs, KaTeX and Markdown out of the initial JS budget (§4).
- 2026-10-14 — `AttemptState` gains `sequence` (ordered step ids incl. inserted steps), `factSteps`, `firstInSubject`, `ratingsBefore`, `lessonVersion`, `skippedSteps`, `startedAt` — §12's shape cannot place inserted steps or show rating change per concept without them.
- 2026-10-14 — Partial answers (first wrong pick, hints opened) are saved immediately — a refresh must not reset attempts or hints.
- 2026-10-14 — Remediation is inserted after 2 misses when its `remediates` is one of the two missed steps or the next core step — §2.1 says "for the missed step"; the next-step case lets r1 prepare s3 after misses on s1–s2.
- 2026-10-14 — When a step has no `uses` and no authored `buildsOn`, the hint ladder has 2 tiers and `partial` still counts as tier 3 for scoring — `partial` is the half-solution tier whatever its position.
- 2026-10-14 — Variant selection uses the spec's numbers unchanged: at the initial rating 1000, `easier` (p ≈ 0.70) is closest to 0.78, so new students start on easier variants and move up as ratings rise — §3.1/§3.2 are explicit.
- 2026-10-14 — The challenge has its own seed derived from the attempt seed (`seed ^ 0x5bd1e995`) when it declares its own params — one stored seed reproduces both.
- 2026-10-14 — Circuit builder: elements occupy one grid segment; the battery is fixed down column 0 (+ top, − bottom) — simplest snap-grid model; solution netlists are auto-laid-out on the grid and verified by re-solving.
- 2026-10-14 — The `?debug=1` hook is compiled only when `import.meta.env.DEV` or `VITE_DEBUG_HOOK=true` (the `build:e2e` mode) — e2e runs against `vite preview` of that build; the Pages build has neither.
