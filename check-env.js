/**
 * Build-time environment variable check.
 * This script ensures all required Firebase variables are set before building.
 */
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('\x1b[31m%s\x1b[0m', 'BUILD ERROR: Missing required environment variables:');
  missingVars.forEach((varName) => console.error(` - ${varName}`));
  console.error('\nAction Required: Update your environment variables or .env file before building.');
  process.exit(1);
}

console.log('\x1b[32m%s\x1b[0m', '✓ Environment validation passed.');
