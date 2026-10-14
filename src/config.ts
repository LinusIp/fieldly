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
