# Decisions

One line each: date — decision — reason.

- 2026-10-14 — Product name is **Fieldly**, `APP_KEY` is `fieldly:` — the spec's working title is "rename freely" and the repo is `fieldly`.
- 2026-10-14 — TypeScript pinned to 6.0.3, not 7.x — `typescript-eslint` 8.71 supports `<6.1`; TS 7 would break linting.
- 2026-10-14 — React Router 8 (`react-router` package, `HashRouter`) instead of `react-router-dom` — in v7+ `react-router-dom` only re-exports `react-router`.
- 2026-10-14 — Tailwind CSS v4 via `@tailwindcss/vite`, theme colours as CSS variables mapped with `@theme inline` — v4 is current stable and needs no PostCSS config.
- 2026-10-14 — Deploy workflow uses the current majors: checkout@v7, setup-node@v7, setup-python@v7, upload-pages-artifact@v5, deploy-pages@v5 — §6.3 asks to bump to latest majors.
- 2026-10-14 — `build` also runs `tsc --noEmit` — Vite does not type-check, and `strict: true` should be enforced in CI.
