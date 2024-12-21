/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_DATABASE_URL: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_MEASUREMENT_ID: string
  readonly VITE_XIRSYS_USERNAME: string
  readonly VITE_XIRSYS_CREDENTIAL: string
  readonly VITE_XIRSYS_IDENT: string
  readonly VITE_XIRSYS_SECRET: string
  readonly VITE_XIRSYS_CHANNEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 