import { describe, expect, it } from 'vitest';
import { APP_KEY, APP_NAME } from '../../src/config';

describe('config', () => {
  it('namespaces storage keys', () => {
    expect(APP_NAME.length).toBeGreaterThan(0);
    expect(APP_KEY.endsWith(':')).toBe(true);
  });
});
