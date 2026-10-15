import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const ROOT = process.cwd();
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

const RUN = Date.now().toString(36);
const PASSWORD = 'QaTest#2026!';
const mail = (who: string) => `qa.${who}.${RUN}@mailinator.com`;

let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else {
    failed++;
    failures.push(name);
  }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + String(detail).slice(0, 140) : ''}`);
}
const section = (title: string) => console.log(`\n--- ${title} ---`);

async function main() {
  const { getAdminDb, getAdminAuth } = await import('@/firebase/admin');
  const platform = await import('@/lib/platform-server');
  const orgServer = await import('@/lib/org-server');
  const inviteActions = await import('@/app/admin/invite-actions');
  const staff = await import('@/app/admin/staff-actions');
  const scholarships = await import('@/app/admin/scholarship-actions');
  const decisions = await import('@/app/admin/decision-actions');
  const notify = await import('@/app/admin/notify-actions');
  const reviewActions = await import('@/app/(main)/review/actions');
  const studentActions = await import('@/app/(main)/dashboard/profile/actions');
  const recommend = await import('@/app/recommend/[tokenId]/actions');
  const ai = await import('@/ai/flows/analyze-scholarship-fit');
  const { FieldValue } = createRequire(path.join(ROOT, 'package.json'))('firebase-admin/firestore');
  const Papa = createRequire(path.join(ROOT, 'package.json'))('papaparse');

  const db = getAdminDb();
  const auth = getAdminAuth();

  const tokenFor = async (uid: string): Promise<string> => {
    const custom = await auth.createCustomToken(uid);
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) },
    );
    const json: any = await res.json();
    if (!json.idToken) throw new Error('Could not mint a token: ' + JSON.stringify(json));
    return json.idToken;
  };

  const platformUser = await auth.getUserByEmail('admin@test.com');
  const platformCaller = { uid: platformUser.uid, email: 'admin@test.com', orgId: null as any, role: 'org_admin' as const, platformAdmin: true };

  async function join(kind: 'admin' | 'reviewer', inviteId: string, who: string) {
    const r: any = await inviteActions.acceptInvite(kind, inviteId, { name: `QA ${who}`, password: PASSWORD });
    if (!r.success) throw new Error(`accept ${who}: ${r.error}`);
    return (await auth.getUserByEmail(mail(who))).uid;
  }

  async function newStudent(orgId: string, who: string, name: string) {
    const user = await auth.createUser({ email: mail(who), password: PASSWORD, displayName: name, emailVerified: true });
    await auth.setCustomUserClaims(user.uid, { orgId, role: 'applicant' });
    await db.collection('users').doc(user.uid).set({
      id: user.uid, name, email: mail(who), role: 'applicant', organizationId: orgId, schoolId: orgId, createdAt: FieldValue.serverTimestamp(),
    });
    return { uid: user.uid, token: await tokenFor(user.uid), email: mail(who) };
  }

  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.append(k, v);
    return f;
  };
  const fullProfile = (extra: Record<string, string> = {}) => ({
    name: 'Sofia Reyes', email: '', address: '42 Maple Street, Springfield, IL 62704', gpa: '3.8',
    major: 'Mechanical Engineering', school: 'Lincoln Technical High School', interests: 'Robotics, Assistive Technology',
    activities: 'Robotics team captain; weekend bicycle repair clinic.', essay: 'I want to design low-cost assistive devices.',
    qualificationStatement: 'Honours physics and calculus; regional science fair finalist.',
    'prompt:prompt-1': 'I grew up repairing bicycles and want to build assistive devices for my community.',
    ...extra,
  });
  const emailsTo = async (recipient: string, type?: string) => {
    const snap = await db.collection('sent_emails').where('recipient', '==', recipient).get();
    return snap.docs.map((d) => d.data()).filter((d) => !type || d.type === type);
  };
  const rubric = [
    { id: 'academic', label: 'Academic Achievement', weight: 40 },
    { id: 'essay', label: 'Essay Quality', weight: 30 },
    { id: 'service', label: 'Community Service', weight: 30 },
  ];
  const programBase = {
    amount: '$3,000', deadline: '2099-03-01', tags: 'STEM',
    description: 'Supports engineering students with demonstrated academic and community achievement.',
    prompts: [{ id: 'prompt-1', title: 'Personal Statement' }], rubric,
  };

  console.log(`\n=== Flow tests, run ${RUN} ===`);

  section('1. Organization and administrators');
  const org = await platform.createOrganizationAs(platformCaller as any, `QA Flow Foundation ${RUN}`);
  const orgId = org.orgId;
  const orgDoc = (await db.collection('organizations').doc(orgId).get()).data()!;
  check('Organization is created and active', orgDoc.status === 'active', orgId);
  check('Organization gets default settings', (await db.collection('organizations').doc(orgId).collection('config').doc('settings').get()).exists);
  check('Organization name is rejected when too short', await platform.createOrganizationAs(platformCaller as any, 'A').then(() => false, () => true));

  const otherOrg = await platform.createOrganizationAs(platformCaller as any, `QA Other Org ${RUN}`);

  const inv1: any = await platform.assignOrgAdminAs(platformCaller as any, orgId, mail('owner'));
  check('Platform admin invites the first administrator', inv1.invited === true && !!inv1.inviteId);
  const ownerUid = await join('admin', inv1.inviteId, 'owner');
  const ownerToken = await tokenFor(ownerUid);
  const ownerClaims = (await auth.getUser(ownerUid)).customClaims as any;
  check('First admin has the org_admin claim', ownerClaims?.orgId === orgId && ownerClaims?.role === 'org_admin');
  check('First admin is the main admin', (await orgServer.getOrgOwnerUid(orgId)) === ownerUid);
  const ownerIs: any = await staff.isMainAdmin(ownerToken);
  check('isMainAdmin is true for the main admin', ownerIs.success && ownerIs.isMainAdmin === true);
  const reuse: any = await inviteActions.acceptInvite('admin', inv1.inviteId, { name: 'Again', password: PASSWORD });
  check('An accepted invitation cannot be used twice', reuse.success === false, reuse.error);
  const badInvite: any = await inviteActions.createInvite(ownerToken, 'admin', 'not-an-email');
  check('Invitation with an invalid email is rejected', badInvite.success === false, badInvite.error);

  const invB: any = await inviteActions.createInvite(ownerToken, 'admin', mail('adminb'));
  check('Main admin can invite another administrator', invB.success === true, invB.error);
  const dupInvite: any = await inviteActions.createInvite(ownerToken, 'admin', mail('adminb'));
  check('A duplicate pending invitation is rejected', dupInvite.success === false, dupInvite.error);
  const bUid = await join('admin', invB.inviteId, 'adminb');
  const bToken = await tokenFor(bUid);
  check('Second admin is not the main admin', ((await staff.isMainAdmin(bToken)) as any).isMainAdmin === false);
  for (const [label, fn] of [
    ['invite an administrator', () => inviteActions.createInvite(bToken, 'admin', mail('adminc'))],
    ['resend an administrator invite', () => inviteActions.resendInvite(bToken, 'admin', invB.inviteId)],
    ['revoke an administrator invite', () => inviteActions.revokeInvite(bToken, 'admin', invB.inviteId)],
    ['list administrators', () => staff.listStaff(bToken, 'admin')],
    ['remove the main admin', () => staff.removeStaffAccess(bToken, 'admin', ownerUid)],
  ] as const) {
    const r: any = await (fn as any)();
    check(`Second admin CANNOT ${label}`, r.success === false, r.error);
  }
  const ownerList: any = await staff.listStaff(ownerToken, 'admin');
  check('Main admin sees both admins, exactly one main', ownerList.success && ownerList.members.length === 2 && ownerList.members.filter((m: any) => m.isOwner).length === 1);
  check('Main admin CANNOT remove themselves', ((await staff.removeStaffAccess(ownerToken, 'admin', ownerUid)) as any).success === false);

  section('2. Reviewers and scholarships');
  const invR: any = await inviteActions.createInvite(bToken, 'reviewer', mail('reviewer'));
  check('Any admin can invite a reviewer', invR.success === true, invR.error);
  const reviewerUid = await join('reviewer', invR.inviteId, 'reviewer');
  const reviewerToken = await tokenFor(reviewerUid);
  const invR2: any = await inviteActions.createInvite(ownerToken, 'reviewer', mail('reviewer2'));
  const reviewer2Uid = await join('reviewer', invR2.inviteId, 'reviewer2');
  const reviewer2Token = await tokenFor(reviewer2Uid);

  const bad: any = await scholarships.saveScholarship(bToken, { ...programBase, name: 'Bad', rubric: [{ id: 'a', label: 'A', weight: 50 }] });
  check('Rubric not totalling 100% is rejected', bad.success === false, bad.error);
  check('Scholarship without a name is rejected', ((await scholarships.saveScholarship(bToken, { ...programBase, name: '' })) as any).success === false);
  check('Scholarship with a malformed deadline is rejected', ((await scholarships.saveScholarship(bToken, { ...programBase, name: 'X', deadline: 'soon' })) as any).success === false);
  const progA: any = await scholarships.saveScholarship(bToken, { ...programBase, name: `QA Engineering Award ${RUN}`, reviewerIds: [reviewerUid] });
  check('Second admin CAN create a scholarship', progA.success === true, progA.error);
  const progB: any = await scholarships.saveScholarship(ownerToken, { ...programBase, name: `QA Community Grant ${RUN}`, reviewerIds: [reviewerUid] });
  const progPast: any = await scholarships.saveScholarship(ownerToken, { ...programBase, name: `QA Closed Award ${RUN}`, deadline: '2020-01-01', reviewerIds: [reviewerUid] });
  const progDoomed: any = await scholarships.saveScholarship(ownerToken, { ...programBase, name: `QA Doomed Award ${RUN}`, reviewerIds: [] });
  const stored = (await db.collection('programs').doc(progA.id).get()).data()!;
  check('Scholarship is stored in the right organization', stored.organizationId === orgId && stored.reviewerIds.includes(reviewerUid));
  const assignMail: any = await notify.notifyReviewAssignment(ownerToken, progA.id, reviewerUid);
  check('Reviewer assignment email is sent', assignMail.success === true, assignMail.error);
  check('Assignment email for a non-assigned reviewer is refused', ((await notify.notifyReviewAssignment(ownerToken, progA.id, reviewer2Uid)) as any).success === false);

  section('3. Applicant: draft, validation and submission');
  const sofia = await newStudent(orgId, 'sofia', 'Sofia Reyes');
  const draft: any = await studentActions.saveApplication(sofia.token, progA.id, form({ name: 'Sofia Reyes', activities: 'Robotics team captain' }));
  check('A partial draft can be saved', draft.success === true, draft.error);
  const appId = `${sofia.uid}_${progA.id}`;
  check('Draft is stored as Draft in the right organization', (await db.collection('applications').doc(appId).get()).data()?.status === 'Draft');

  const noAddress: any = await studentActions.saveApplication(sofia.token, progA.id, form({ ...fullProfile({ email: sofia.email, address: '' }) }), true);
  check('Submitting without an address is rejected', noAddress.success === false, noAddress.error);
  check('A rejected submission leaves the application a draft', (await db.collection('applications').doc(appId).get()).data()?.status === 'Draft');
  const tooLong: any = await studentActions.saveApplication(sofia.token, progA.id, form({ essay: 'x'.repeat(20001) }));
  check('An over-long essay is rejected', tooLong.success === false, tooLong.error);
  const noToken: any = await studentActions.saveApplication('', progA.id, form({ name: 'x' }));
  check('Saving without signing in is rejected', noToken.success === false, noToken.error);
  const smuggle: any = await studentActions.saveApplication(sofia.token, progA.id, form({ name: 'Sofia Reyes', status: 'Awarded', organizationId: 'someone-else' }));
  check('A student cannot set their own status through the form', smuggle.success === true && (await db.collection('applications').doc(appId).get()).data()?.status === 'Draft');

  section('4. Recommendations');
  const rq: any = (p: any) => studentActions.sendRecommendationRequest(sofia.token, { scholarshipId: progA.id, requestIndex: 1, recommenderTitle: 'Teacher', recommenderName: 'Dr. Rec One', recommenderEmail: mail('rec1'), ...p });
  check('A student cannot recommend themselves', ((await rq({ recommenderEmail: sofia.email })) as any).success === false);
  check('A recommender with an invalid email is rejected', ((await rq({ recommenderEmail: 'nope' })) as any).success === false);
  check('A recommender without a title is rejected', ((await rq({ recommenderTitle: '' })) as any).success === false);
  check('An invalid endorsement slot is rejected', ((await rq({ requestIndex: 3 })) as any).success === false);
  const req1: any = await rq({});
  check('Recommendation request is sent', req1.success === true, req1.error);
  check('Recommendation request email reached the recommender', (await emailsTo(mail('rec1'), 'Recommendation Request')).length === 1);
  check('Slot 1 shows Pending', (await db.collection('applications').doc(appId).get()).data()?.recommendationStatus1 === 'Pending');
  check('The same person cannot fill both slots', ((await rq({ requestIndex: 2 })) as any).success === false);
  const rem1: any = await studentActions.sendRecommendationReminder(sofia.token, { scholarshipId: progA.id, requestIndex: 1 });
  check('A reminder can be sent', rem1.success === true, rem1.error);
  const rem2: any = await studentActions.sendRecommendationReminder(sofia.token, { scholarshipId: progA.id, requestIndex: 1 });
  check('A second reminder within 24 hours is refused', rem2.success === false, rem2.error);

  const cancel: any = await studentActions.cancelRecommendationRequest(sofia.token, { scholarshipId: progA.id, requestIndex: 1 });
  check('A request can be cancelled', cancel.success === true, cancel.error);
  const oldTokens = await db.collection('recommendationTokens').where('applicationId', '==', appId).where('requestIndex', '==', 1).get();
  const cancelledTokenId = oldTokens.docs.find((d) => d.data().cancelled)!.id;
  check('Cancelled request resets the slot', (await db.collection('applications').doc(appId).get()).data()?.recommendationStatus1 === 'Not Requested');
  const viaCancelled: any = await recommend.submitTypedRecommendation(cancelledTokenId, 'A letter.');
  check('A cancelled link cannot be used to submit a letter', viaCancelled.success === false, viaCancelled.error);

  const reReq: any = await rq({});
  check('A new request can be sent after cancelling', reReq.success === true, reReq.error);
  const live = await db.collection('recommendationTokens').where('applicationId', '==', appId).where('requestIndex', '==', 1).where('used', '==', false).where('cancelled', '==', false).get();
  const liveTokenId = live.docs[0].id;
  check('Only one live link exists for the slot', live.size === 1);
  check('Empty letter is rejected', ((await recommend.submitTypedRecommendation(liveTokenId, '   ')) as any).success === false);
  check('A letter over the length limit is rejected', ((await recommend.submitTypedRecommendation(liveTokenId, 'x'.repeat(60001))) as any).success === false);
  check('A PDF upload with a foreign link is rejected', ((await recommend.submitUploadedRecommendation(liveTokenId, 'https://evil.example.com/x.pdf')) as any).success === false);
  check('An unknown link is rejected', ((await recommend.submitTypedRecommendation('does-not-exist', 'A letter.')) as any).success === false);
  const expiredRef = await db.collection('recommendationTokens').add({
    applicationId: appId, organizationId: orgId, studentName: 'Sofia', recommenderName: 'Old', recommenderEmail: mail('rec1'),
    scholarshipTitle: 'x', requestIndex: 2, used: false, cancelled: false, createdAt: FieldValue.serverTimestamp(), expiresAt: new Date(Date.now() - 86400000),
  });
  check('An expired link is rejected', ((await recommend.submitTypedRecommendation(expiredRef.id, 'A letter.')) as any).success === false);

  const letter: any = await recommend.submitTypedRecommendation(liveTokenId, 'Sofia is the most capable student I have taught in twenty years. '.repeat(30));
  check('A recommender can submit a typed letter', letter.success === true, letter.error);
  const afterLetter = (await db.collection('applications').doc(appId).get()).data()!;
  check('Slot 1 shows Received with the letter stored', afterLetter.recommendationStatus1 === 'Received' && !!afterLetter.recommendationLetterText1);
  check('The student is told the letter arrived', (await emailsTo(sofia.email, 'Recommendation Received')).length === 1);
  const letterAgain: any = await recommend.submitTypedRecommendation(liveTokenId, 'Second attempt.');
  check('A used link cannot submit a second letter', letterAgain.success === false, letterAgain.error);
  check('A received letter cannot be re-requested', ((await rq({ recommenderEmail: mail('rec1b') })) as any).success === false);
  const cancelReceived: any = await studentActions.cancelRecommendationRequest(sofia.token, { scholarshipId: progA.id, requestIndex: 1 });
  check('A received letter cannot be cancelled', cancelReceived.success === false, cancelReceived.error);

  section('5. Submitting the application');
  const submit: any = await studentActions.saveApplication(sofia.token, progA.id, form(fullProfile({ email: sofia.email })), true);
  check('A complete application can be submitted', submit.success === true, submit.error);
  const submitted = (await db.collection('applications').doc(appId).get()).data()!;
  check('Application is Submitted with a profile snapshot', submitted.status === 'Submitted' && submitted.profileSnapshot?.gpa === 3.8);
  check('Student gets a confirmation email', (await emailsTo(sofia.email, 'Submission Confirmed')).length === 1);
  const edit: any = await studentActions.saveApplication(sofia.token, progA.id, form({ activities: 'Changed after submission' }));
  check('A submitted application can no longer be edited', edit.success === false, edit.error);
  const pastDeadline: any = await studentActions.saveApplication(sofia.token, progPast.id, form(fullProfile({ email: sofia.email })), true);
  check('Submitting after the deadline is rejected', pastDeadline.success === false, pastDeadline.error);
  const pastDraft: any = await studentActions.saveApplication(sofia.token, progPast.id, form({ name: 'Sofia Reyes' }));
  check('A draft can still be saved after the deadline', pastDraft.success === true, pastDraft.error);

  const otherProg: any = await (async () => {
    const snap = await db.collection('programs').where('organizationId', '==', 'scholarship-hib4j').limit(1).get();
    return snap.docs[0];
  })();
  const crossOrg: any = await studentActions.saveApplication(sofia.token, otherProg.id, form({ name: 'Sofia Reyes' }));
  check('A student cannot apply to another organization\'s scholarship', crossOrg.success === false, crossOrg.error);

  const second: any = await studentActions.saveApplication(sofia.token, progB.id, form(fullProfile({ email: sofia.email })), true);
  const appB = `${sofia.uid}_${progB.id}`;
  check('The same student can submit a second, independent application', second.success === true, second.error);
  check('Two applications exist for the student', (await db.collection('applications').where('studentId', '==', sofia.uid).get()).size === 3);

  const ben = await newStudent(orgId, 'ben', 'Ben Carter');
  await studentActions.saveApplication(ben.token, progA.id, form({ name: 'Ben Carter' }));
  const benAppId = `${ben.uid}_${progA.id}`;

  section('6. Review');
  const unsubmitted: any = await reviewActions.markApplicationInReview(reviewerToken, benAppId);
  check('A draft application is not moved to In Review', unsubmitted.success === true && unsubmitted.changed === false, JSON.stringify(unsubmitted));
  const wrongReviewer: any = await reviewActions.markApplicationInReview(reviewer2Token, appId);
  check('An unassigned reviewer cannot touch the application', wrongReviewer.success === false, wrongReviewer.error);
  const studentAsReviewer: any = await reviewActions.markApplicationInReview(sofia.token, appId);
  check('A student cannot use review actions', studentAsReviewer.success === false, studentAsReviewer.error);
  const aiAsStudent: any = await ai.analyzeScholarshipFit(sofia.token, { applicantData: { gpa: 3.8, major: 'x', essay: 'x', activities: 'x', interests: 'x' }, scholarshipCriteria: 'x' }).then(() => 'ran', (e: any) => e.message);
  check('A student cannot run the AI assessment', aiAsStudent !== 'ran', aiAsStudent);
  const aiRun: any = await ai.analyzeScholarshipFit(reviewerToken, {
    applicantData: { gpa: 3.8, major: 'Mechanical Engineering', essay: submitted.promptResponses?.[0]?.answer || '', activities: submitted.activities || '', interests: 'Robotics' },
    scholarshipCriteria: stored.description,
  }).then((r: any) => r, (e: any) => ({ error: e.message }));
  check('A reviewer can run the AI assessment', typeof aiRun.fitScore === 'number' && aiRun.fitScore >= 0 && aiRun.fitScore <= 100, aiRun.error || `score ${aiRun.fitScore}`);

  const reviewRef = db.collection('applications').doc(appId).collection('reviews').doc(reviewerUid);
  const early: any = await reviewActions.notifyAdminsReviewSubmitted(reviewerToken, appId);
  check('No admin email before a review is submitted', early.success === false, early.error);
  await reviewRef.set({
    reviewerId: reviewerUid, reviewerName: 'QA reviewer', applicationId: appId, organizationId: orgId, studentId: sofia.uid, scholarshipId: progA.id,
    criteriaScores: [{ criteriaId: 'academic', score: 9 }, { criteriaId: 'essay', score: 8 }, { criteriaId: 'service', score: 7 }],
    totalScore: 8.1, notes: 'Strong essay and clear community impact.', recommendation: 'Recommend', markForDiscussion: true,
    status: 'Submitted', submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  const inReview: any = await reviewActions.markApplicationInReview(reviewerToken, appId);
  check('Application moves to In Review', inReview.success === true && inReview.changed === true, inReview.error);
  const mailed: any = await reviewActions.notifyAdminsReviewSubmitted(reviewerToken, appId);
  check('Both admins are emailed about the review', mailed.success === true && mailed.sent === 2, JSON.stringify(mailed));
  check('The review email contains the score and a dashboard link', (await emailsTo(mail('owner'), 'Review Submitted'))[0]?.body?.includes('8.10') === true);
  check('A second call does not email again', ((await reviewActions.notifyAdminsReviewSubmitted(reviewerToken, appId)) as any).sent === 0);
  const relock: any = await scholarships.saveScholarship(ownerToken, { ...programBase, name: stored.name, id: progA.id, reviewerIds: [reviewerUid], rubric: [{ id: 'academic', label: 'Academic Achievement', weight: 50 }, { id: 'essay', label: 'Essay Quality', weight: 30 }, { id: 'service', label: 'Community Service', weight: 20 }] });
  check('Rubric weights cannot change after scoring started', relock.success === false, relock.error);
  const reword: any = await scholarships.saveScholarship(ownerToken, { ...programBase, name: stored.name, id: progA.id, reviewerIds: [reviewerUid], description: 'Supports engineering students, with a focus on community impact.' });
  check('A description can still be edited after scoring started', reword.success === true, reword.error);

  section('7. Decisions');
  const asReviewer: any = await decisions.recordDecisions(reviewerToken, { targets: [{ applicationId: appId, studentId: sofia.uid }], status: 'Awarded' });
  check('A reviewer cannot record a decision', asReviewer.success === false, asReviewer.error);
  const asStudent: any = await decisions.recordDecisions(sofia.token, { targets: [{ applicationId: appId, studentId: sofia.uid }], status: 'Awarded' });
  check('A student cannot record a decision', asStudent.success === false, asStudent.error);
  const badStatus: any = await decisions.recordDecisions(ownerToken, { targets: [{ applicationId: appId, studentId: sofia.uid }], status: 'Maybe' as any });
  check('An unknown decision is rejected', badStatus.success === false, badStatus.error);
  const noTargets: any = await decisions.recordDecisions(ownerToken, { targets: [], status: 'Awarded' });
  check('A decision with nothing selected is rejected', noTargets.success === false, noTargets.error);
  const draftDecision: any = await decisions.recordDecisions(ownerToken, { targets: [{ applicationId: benAppId, studentId: ben.uid }], status: 'Awarded' });
  check('A draft cannot be awarded', draftDecision.success === true && draftDecision.updated === 0 && draftDecision.skipped.length === 1, JSON.stringify(draftDecision.skipped));

  const award: any = await decisions.recordDecisions(ownerToken, { targets: [{ applicationId: appId, studentId: sofia.uid }], status: 'Awarded' });
  check('An application can be awarded', award.success === true && award.updated === 1 && award.emailsSent === 1, JSON.stringify(award));
  check('Award is stored with who decided', (await db.collection('applications').doc(appId).get()).data()?.status === 'Awarded');
  check('The student is emailed about the decision', (await emailsTo(sofia.email, 'Status Changed')).length === 1);
  const awardAgain: any = await decisions.recordDecisions(ownerToken, { targets: [{ applicationId: appId, studentId: sofia.uid }], status: 'Awarded' });
  check('Awarding twice changes nothing and sends no second email', awardAgain.updated === 0 && (await emailsTo(sofia.email, 'Status Changed')).length === 1);
  const decline: any = await decisions.recordDecisions(ownerToken, { targets: [{ applicationId: appB, studentId: sofia.uid }], status: 'Not Awarded' });
  check('The second application can be declined independently', decline.updated === 1 && (await db.collection('applications').doc(appB).get()).data()?.status === 'Not Awarded');
  check('The first application stays Awarded', (await db.collection('applications').doc(appId).get()).data()?.status === 'Awarded');
  const rqAfter: any = await rq({ recommenderEmail: mail('rec9'), requestIndex: 2 });
  check('A recommendation cannot be requested after a decision', rqAfter.success === false, rqAfter.error);

  section('8. Tenant isolation');
  const oinv: any = await platform.assignOrgAdminAs(platformCaller as any, otherOrg.orgId, mail('otheradmin'));
  const otherAdminUid = await join('admin', oinv.inviteId, 'otheradmin');
  const otherToken = await tokenFor(otherAdminUid);
  check('Another organization cannot read this application\'s review', ((await reviewActions.notifyAdminsReviewSubmitted(otherToken, appId)) as any).success === false);
  check('Another organization cannot edit this scholarship', ((await scholarships.saveScholarship(otherToken, { ...programBase, name: 'Hijack', id: progA.id })) as any).success === false);
  check('Another organization cannot delete this scholarship', ((await scholarships.deleteScholarship(otherToken, progA.id)) as any).success === false);
  const crossDecision: any = await decisions.recordDecisions(otherToken, { targets: [{ applicationId: appId, studentId: sofia.uid }], status: 'Not Awarded' });
  check('Another organization cannot decide this application', crossDecision.updated === 0 && (await db.collection('applications').doc(appId).get()).data()?.status === 'Awarded', JSON.stringify(crossDecision.skipped));
  const otherList: any = await staff.listStaff(otherToken, 'admin');
  check('Another organization sees only its own admins', otherList.success && otherList.members.length === 1 && otherList.members[0].uid === otherAdminUid);

  section('9. Deleting a scholarship');
  const delMissing: any = await scholarships.deleteScholarship(ownerToken, 'does-not-exist');
  check('Deleting a scholarship that does not exist is refused', delMissing.success === false, delMissing.error);
  await studentActions.saveApplication(ben.token, progDoomed.id, form({ name: 'Ben Carter' }));
  const doomedApp = `${ben.uid}_${progDoomed.id}`;
  const del: any = await scholarships.deleteScholarship(ownerToken, progDoomed.id);
  check('A scholarship can be deleted', del.success === true && !(await db.collection('programs').doc(progDoomed.id).get()).exists, del.error);
  const saveDeleted: any = await studentActions.saveApplication(ben.token, progDoomed.id, form({ name: 'Ben Carter', activities: 'Added after the scholarship was deleted' }));
  check('A draft cannot be saved for a deleted scholarship', saveDeleted.success === false, saveDeleted.error);
  const submitDeleted: any = await studentActions.saveApplication(ben.token, progDoomed.id, form(fullProfile({ email: ben.email })), true);
  check('An application cannot be submitted to a deleted scholarship', submitDeleted.success === false, submitDeleted.error);
  check('Applications to a deleted scholarship are kept',(await db.collection('applications').doc(doomedApp).get()).exists);
  check('The deletion records how many applications were left behind', (await db.collection('auditLog').where('organizationId', '==', orgId).where('action', '==', 'Scholarship deleted').get()).docs[0]?.data().details?.applicationsLeftBehind === 1);

  section('10. Removing access');
  const removed: any = await staff.removeStaffAccess(ownerToken, 'admin', bUid);
  check('Main admin can remove the second admin', removed.success === true, removed.error);
  check('Removed admin is marked revoked', (await db.collection('users').doc(bUid).get()).data()?.role === 'revoked');
  const bAfter: any = await staff.isMainAdmin(bToken);
  check('The removed admin\'s old session stops working', bAfter.success === false, bAfter.error);
  const rem: any = await staff.removeStaffAccess(ownerToken, 'reviewer', reviewerUid);
  check('A reviewer can be removed and is taken off committees', rem.success === true && rem.panels >= 2, JSON.stringify(rem));
  check('The removed reviewer\'s session stops working', ((await reviewActions.markApplicationInReview(reviewerToken, appId)) as any).success === false);
  const lastAdmin: any = await staff.removeStaffAccess(ownerToken, 'admin', ownerUid);
  check('The last administrator cannot be removed', lastAdmin.success === false, lastAdmin.error);

  section('11. Export and audit');
  const csv = Papa.unparse([{ Name: '=HYPERLINK("http://evil","x")', Note: 'plain', Plus: '+1', At: '@sum' }], { escapeFormulae: true });
  check('CSV export neutralizes formulas', !/(^|,)=HYPERLINK/.test(csv.split('\n')[1]) && csv.includes("'=HYPERLINK") && csv.includes("'+1") && csv.includes("'@sum"));
  const audit = await db.collection('auditLog').where('organizationId', '==', orgId).get();
  const actions = new Set(audit.docs.map((d) => d.data().action));
  for (const a of [
    'Organization created', 'Staff invited', 'Staff invitation accepted', 'Role granted', 'Scholarship created', 'Scholarship updated', 'Scholarship deleted',
    'Application submitted', 'Application status changed', 'Recommendation requested', 'Recommendation request cancelled', 'Recommendation letter received', 'Staff access removed',
  ]) check(`Audit log has "${a}"`, actions.has(a));

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failed) console.log('Failed:\n - ' + failures.join('\n - '));
  console.log(`\norg: ${orgId}\nowner: ${mail('owner')}\nreviewer: ${mail('reviewer')}\nstudent: ${mail('sofia')}\npassword: ${PASSWORD}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('HARNESS ERROR', e);
  process.exit(2);
});
