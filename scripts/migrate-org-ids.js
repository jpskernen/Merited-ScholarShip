#!/usr/bin/env node
/**
 * Organization foundation migration (runbook T3, docs/08 §7).
 *
 *  1. Creates organizations/{orgId} and organizations/{orgId}/config/settings
 *     (with defaults) for every organization ID found in the data.
 *  2. Backfills `organizationId` on users, programs, applications,
 *     applications/{id}/reviews, recommendationTokens, invites and admin_invites.
 *
 * Only FILLS IN a missing organizationId. It never overwrites an existing value
 * and never deletes anything. Conflicts and orphans are reported, not changed.
 * Idempotent: a second --apply run changes nothing.
 *
 * Where each organizationId comes from:
 *   programs, users, invites -> their legacy schoolId, else --default-org
 *   applications             -> the scholarship's (programs) organization, else the student's
 *   reviews                  -> the parent application
 *   recommendationTokens     -> the application the token belongs to
 *
 *   node scripts/migrate-org-ids.js                     # dry run: report only, writes nothing
 *   node scripts/migrate-org-ids.js --apply             # write the changes
 *   node scripts/migrate-org-ids.js --org-name "ABC University"
 *   node scripts/migrate-org-ids.js --default-org <id>  # for records with no org at all
 *
 * Safety: refuses to run against anything but the sandbox (scholarship-dev-7ddad).
 * For the production release (docs/08 §8) set MIGRATE_ALLOW_PROJECT=<project id>
 * to the exact project ID, after taking a Firestore export.
 */
require('dotenv').config();

const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const SANDBOX_PROJECT_ID = 'scholarship-dev-7ddad';

// Keep in sync with DEFAULT_ORG_SETTINGS in src/lib/org.ts.
const DEFAULT_ORG_SETTINGS = {
  branding: { displayName: '', logoPath: null, primaryColor: null },
  email: { senderName: null, replyTo: null },
  rubricTemplates: [
    {
      id: 'default',
      name: 'Standard',
      criteria: [
        { id: 'academic', label: 'Academic Achievement', description: 'Consider GPA and course difficulty', weight: 30 },
        { id: 'essay', label: 'Essay Quality', description: 'Evaluate clarity and authenticity', weight: 25 },
        { id: 'financial', label: 'Financial Need', description: 'Based on submitted financial information', weight: 20 },
        { id: 'community', label: 'Community Service', description: 'Volunteer work and extracurriculars', weight: 15 },
        { id: 'recommendation', label: 'Recommendation Strength', description: 'Quality of recommendation letters', weight: 10 },
      ],
    },
  ],
  retention: { draftInactiveMonths: null, decidedApplicationMonths: null, tokenDays: 30, emailBodyDays: null },
  features: { recommendationsRequired: true, maxRecommenders: 2, aiFitAnalysis: false },
};

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function init() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.');
  }
  if (projectId !== SANDBOX_PROJECT_ID && process.env.MIGRATE_ALLOW_PROJECT !== projectId) {
    throw new Error(
      'Refusing to migrate "' + projectId + '": only the sandbox (' + SANDBOX_PROJECT_ID + ') is allowed. ' +
        'For a deliberate production run set MIGRATE_ALLOW_PROJECT=' + projectId + ' after taking a backup.'
    );
  }
  if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return { projectId, db: getFirestore() };
}

const short = (id) => (id.length > 24 ? id.slice(0, 10) + '…' + id.slice(-8) : id);

async function load(db) {
  const all = async (ref) => (await ref.get()).docs.map((d) => ({ ref: d.ref, id: d.id, data: d.data() }));
  const [users, programs, applications, tokens, invites, adminInvites, reviewsAll] = await Promise.all([
    all(db.collection('users')),
    all(db.collection('programs')),
    all(db.collection('applications')),
    all(db.collection('recommendationTokens')),
    all(db.collection('invites')),
    all(db.collection('admin_invites')),
    all(db.collectionGroup('reviews')),
  ]);
  // Only reviews under applications/{id}. Legacy reviews under users/** are reported, not migrated.
  const reviews = reviewsAll.filter((r) => r.ref.parent.parent && r.ref.parent.parent.parent.id === 'applications');
  const legacyReviews = reviewsAll.length - reviews.length;
  return { users, programs, applications, tokens, invites, adminInvites, reviews, legacyReviews };
}

function counts(data) {
  const c = (list) => ({ total: list.length, withOrg: list.filter((d) => d.data.organizationId).length });
  return {
    users: c(data.users),
    programs: c(data.programs),
    applications: c(data.applications),
    reviews: c(data.reviews),
    recommendationTokens: c(data.tokens),
    invites: c(data.invites),
    admin_invites: c(data.adminInvites),
  };
}

