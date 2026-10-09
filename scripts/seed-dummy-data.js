#!/usr/bin/env node
/**
 * Seeds one dummy scholarship + one dummy student into the SANDBOX Firebase
 * project, so the end-to-end flows in docs/05-TESTING-CHECKLIST.md have
 * something to run against.
 *
 * This is test tooling, not application code. It is idempotent: re-running it
 * overwrites the same fixed document ids rather than piling up duplicates.
 *
 *   node scripts/seed-dummy-data.js                    # scholarship + student
 *   node scripts/seed-dummy-data.js --with-application # also opens a Draft application
 *   node scripts/seed-dummy-data.js --clean            # delete everything it created
 *
 * Safety: refuses to run against the live project (scholarship-hib4j).
 * Override only if you know exactly what you are doing: ALLOW_LIVE=1.
 */
require('dotenv').config();

const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const LIVE_PROJECT_ID = 'scholarship-hib4j';

// --- fixtures -------------------------------------------------------------
const ORG_ID = 'scholarship-hib4j'; // the org every record is filed under in-app
const SCHOLARSHIP_ID = 'dummy-scholarship';
const STUDENT_EMAIL = 'dummy.student@example.com';
const STUDENT_PASSWORD = 'DummyStudent123!';

const SCHOLARSHIP = {
  name: 'Dummy Test Scholarship',
  amount: '$5,000',
  deadline: 'December 31, 2026',
  tags: ['Test Data', 'STEM', 'Undergraduate'],
  description:
    'A throwaway scholarship used only for end-to-end testing of the application, recommendation and review flows. Not a real award.',
  organizationId: ORG_ID,
  schoolId: ORG_ID,
  reviewerIds: [],
  prompts: [
    {
      id: 'personal-statement',
      title: 'Personal Statement',
      description: 'Tell us about your background and goals.',
    },
    {
      id: 'challenge',
      title: 'Overcoming a Challenge',
      description: 'Describe a challenge you have overcome and what you learned from it.',
    },
  ],
  rubric: [
    { id: 'academic', label: 'Academic Achievement', description: 'Consider GPA and course difficulty', weight: 30 },
    { id: 'essay', label: 'Essay Quality', description: 'Evaluate clarity and authenticity', weight: 25 },
    { id: 'financial', label: 'Financial Need', description: 'Based on submitted financial information', weight: 20 },
    { id: 'community', label: 'Community Service', description: 'Volunteer work and extracurriculars', weight: 15 },
    { id: 'recommendation', label: 'Recommendation Strength', description: 'Quality of recommendation letters', weight: 10 },
  ],
};

const STUDENT_PROFILE = {
  name: 'Dummy Student',
  email: STUDENT_EMAIL,
  secondaryEmail: '',
  address: '123 Test Lane, Austin, TX 78701',
  gpa: 3.75,
  major: 'Computer Science',
  school: 'Dummy High School',
  interests: 'Robotics, debate, volunteering at the public library',
  role: 'applicant',
  schoolId: ORG_ID,
  organizationId: ORG_ID,
};

// --- plumbing -------------------------------------------------------------
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
      'Refusing to seed test data into "' + projectId + '" — that is the live project. ' +
        'Point FIREBASE_PROJECT_ID at your sandbox first.'
    );
  }

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return { projectId, db: getFirestore(), auth: getAuth() };
}

async function ensureStudent(auth) {
  try {
    const existing = await auth.getUserByEmail(STUDENT_EMAIL);
    await auth.updateUser(existing.uid, {
      password: STUDENT_PASSWORD,
      displayName: STUDENT_PROFILE.name,
      emailVerified: true,
    });
    return { uid: existing.uid, created: false };
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const created = await auth.createUser({
      email: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
      displayName: STUDENT_PROFILE.name,
      emailVerified: true,
    });
    return { uid: created.uid, created: true };
  }
}

async function seed({ db, auth, withApplication }) {
  const now = FieldValue.serverTimestamp();

  // 1. Scholarship — written to both paths, exactly like /admin/scholarships/new does.
  const scholarshipDoc = Object.assign({}, SCHOLARSHIP, { createdAt: now, updatedAt: now });
  await db.collection('programs').doc(SCHOLARSHIP_ID).set(scholarshipDoc, { merge: true });
  await db
    .collection('organizations').doc(ORG_ID)
    .collection('scholarships').doc(SCHOLARSHIP_ID)
    .set(scholarshipDoc, { merge: true });
  console.log('  scholarship  programs/' + SCHOLARSHIP_ID + '  "' + SCHOLARSHIP.name + '"');

  // 2. Student — Auth account plus the users/{uid} profile the app reads.
  const { uid, created } = await ensureStudent(auth);
  await db.collection('users').doc(uid).set(
    Object.assign({ id: uid }, STUDENT_PROFILE, { createdAt: now, updatedAt: now }),
    { merge: true }
  );
  console.log(
    '  student      users/' + uid + '  ' + STUDENT_EMAIL +
      '  (auth account ' + (created ? 'created' : 'updated') + ')'
  );

  // 3. Optional draft application for that pair.
  if (withApplication) {
    const appId = uid + '_' + SCHOLARSHIP_ID;
    await db.collection('applications').doc(appId).set(
      {
        id: appId,
        studentId: uid,
        scholarshipId: SCHOLARSHIP_ID,
        scholarshipName: SCHOLARSHIP.name,
        organizationId: ORG_ID,
        essay: '',
        qualificationStatement: '',
        activities: 'Robotics club captain, debate team, library volunteer',
        essays: [],
        documents: [],
        status: 'Draft',
        submissionDate: null,
        recommendationStatus1: 'Not Requested',
        recommendationStatus2: 'Not Requested',
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    console.log('  application  applications/' + appId + '  (Draft)');
  }

  console.log('\nSign in as:  ' + STUDENT_EMAIL + ' / ' + STUDENT_PASSWORD);
}

async function clean({ db, auth }) {
  await db.collection('programs').doc(SCHOLARSHIP_ID).delete();
  await db.collection('organizations').doc(ORG_ID).collection('scholarships').doc(SCHOLARSHIP_ID).delete();
  console.log('  deleted scholarship ' + SCHOLARSHIP_ID);

  try {
    const user = await auth.getUserByEmail(STUDENT_EMAIL);
    const apps = await db.collection('applications').where('studentId', '==', user.uid).get();
    for (const d of apps.docs) {
      await d.ref.delete();
      console.log('  deleted application ' + d.id);
    }
    await db.collection('users').doc(user.uid).delete();
    await auth.deleteUser(user.uid);
    console.log('  deleted student ' + STUDENT_EMAIL);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    console.log('  student ' + STUDENT_EMAIL + ' not present, nothing to delete');
  }
}

(async () => {
  const { projectId, db, auth } = init();
  const isClean = process.argv.includes('--clean');
  console.log('\n' + (isClean ? 'Cleaning' : 'Seeding') + ' project: ' + projectId + '\n');

  if (isClean) await clean({ db, auth });
  else await seed({ db, auth, withApplication: process.argv.includes('--with-application') });

  console.log('\nDone.');
  process.exit(0);
})().catch((err) => {
  console.error('\nFailed: ' + err.message + '\n');
  process.exit(1);
});
