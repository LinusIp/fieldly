/// <reference types="vite/client" />

declare const __DEBUG_HOOK__: boolean;

interface ImportMetaEnv {}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
