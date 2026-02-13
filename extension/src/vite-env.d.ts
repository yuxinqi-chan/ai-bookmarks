/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly WORKER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