function printCounts(title, c) {
  console.log('\n' + title);
  console.log('  collection             with organizationId / total');
  for (const [name, { total, withOrg }] of Object.entries(c)) {
    const pct = total ? Math.round((withOrg / total) * 100) : 100;
    console.log('  ' + name.padEnd(22) + String(withOrg).padStart(4) + ' / ' + String(total).padEnd(4) + ' (' + pct + '%)');
  }
}

function plan(data, defaultOrg) {
  const updates = []; // { ref, collection, id, orgId, reason }
  const conflicts = [];
  const orphans = [];
  const unresolved = [];

  const set = (collection, doc, orgId, reason) => {
    if (!orgId) {
      unresolved.push({ collection, id: doc.id, reason: 'no organization could be determined' });
      return;
    }
    updates.push({ ref: doc.ref, collection, id: doc.id, orgId, reason });
    doc.data.organizationId = orgId; // so later steps see the planned value
  };

  // 1. Records that carry the legacy schoolId themselves.
  for (const [collection, list] of [['programs', data.programs], ['users', data.users], ['invites', data.invites], ['admin_invites', data.adminInvites]]) {
    for (const doc of list) {
      if (doc.data.organizationId) continue;
      if (doc.data.schoolId) set(collection, doc, doc.data.schoolId, 'from schoolId');
      else set(collection, doc, defaultOrg, defaultOrg ? 'no schoolId -> --default-org' : '');
    }
  }

  // 2. Applications take the scholarship's organization.
  const programOrg = new Map(data.programs.map((p) => [p.id, p.data.organizationId]));
  const userOrg = new Map(data.users.map((u) => [u.id, u.data.organizationId]));
  for (const app of data.applications) {
    const fromProgram = programOrg.get(app.data.scholarshipId);
    if (app.data.organizationId) {
      if (fromProgram && fromProgram !== app.data.organizationId) {
        conflicts.push({ collection: 'applications', id: app.id, has: app.data.organizationId, scholarshipOrg: fromProgram });
      }
      continue;
    }
    if (fromProgram) set('applications', app, fromProgram, 'from scholarship');
    else set('applications', app, userOrg.get(app.data.studentId), 'no scholarship -> from student');
  }

  // 3. Reviews and tokens take their application's organization.
  const appOrg = new Map(data.applications.map((a) => [a.id, a.data.organizationId]));
  for (const review of data.reviews) {
    if (review.data.organizationId) continue;
    set('reviews', review, appOrg.get(review.ref.parent.parent.id), 'from parent application');
  }
  for (const token of data.tokens) {
    if (token.data.organizationId) continue;
    if (!appOrg.has(token.data.applicationId)) {
      orphans.push({ collection: 'recommendationTokens', id: token.id, applicationId: token.data.applicationId });
      continue;
    }
    set('recommendationTokens', token, appOrg.get(token.data.applicationId), 'from application');
  }

  return { updates, conflicts, orphans, unresolved };
}

async function organizationsPlan(db, orgIds, orgName) {
  const toCreate = [];
  for (const orgId of orgIds) {
    const orgRef = db.collection('organizations').doc(orgId);
    const settingsRef = orgRef.collection('config').doc('settings');
    const [orgSnap, settingsSnap] = await Promise.all([orgRef.get(), settingsRef.get()]);
    toCreate.push({ orgId, orgRef, settingsRef, createOrg: !orgSnap.exists, createSettings: !settingsSnap.exists, orgName });
  }
  return toCreate;
}

