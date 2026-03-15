/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_MODE?: string;
  readonly VITE_NAV_TITLE?: string;
  readonly VITE_NAV_DESC?: string;
  readonly VITE_GITHUB_TOKEN?: string;
  readonly VITE_GITHUB_OWNER?: string;
  readonly VITE_GITHUB_REPO?: string;
  readonly VITE_GITHUB_PATH?: string;
  readonly VITE_OPENAI_KEY?: string;
  readonly VITE_OPENAI_BASE_URL?: string;
  readonly VITE_OPENAI_MODEL?: string;
  readonly VITE_DEFAULT_THEME?: 'light' | 'dark' | 'system';
  readonly VITE_DEFAULT_LANG?: 'zh' | 'en';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
