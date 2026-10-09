
/**
 * Firebase Client Configuration
 * Read from the NEXT_PUBLIC_FIREBASE_* environment variables (.env / .env.local).
 *
 * There is deliberately no fallback. Missing values used to fall back to the
 * live (production) project, so a misconfigured local or test run would
 * silently read and write production data. It now fails loudly instead.
 *
 * Each variable is referenced by its literal name: Next.js only inlines
 * process.env.NEXT_PUBLIC_* into the browser bundle when written out in full.
 */
const values = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

const ENV_NAMES: Record<keyof typeof values, string> = {
  projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
  apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
};

const missing = (Object.keys(values) as (keyof typeof values)[])
  .filter((key) => !values[key])
  .map((key) => ENV_NAMES[key]);

if (missing.length > 0) {
  throw new Error(
    `Firebase is not configured. Missing environment variable(s): ${missing.join(', ')}. ` +
    'Add them to .env.local (see .env.example). There is no fallback to the live project.'
  );
}

export const firebaseConfig = values as { [K in keyof typeof values]: string };
