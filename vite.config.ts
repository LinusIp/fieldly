import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Project pages live at https://<user>.github.io/<repo>/, so the base path comes from the
// environment (set by the deploy workflow). Locally it defaults to "/".
const base = process.env.BASE_PATH ?? '/';

export default defineConfig(({ mode }) => ({
  root: import.meta.dirname,
  // The ?debug=1 test hook is compiled in only for dev, test and e2e builds; in the Pages
  // build this is the literal `false` and the minifier removes the hook entirely.
  define: { __DEBUG_HOOK__: JSON.stringify(mode !== 'production') },
  base,
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
  },
}));