// Report-only: the old duplicate organizations/{orgId}/scholarships path (docs/07 D3, runbook 4.3).
async function duplicateScholarshipsReport(db, orgIds, programs) {
  const byId = new Map(programs.map((p) => [p.id, p.data]));
  const report = [];
  for (const orgId of orgIds) {
    const snap = await db.collection('organizations').doc(orgId).collection('scholarships').get();
    for (const d of snap.docs) {
      const copy = d.data();
      const program = byId.get(d.id);
      if (!program) { report.push({ orgId, id: d.id, issue: 'copy exists, but no programs/' + d.id }); continue; }
      const differs = ['name', 'amount', 'deadline', 'description'].filter((f) => JSON.stringify(copy[f]) !== JSON.stringify(program[f]));
      const rubricDiffers = JSON.stringify(copy.rubric) !== JSON.stringify(program.rubric);
      const reviewersDiffer = JSON.stringify(copy.reviewerIds || []) !== JSON.stringify(program.reviewerIds || []);
      if (rubricDiffers) differs.push('rubric');
      if (reviewersDiffer) differs.push('reviewerIds');
      report.push({ orgId, id: d.id, issue: differs.length ? 'OUT OF SYNC: ' + differs.join(', ') : 'in sync' });
    }
  }
  return report;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const orgName = arg('--org-name', 'Merited Scholarships');
  const defaultOrg = arg('--default-org', process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || null);
  const { projectId, db } = init();

  console.log('Organization migration: ' + (apply ? 'APPLY (writes enabled)' : 'DRY RUN (nothing is written)'));
  console.log('Project: ' + projectId + '   Run at: ' + new Date().toISOString());
  console.log('Default org for records with no org at all: ' + (defaultOrg || '(none)'));

  const data = await load(db);
  printCounts('BEFORE', counts(data));

  const { updates, conflicts, orphans, unresolved } = plan(data, defaultOrg);

  const orgIds = new Set([...updates.map((u) => u.orgId)]);
  for (const list of [data.users, data.programs, data.applications]) for (const d of list) if (d.data.organizationId) orgIds.add(d.data.organizationId);
  const orgs = await organizationsPlan(db, [...orgIds].sort(), orgName);

  console.log('\nORGANIZATIONS');
  for (const o of orgs) {
    console.log('  ' + o.orgId + ': organization doc ' + (o.createOrg ? 'WILL BE CREATED ("' + o.orgName + '")' : 'exists') +
      ', config/settings ' + (o.createSettings ? 'WILL BE CREATED (defaults)' : 'exists'));
  }

  console.log('\nPLANNED organizationId BACKFILL (' + updates.length + ')');
  for (const u of updates) console.log('  ' + u.collection.padEnd(21) + short(u.id).padEnd(22) + ' -> ' + u.orgId + '  (' + u.reason + ')');

  if (conflicts.length) {
    console.log('\nCONFLICTS: application org differs from its scholarship org (NOT changed, review by hand)');
    for (const c of conflicts) console.log('  ' + short(c.id) + ' has ' + c.has + ', scholarship says ' + c.scholarshipOrg);
  }
  if (orphans.length) {
    console.log('\nORPHANS: recommendation tokens whose application does not exist (NOT changed)');
    for (const o of orphans) console.log('  token ' + short(o.id) + ' -> application ' + o.applicationId);
  }
  if (unresolved.length) {
    console.log('\nUNRESOLVED: no organization could be determined (NOT changed)');
    for (const u of unresolved) console.log('  ' + u.collection + ' ' + short(u.id));
  }
  if (data.legacyReviews) console.log('\nNOTE: ' + data.legacyReviews + ' legacy review(s) under users/** were not migrated.');

  const dup = await duplicateScholarshipsReport(db, [...orgIds], data.programs);
  console.log('\nDUPLICATE organizations/{orgId}/scholarships COPIES (report only, nothing changed; removal = runbook 4.3)');
  if (!dup.length) console.log('  none');
  for (const d of dup) console.log('  ' + d.orgId + '/scholarships/' + d.id + ': ' + d.issue);

  if (!apply) {
    console.log('\nDRY RUN complete. Nothing was written. Re-run with --apply to make these changes.');
    return;
  }

  // ---- writes -----------------------------------------------------------
  let batch = db.batch();
  let pending = 0;
  const flush = async () => { if (pending) { await batch.commit(); batch = db.batch(); pending = 0; } };
  const queue = async (fn) => { fn(batch); pending++; if (pending >= 400) await flush(); };

  for (const o of orgs) {
    if (o.createOrg) {
      await queue((b) => b.set(o.orgRef, {
        id: o.orgId, name: o.orgName, status: 'active',
        createdAt: FieldValue.serverTimestamp(), createdBy: 'scripts/migrate-org-ids.js',
      }));
    }
    if (o.createSettings) {
      const settings = JSON.parse(JSON.stringify(DEFAULT_ORG_SETTINGS));
      settings.branding.displayName = o.orgName;
      await queue((b) => b.set(o.settingsRef, { ...settings, updatedAt: FieldValue.serverTimestamp() }));
    }
  }
  for (const u of updates) await queue((b) => b.update(u.ref, { organizationId: u.orgId }));
  await flush();

  console.log('\nAPPLIED: ' + orgs.filter((o) => o.createOrg).length + ' organization(s), ' +
    orgs.filter((o) => o.createSettings).length + ' settings doc(s), ' + updates.length + ' organizationId backfill(s).');

  printCounts('AFTER', counts(await load(db)));
}

main().then(
  () => process.exit(0),
  (err) => { console.error('\nERROR: ' + err.message); process.exit(1); }
);
