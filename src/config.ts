// Single place for the product name and storage namespace. Rename freely.
export const APP_NAME = 'Fieldly';

// Every localStorage key is prefixed with this, because all of a user's GitHub project pages
// share the origin <user>.github.io.
export const APP_KEY = 'fieldly:';

export const DEFAULTS = {
  subjectRating: 1000,
  theme: 'system' as 'system' | 'light' | 'dark',
  fontScale: 1,
  reducedMotion: false,
  codeLang: 'python' as 'python' | 'javascript',
};

/**
 * Parts of the product that exist so far (§14 builds them phase by phase). Path-map nodes and
 * navigation for a feature that isn't built yet show "Coming soon" instead of a dead link.
 */
export const FEATURES = {
  lessonPlayer: false,
  practice: false,
  puzzles: false,
  sandbox: false,
};

/** Pinned Pyodide release, loaded from the CDN only when a Python code challenge runs. */
export const PYODIDE_VERSION = '314.0.7';
export const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
