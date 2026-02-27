/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZERO_CACHE_URL: string
  readonly VITE_ENABLE_ORGANIZATION_PROVIDER_KEYS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
