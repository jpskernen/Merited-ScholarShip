#!/usr/bin/env node
/**
 * Truncates the SANDBOX Firestore database so a test run starts from a known
 * empty state. Test tooling only — touches no application code.
 *
 * Deletes every document in every top-level collection, including all
 * subcollections. Firebase Auth accounts are NEVER touched — your logins all
 * survive, they simply have no users/{uid} profile document afterwards until
 * the app recreates one.
 *
 *   node scripts/truncate-db.js            # dry run — lists what would go
 *   node scripts/truncate-db.js --yes      # actually delete
 *
 * Separate mode, Firestore left alone — deletes the Auth accounts that have no
 * users/{uid} document, freeing their emails for signup again:
 *
 *   node scripts/truncate-db.js --orphaned-auth        # dry run
 *   node scripts/truncate-db.js --orphaned-auth --yes  # actually delete
 *
 * By default the admin's own two documents are PRESERVED (not deleted, and not
 * recreated — nothing is ever written by this script), so /admin keeps working
 * instead of throwing permission-denied. Pass --no-keep-admin to wipe those too.
 *
 * Safety: refuses to run against the live project (scholarship-hib4j).
 * Override only if you know exactly what you are doing: ALLOW_LIVE=1.
 */
require('dotenv').config();

const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const LIVE_PROJECT_ID = 'scholarship-hib4j';
const ADMIN_EMAIL = 'admin@test.com';

function init() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.'
    );
  }
  if (projectId === LIVE_PROJECT_ID && process.env.ALLOW_LIVE !== '1') {
    throw new Error(
      'Refusing to truncate "' + projectId + '" — that is the live project. ' +
        'Point FIREBASE_PROJECT_ID at your sandbox first.'
    );
  }

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return { projectId, db: getFirestore(), auth: getAuth() };
}

/** uid of the account whose admin documents are spared, or null. */
async function resolveAdminUid(auth, keepAdmin) {
  if (!keepAdmin) return null;
  try {
    const user = await auth.getUserByEmail(ADMIN_EMAIL);
    return user.uid;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    console.log('  note: no Auth account for ' + ADMIN_EMAIL + ', nothing to preserve\n');
    return null;
  }
}

/**
 * Firebase Auth and Firestore are separate stores: truncating Firestore leaves
 * every login intact, so the email stays taken and signup fails with
 * auth/email-already-in-use. This deletes the Auth accounts that no longer have
 * a users/{uid} document behind them, which frees those emails to sign up again.
 * Accounts that still have a profile document are never touched.
 */
async function deleteOrphanedAuth({ db, auth, apply }) {
  const userDocs = await db.collection('users').get();
  const haveDoc = new Set(userDocs.docs.map((d) => d.id));

  const { users } = await auth.listUsers(1000);
  const orphans = users.filter((u) => !haveDoc.has(u.uid));

  console.log('  Firestore users docs:  ' + userDocs.size);
  console.log('  Firebase Auth accounts: ' + users.length);
  console.log('  Orphaned (no profile):  ' + orphans.length + '\n');

  for (const u of orphans) {
    console.log('  ' + (apply ? 'deleted ' : 'would delete ') + (u.email || u.uid));
    if (apply) await auth.deleteUser(u.uid);
  }

  const keptList = users.filter((u) => haveDoc.has(u.uid)).map((u) => u.email || u.uid);
  if (keptList.length) console.log('\n  kept (has a profile document): ' + keptList.join(', '));

  console.log('\n' + (apply ? 'Deleted ' : 'Would delete ') + orphans.length + ' Auth accounts.');
  console.log('Firestore: untouched.');
  if (!apply) console.log('\nNothing was changed. Re-run with --yes to apply.');
}

(async () => {
  const { projectId, db, auth } = init();
  const apply = process.argv.includes('--yes');
  const keepAdmin = !process.argv.includes('--no-keep-admin');

  console.log('\nProject: ' + projectId);
  console.log(apply ? 'Mode:    DELETING\n' : 'Mode:    dry run — pass --yes to actually delete\n');

  // Separate mode: cleans up Auth only, leaves Firestore alone.
  if (process.argv.includes('--orphaned-auth')) {
    await deleteOrphanedAuth({ db, auth, apply });
    process.exit(0);
  }

  const adminUid = await resolveAdminUid(auth, keepAdmin);

  // Documents spared from deletion. Nothing here is written or modified —
  // they are simply skipped, so the admin keeps the access it already has.
  const preserve = adminUid ? { users: [adminUid], roles_admin: [adminUid] } : {};

  const collections = await db.listCollections();
  let deleted = 0;
  let kept = 0;

  for (const col of collections) {
    const spared = preserve[col.id] || [];
    const snap = await col.get();

    if (!spared.length) {
      console.log('  ' + col.id.padEnd(24) + snap.size + ' docs -> delete all (with subcollections)');
      if (apply) await db.recursiveDelete(col);
      deleted += snap.size;
      continue;
    }

    const targets = snap.docs.filter((d) => !spared.includes(d.id));
    const sparedHere = snap.size - targets.length;
    console.log(
      '  ' + col.id.padEnd(24) + snap.size + ' docs -> delete ' + targets.length +
        ', keep ' + sparedHere + ' (admin)'
    );
    if (apply) {
      for (const d of targets) await db.recursiveDelete(d.ref);
    }
    deleted += targets.length;
    kept += sparedHere;
  }

  console.log('\n' + (apply ? 'Deleted ' : 'Would delete ') + deleted + ' documents' +
    (kept ? ', kept ' + kept + ' (admin access)' : ''));
  console.log('Auth accounts: untouched.');
  if (!apply) console.log('\nNothing was changed. Re-run with --yes to apply.');
  process.exit(0);
})().catch((err) => {
  console.error('\nFailed: ' + err.message + '\n');
  process.exit(1);
});
