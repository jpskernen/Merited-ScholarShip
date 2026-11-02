#!/usr/bin/env node

require('dotenv').config();

const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const SANDBOX_PROJECT_ID = 'scholarship-dev-7ddad';
const PROFILE_ROLE = { org_admin: 'admin', reviewer: 'reviewer', applicant: 'applicant' };

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

function init() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.');
  }
  if (projectId !== SANDBOX_PROJECT_ID && process.env.MIGRATE_ALLOW_PROJECT !== projectId) {
    throw new Error('Refusing to run against "' + projectId + '": only the sandbox (' + SANDBOX_PROJECT_ID + ') is allowed. ' +
      'For a deliberate production run set MIGRATE_ALLOW_PROJECT=' + projectId + ' after taking a backup.');
  }
  if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return { projectId, db: getFirestore(), auth: getAuth() };
}

const mask = (email) => (email ? email.replace(/^(.).*(@.*)$/, '$1***$2') : '(no email)');

async function listAllUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const platformAdmins = new Set((arg('--platform-admin') || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
  const { projectId, db, auth } = init();

  console.log('Role claims backfill: ' + (apply ? 'APPLY (writes enabled)' : 'DRY RUN (nothing is written)'));
  console.log('Project: ' + projectId + '   Run at: ' + new Date().toISOString());
  console.log('Platform admin(s): ' + (platformAdmins.size ? [...platformAdmins].map(mask).join(', ') : '(none)'));

  const accounts = await listAllUsers(auth);
  const [admins, reviewers, profiles] = await Promise.all([
    db.collection('roles_admin').get(),
    db.collection('reviewers').get(),
    db.collection('users').get(),
  ]);
  const adminIds = new Set(admins.docs.map((d) => d.id));
  const reviewerIds = new Set(reviewers.docs.map((d) => d.id));
  const profileById = new Map(profiles.docs.map((d) => [d.id, d.data()]));

  const plans = [];
  const warnings = [];
  for (const account of accounts) {
    const email = (account.email || '').toLowerCase();
    const profile = profileById.get(account.uid);
    const role = adminIds.has(account.uid) ? 'org_admin' : reviewerIds.has(account.uid) ? 'reviewer' : 'applicant';
    const platformAdmin = platformAdmins.has(email);
    const orgId = profile && (profile.organizationId || profile.schoolId);

    const claimedRole = (profile && String(profile.role || '').toLowerCase()) || '';
    if (role === 'applicant' && ['admin', 'reviewer', 'sponsor'].includes(claimedRole)) {
      warnings.push(mask(email) + ': users.role says "' + profile.role + '" but there is no role document, so the account gets applicant');
    }
    if (!orgId) {
      warnings.push(mask(email) + ': no organization on users/' + account.uid + ', skipped (run migrate-org-ids.js first)');
      continue;
    }

    const current = account.customClaims || {};
    const next = { ...current, orgId, role };
    if (platformAdmin) next.platformAdmin = true;
    const claimsChange = current.orgId !== orgId || current.role !== role || (platformAdmin && current.platformAdmin !== true);
    const profileRole = PROFILE_ROLE[role];
    const profileChange = !profile || profile.role !== profileRole;

    plans.push({ account, email, orgId, role, platformAdmin, next, claimsChange, profileRole, profileChange, oldProfileRole: profile ? profile.role : undefined });
  }

  console.log('\nACCOUNTS (' + accounts.length + ')');
  console.log('  email                      role        orgId               platform  claims   users.role');
  for (const p of plans) {
    console.log('  ' + mask(p.email).padEnd(26) + ' ' + p.role.padEnd(11) + ' ' + p.orgId.padEnd(19) + ' ' +
      (p.platformAdmin ? 'yes' : '-').padEnd(9) + ' ' + (p.claimsChange ? 'SET' : 'ok').padEnd(8) + ' ' +
      (p.profileChange ? String(p.oldProfileRole) + ' -> ' + p.profileRole : 'ok'));
  }
  for (const email of platformAdmins) {
    if (!plans.some((p) => p.email === email)) warnings.push('platform admin ' + mask(email) + ' has no account (or no organization)');
  }

  const invites = [];
  for (const name of ['invites', 'admin_invites']) {
    const snap = await db.collection(name).get();
    for (const d of snap.docs) if (d.data().tempPassword !== undefined) invites.push({ name, ref: d.ref, id: d.id });
  }
  console.log('\nINVITES WITH A PLAIN-TEXT tempPassword: ' + invites.length + (invites.length ? ' (the field will be removed)' : ''));
  for (const i of invites) console.log('  ' + i.name + '/' + i.id);

  if (warnings.length) {
    console.log('\nWARNINGS');
    for (const w of warnings) console.log('  ' + w);
  }

  const claimChanges = plans.filter((p) => p.claimsChange).length;
  const profileChanges = plans.filter((p) => p.profileChange).length;
  console.log('\nSUMMARY: ' + claimChanges + ' claim update(s), ' + profileChanges + ' users.role update(s), ' + invites.length + ' tempPassword removal(s).');

  if (!apply) {
    console.log('DRY RUN complete. Nothing was written. Re-run with --apply to make these changes.');
    return;
  }

  for (const p of plans) {
    if (p.claimsChange) await auth.setCustomUserClaims(p.account.uid, p.next);
    if (p.profileChange) await db.collection('users').doc(p.account.uid).set({ role: p.profileRole, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  for (const i of invites) await i.ref.update({ tempPassword: FieldValue.delete() });

  console.log('\nAPPLIED. Verifying...');
  const after = await listAllUsers(auth);
  const withClaims = after.filter((u) => u.customClaims && u.customClaims.orgId && u.customClaims.role).length;
  let left = 0;
  for (const name of ['invites', 'admin_invites']) {
    left += (await db.collection(name).get()).docs.filter((d) => d.data().tempPassword !== undefined).length;
  }
  console.log('  accounts with orgId + role claims: ' + withClaims + ' / ' + after.length);
  console.log('  platform admins: ' + after.filter((u) => u.customClaims && u.customClaims.platformAdmin).map((u) => mask(u.email)).join(', '));
  console.log('  invites still holding tempPassword: ' + left);
  console.log('Users get the new claims on their next token refresh: sign out and back in.');
}

main().then(
  () => process.exit(0),
  (err) => { console.error('\nERROR: ' + err.message); process.exit(1); }
);
