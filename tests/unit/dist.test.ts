import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * §13.3: the debug API is compiled out of the production build. Builds the app in production mode
 * into a temporary directory and checks that no emitted file mentions the hook.
 */
const ROOT = join(import.meta.dirname, '..', '..');
const out = mkdtempSync(join(tmpdir(), 'fieldly-dist-'));

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
}

afterAll(() => rmSync(out, { recursive: true, force: true }));

describe('production build', () => {
  it('contains no debug hook', { timeout: 180_000 }, async () => {
    await build({
      root: ROOT,
      configFile: join(ROOT, 'vite.config.ts'),
      mode: 'production',
      logLevel: 'silent',
      publicDir: false,
      build: { outDir: out, emptyOutDir: true },
    });
    const js = files(out).filter((f) => /\.(js|html)$/.test(f));
    expect(js.length).toBeGreaterThan(0);
    for (const f of js) {
      const text = readFileSync(f, 'utf8');
      expect(text.includes('__fieldlyDebug'), f).toBe(false);
      expect(text.includes('answerCurrent'), f).toBe(false);
    }
  });
});
