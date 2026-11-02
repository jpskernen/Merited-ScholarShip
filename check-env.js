

const fs = require('fs');
const path = require('path');


function readDotEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return {};
  const out = {};
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

const dotEnv = readDotEnv();
const read = (name) => process.env[name] || dotEnv[name] || '';

const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
];

// Values still carrying the text from the example files.
const placeholder = /REPLACE-ME|YOUR_[A-Z_]*_HERE|^your-|example\.com$/i;

const errors = [];
const warnings = [];

for (const name of requiredEnvVars) {
  const value = read(name);
  if (!value) errors.push(`${name} is not set.`);
  else if (placeholder.test(value)) errors.push(`${name} still holds a placeholder: "${value}".`);
}


const appUrl = read('NEXT_PUBLIC_APP_URL');
if (appUrl && placeholder.test(appUrl)) {
  errors.push(
    `NEXT_PUBLIC_APP_URL still holds a placeholder: "${appUrl}". Put the real address of the deployed site in apphosting.yaml.`
  );
} else if (!appUrl) {
  warnings.push(
    'NEXT_PUBLIC_APP_URL is not set. Email buttons are left out and links fall back to the host of each request.'
  );
}

for (const warning of warnings) {
  console.warn('\x1b[33m%s\x1b[0m', `! ${warning}`);
}

if (errors.length) {
  console.error('\x1b[31m%s\x1b[0m', '\u2717 Environment validation failed:');
  for (const error of errors) console.error('\x1b[31m%s\x1b[0m', `  - ${error}`);
  console.error(
    '\x1b[31m%s\x1b[0m',
    '  Set these in .env for a local build, or in apphosting.yaml for the deployed site.'
  );
  process.exit(1);
}

console.log('\x1b[32m%s\x1b[0m', '\u2713 Environment validation passed.');
