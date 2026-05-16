/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZERO_CACHE_URL: string
  readonly VITE_ENABLE_EMBEDDING?: string
  readonly ENABLE_EMBEDDING?: string
  readonly VITE_ENABLE_ORGANIZATION_PROVIDER_KEYS?: string
  readonly ENABLE_ORGANIZATION_PROVIDER_KEYS?: string
  readonly VITE_SINGULARITY_ORG_ID?: string
  readonly SINGULARITY_ORG_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
