'use server';



import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import { ProfileSchema } from '@/types/applicant';
import { ApplicationSchema, applicationId, LEGACY_SCHOLARSHIP_ID } from '@/types/application';
import { sendSubmissionConfirmation, sendNotification, sendRecommendationReminderEmail, sendNewApplicantEmail } from '@/app/lib/notifications';
import { escapeHtml, renderEmail } from '@/app/lib/email-template';
import { AuthError, requireUser, type Caller } from '@/lib/auth-server';
import { writeAudit } from '@/lib/audit';
import { appLink } from '@/lib/app-url';
import { assertPdf, uploadPdf } from '@/lib/storage-server';


const SHARED_PROFILE_FIELDS = new Set([
  'name', 'email', 'secondaryEmail', 'address', 'gpa',
  'major', 'school', 'interests',
]);


const APPLICATION_TEXT_FIELDS = new Set(['essay', 'qualificationStatement', 'activities']);
const RECOMMENDER_FIELD = /^recommender(Name|Email|Title)([12])$/;
const PROMPT_FIELD = /^prompt:(.+)$/;
const MAX_PROMPTS = 20;

const MAX_TEXT_LENGTH = 20000;
const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TOKEN_DAYS = 30;

type Student = Caller & { orgId: string };


async function requireStudent(idToken: string): Promise<Student> {
  const caller = await requireUser(idToken);
  if (!caller.orgId) {
    throw new AuthError('Your account is not fully set up. Please sign out and sign in again.');
  }
  return caller as Student;
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  return { success: false as const, error: message };
}

function isRequestIndex(value: unknown): value is 1 | 2 {
  return value === 1 || value === 2;
}

/** The organization a scholarship belongs to; null for the legacy general portfolio. */
function programOrg(program: FirebaseFirestore.DocumentData | undefined | null): string | null {
  return program ? (program.organizationId || program.schoolId || null) : null;
}

export async function saveApplication(
  idToken: string,
  scholarshipId: string,
  formData: FormData,
  isSubmit: boolean = false,
) {
  try {
    const student = await requireStudent(idToken);
    if (!scholarshipId) {
      return { success: false, error: 'No scholarship selected for this application.' };
    }

    
    const profileInput: Record<string, unknown> = {};
    const applicationInput: Record<string, string> = {};
    const promptInput: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value !== 'string') continue;
      if (SHARED_PROFILE_FIELDS.has(key)) {
        profileInput[key] = key === 'gpa' ? (value === '' ? 0 : parseFloat(value)) : value;
      } else if (APPLICATION_TEXT_FIELDS.has(key) || RECOMMENDER_FIELD.test(key)) {
        if (value.length > MAX_TEXT_LENGTH) {
          return { success: false, error: `"${key}" is too long (maximum ${MAX_TEXT_LENGTH.toLocaleString()} characters).` };
        }
        applicationInput[key] = value;
      } else {
        const promptId = PROMPT_FIELD.exec(key)?.[1];
        if (promptId) {
          if (value.length > MAX_TEXT_LENGTH) {
            return { success: false, error: `One of your answers is too long (maximum ${MAX_TEXT_LENGTH.toLocaleString()} characters).` };
          }
          promptInput[promptId] = value;
        }
      }
    }

    const db = getAdminDb();
    const appId = applicationId(student.uid, scholarshipId);
    const userRef = db.collection('users').doc(student.uid);
    const appRef = db.collection('applications').doc(appId);
    const programRef = db.collection('programs').doc(scholarshipId);

    const outcome = await db.runTransaction(async (tx) => {
      const [userSnap, appSnap, programSnap] = await Promise.all([tx.get(userRef), tx.get(appRef), tx.get(programRef)]);
      const existingProfile = userSnap.exists ? userSnap.data()! : {};
      const existingApplication = appSnap.exists ? appSnap.data()! : {};
      const program = programSnap.exists ? programSnap.data()! : null;

      if (existingApplication.status && existingApplication.status !== 'Draft') {
        return { error: 'This application has already been submitted and can no longer be edited.' };
      }

      
      if (!program && scholarshipId !== LEGACY_SCHOLARSHIP_ID) {
        return { error: 'This scholarship is no longer available, so the application can no longer be saved or submitted.' };
      }

      const organizationId = program
        ? programOrg(program)
        : (existingApplication.organizationId || existingProfile.organizationId || existingProfile.schoolId);
      if (!organizationId) {
        return { error: 'This scholarship is not linked to an organization. Please contact the administrator.' };
      }
      
      if (organizationId !== student.orgId) {
        return { error: 'This scholarship is not available to your account.' };
      }

      // Drafts stay editable past the deadline so a student can still see and
      // adjust what they had; only the actual submission is refused.
      if (isSubmit && program?.deadline && new Date(program.deadline).getTime() < Date.now()) {
        return { error: 'The deadline for this scholarship has passed, so it can no longer be submitted.' };
      }

      const applicationChanges: Record<string, string> = {};
      for (const [key, value] of Object.entries(applicationInput)) {
        const slot = RECOMMENDER_FIELD.exec(key)?.[2];
        const slotStatus = slot ? existingApplication[`recommendationStatus${slot}`] : undefined;
        if (slot && (slotStatus === 'Pending' || slotStatus === 'Received')) continue;
        applicationChanges[key] = value;
      }

      const prompts: { id: string; title: string }[] = Array.isArray(program?.prompts) ? program!.prompts : [];
      const promptResponses = prompts
        .slice(0, MAX_PROMPTS)
        .map((prompt) => ({
          promptId: String(prompt.id),
          title: String(prompt.title || 'Essay'),
          answer: promptInput[String(prompt.id)] ?? findExistingAnswer(existingApplication, String(prompt.id)),
        }))
        .filter((response) => response.answer.trim() !== '');

      const scholarshipName = existingApplication.scholarshipName || (program
        ? (program.name || 'Scholarship')
        : (scholarshipId === LEGACY_SCHOLARSHIP_ID ? 'General Scholarship Portfolio' : 'Scholarship'));

      const profileToSave = { ...existingProfile, ...profileInput };

      // Validate before writing anything, so a rejected submit can't leave a
      // half-written record behind.
      const profileValidation = (isSubmit ? ProfileSchema : ProfileSchema.partial()).safeParse(profileToSave);
      if (!profileValidation.success) {
        return { error: `Validation failed - ${formatIssues(profileValidation.error.issues)}` };
      }

      const applicationToSave = {
        ...existingApplication,
        ...applicationChanges,
        id: appId,
        studentId: student.uid,
        scholarshipId,
        scholarshipName,
        organizationId,
        status: isSubmit ? 'Submitted' : 'Draft',
        submissionDate: isSubmit ? new Date().toISOString() : (existingApplication.submissionDate || null),
        ...(prompts.length > 0 ? { promptResponses } : {}),
        ...(isSubmit
          ? {
              profileSnapshot: {
                gpa: profileValidation.data.gpa,
                major: profileValidation.data.major,
                school: profileValidation.data.school,
                interests: profileValidation.data.interests,
                capturedAt: new Date().toISOString(),
              },
            }
          : {}),
      };

      const applicationValidation = ApplicationSchema.safeParse(applicationToSave);
      if (!applicationValidation.success) {
        return { error: `Validation failed - ${formatIssues(applicationValidation.error.issues)}` };
      }

      tx.set(userRef, { ...profileValidation.data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(appRef, {
        ...applicationValidation.data,
        createdAt: existingApplication.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return { application: applicationValidation.data, name: profileToSave.name as string | undefined };
    });

    if ('error' in outcome) return { success: false, error: outcome.error };

    if (isSubmit) {
      await mirrorSubmissionStatus(student.uid, outcome.application);
      await writeAudit({
        organizationId: outcome.application.organizationId,
        action: 'Application submitted',
        actorId: student.uid,
        actorName: outcome.name || student.email,
        targetId: appId,
        targetType: 'application',
        subject: outcome.name || student.email,
        details: { scholarshipId, scholarshipName: outcome.application.scholarshipName },
      });
      // To the account's own login address, not a form field.
      if (student.email) {
        await sendSubmissionConfirmation(student.email, outcome.name || 'Student');
      }
      // Notify the scholarship's assigned reviewers that there's a new
      // application waiting. Best-effort: a mail failure must not fail the
      // submission, which is already saved.
      try {
        await notifyAssignedReviewers(scholarshipId, outcome.application.scholarshipName);
      } catch (error) {
        console.error('Reviewer notification failed:', error);
      }
    }

    return { success: true, id: appId };
  } catch (error) {
    return failure(error);
  }
}


export async function uploadApplicationFile(
  idToken: string,
  scholarshipId: string,
  field: string,
  file: File,
  promptId?: string,
) {
  try {
    const student = await requireStudent(idToken);
    if (!scholarshipId) {
      return { success: false, error: 'No scholarship selected for this application.' };
    }

    const invalid = assertPdf(file);
    if (invalid) return { success: false, error: invalid };

    const db = getAdminDb();
    const [programSnap, existingApp] = await Promise.all([
      db.collection('programs').doc(scholarshipId).get(),
      db.collection('applications').doc(applicationId(student.uid, scholarshipId)).get(),
    ]);
    const program = programSnap.exists ? programSnap.data()! : null;
    const organizationId = program
      ? programOrg(program)
      : (existingApp.exists ? existingApp.data()!.organizationId : null) || student.orgId;

    if (!organizationId || organizationId !== student.orgId) {
      return { success: false, error: 'This scholarship is not available to your account.' };
    }

    const slot = promptId ? `essays/${promptId}` : `documents/${field}`;
    const path = `orgs/${organizationId}/applications/${student.uid}/${scholarshipId}/${slot}.pdf`;
    const url = await uploadPdf(path, file);

    return { success: true, url };
  } catch (error) {
    return failure(error);
  }
}

function findExistingAnswer(existingApplication: FirebaseFirestore.DocumentData, promptId: string): string {
  const existing = (existingApplication.promptResponses || [])
    .find((response: any) => response?.promptId === promptId);
  return typeof existing?.answer === 'string' ? existing.answer : '';
}

function formatIssues(issues: { path: (string | number)[]; message: string }[]) {
  return issues.map(issue => `${issue.path.join('.') || 'form'}: ${issue.message}`).join('; ');
}


async function mirrorSubmissionStatus(userId: string, application: any) {
  const db = getAdminDb();
  await db.collection('users').doc(userId).set({
    status: application.status,
    submissionDate: application.submissionDate,
    legacyMirrorOf: application.id,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

/**
 * Emails every reviewer assigned to a scholarship that a new application has
 * been submitted. Reviewer identities (name/email) come from the Auth record,
 * since that's the authoritative login address. The legacy general portfolio
 * has no program document and therefore no assigned reviewers.
 */
async function notifyAssignedReviewers(scholarshipId: string, scholarshipName: string) {
  if (scholarshipId === LEGACY_SCHOLARSHIP_ID) return;
  const db = getAdminDb();
  const programSnap = await db.collection('programs').doc(scholarshipId).get();
  const reviewerIds: string[] = programSnap.exists ? (programSnap.data()!.reviewerIds || []) : [];
  if (reviewerIds.length === 0) return;

  const auth = getAdminAuth();
  await Promise.all(reviewerIds.map(async (uid) => {
    try {
      const account = await auth.getUser(uid);
      if (!account.email) return;
      await sendNewApplicantEmail({
        email: account.email,
        reviewerName: account.displayName || 'Reviewer',
        scholarshipName: scholarshipName || 'a scholarship',
      });
    } catch (error) {
      console.error(`Could not notify reviewer ${uid}:`, error);
    }
  }));
}

/**
 * Backfills an `applications` record for a student who built a portfolio before
 * 2026-09-30, so their existing work shows up as an application to the legacy
 * general portfolio rather than silently disappearing. No-op if they already
 * have any application.
 */
export async function ensureLegacyApplication(idToken: string) {
  try {
    const { uid: userId } = await requireUser(idToken);
    const db = getAdminDb();
    const existing = await db.collection('applications').where('studentId', '==', userId).limit(1).get();
    if (!existing.empty) return { success: true, migrated: false };

    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) return { success: true, migrated: false };
    const user = userSnap.data()!;
    if (!user.status) return { success: true, migrated: false };

    const organizationId = user.organizationId || user.schoolId;
    if (!organizationId) {
      return { success: false, error: 'This account is not linked to an organization.' };
    }

    const appId = applicationId(userId, LEGACY_SCHOLARSHIP_ID);
    await db.collection('applications').doc(appId).set({
      id: appId,
      studentId: userId,
      scholarshipId: LEGACY_SCHOLARSHIP_ID,
      scholarshipName: 'General Scholarship Portfolio',
      organizationId,
      essay: user.essay ?? null,
      qualificationStatement: user.qualificationStatement ?? null,
      activities: user.activities ?? null,
      essays: user.essays ?? [],
      documents: user.documents ?? [],
      status: user.status,
      submissionDate: user.submissionDate ?? null,
      recommenderName1: user.recommenderName1 ?? '',
      recommenderEmail1: user.recommenderEmail1 ?? '',
      recommenderTitle1: user.recommenderTitle1 ?? '',
      recommendationStatus1: user.recommendationStatus1 ?? 'Not Requested',
      recommendationLetter1: user.recommendationLetter1 ?? null,
      recommendationLetterText1: user.recommendationLetterText1 ?? null,
      recommenderName2: user.recommenderName2 ?? '',
      recommenderEmail2: user.recommenderEmail2 ?? '',
      recommenderTitle2: user.recommenderTitle2 ?? '',
      recommendationStatus2: user.recommendationStatus2 ?? 'Not Requested',
      recommendationLetter2: user.recommendationLetter2 ?? null,
      recommendationLetterText2: user.recommendationLetterText2 ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { success: true, migrated: true };
  } catch (error) {
    return failure(error);
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Every open (unused, uncancelled) token for one endorsement slot of one application. */
async function openTokens(appId: string, requestIndex: 1 | 2) {
  return getAdminDb().collection('recommendationTokens')
    .where('applicationId', '==', appId)
    .where('requestIndex', '==', requestIndex)
    .where('used', '==', false)
    .where('cancelled', '==', false)
    .get();
}

async function cancelOpenTokens(appId: string, requestIndex: 1 | 2) {
  const snap = await openTokens(appId, requestIndex);
  await Promise.all(snap.docs.map((d) => d.ref.update({ cancelled: true, updatedAt: FieldValue.serverTimestamp() })));
  return snap.size;
}

export async function sendRecommendationRequest(idToken: string, params: {
  scholarshipId: string;
  recommenderName: string;
  recommenderEmail: string;
  recommenderTitle: string;
  requestIndex: number;
}) {
  try {
    const student = await requireStudent(idToken);
    const { requestIndex } = params;
    if (!isRequestIndex(requestIndex)) return { success: false, error: 'Invalid endorsement slot.' };

    const recommenderName = (params.recommenderName || '').trim().slice(0, 120);
    const recommenderTitle = (params.recommenderTitle || '').trim().slice(0, 120);
    if (!recommenderName || !recommenderTitle) {
      return { success: false, error: 'Please fill out all recommender details.' };
    }

    // The letter link goes to whoever this address belongs to, so a student who
    // names themselves (or names one teacher twice) can write their own
    // "verified" endorsement. Checked here as well as in the form, because the
    // form check is only a convenience and can be skipped.
    const recommenderEmail = (params.recommenderEmail || '').trim();
    if (!EMAIL_PATTERN.test(recommenderEmail)) {
      return { success: false, error: 'Please enter a valid recommender email address.' };
    }
    const normalized = recommenderEmail.toLowerCase();

    const db = getAdminDb();
    const appId = applicationId(student.uid, params.scholarshipId);
    const [studentSnap, existingApp, programSnap, authUser] = await Promise.all([
      db.collection('users').doc(student.uid).get(),
      db.collection('applications').doc(appId).get(),
      db.collection('programs').doc(params.scholarshipId).get(),
      getAdminAuth().getUser(student.uid),
    ]);
    const program = programSnap.exists ? programSnap.data()! : null;
    const application = existingApp.exists ? existingApp.data()! : null;

    const organizationId = programOrg(program) || application?.organizationId || studentSnap.get('organizationId');
    // Option A (docs/07 D7).
    if (organizationId !== student.orgId) {
      return { success: false, error: 'This scholarship is not available to your account.' };
    }
    if (application && ['Awarded', 'Not Awarded'].includes(application.status)) {
      return { success: false, error: 'A decision has already been made on this application.' };
    }
    if (application?.[`recommendationStatus${requestIndex}`] === 'Received') {
      return { success: false, error: 'A letter has already been received for this endorsement.' };
    }

    // The login email is authoritative; the profile copies can be missing or stale.
    const studentEmails = [authUser.email, studentSnap.get('email'), studentSnap.get('secondaryEmail')]
      .filter((e): e is string => typeof e === 'string' && e.trim() !== '')
      .map((e) => e.trim().toLowerCase());
    if (studentEmails.includes(normalized)) {
      return { success: false, error: 'You cannot be your own recommender. Please enter someone else’s email.' };
    }

    // Cancelling a request clears its email, so a stored address in the other
    // slot is a live request.
    const otherIndex = requestIndex === 1 ? 2 : 1;
    const otherEmail = application?.[`recommenderEmail${otherIndex}`];
    if (typeof otherEmail === 'string' && otherEmail.trim().toLowerCase() === normalized) {
      return { success: false, error: `This person is already your Endorsement #${otherIndex} recommender. Please choose a different recommender.` };
    }

    const scholarshipTitle = application?.scholarshipName || program?.name || 'General Portfolio';
    const studentName = studentSnap.get('name') || authUser.displayName || 'A student';

    // A new invite replaces any earlier one for this slot, so an old link can't
    // later overwrite the letter (docs/13 §3).
    await cancelOpenTokens(appId, requestIndex);

    // applicationId is a real applications/{id}, not the student's uid, so
    // inviting the same teacher for two scholarships creates two independent
    // tokens and two independent letters.
    const tokenRef = await db.collection('recommendationTokens').add({
      applicationId: appId,
      organizationId,
      studentName,
      recommenderName,
      recommenderEmail,
      scholarshipTitle,
      requestIndex,
      used: false,
      cancelled: false,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000),
    });

    const tokenLink = await appLink(`/recommend/${tokenRef.id}`);

    const emailResult = await sendNotification({
      to: recommenderEmail,
      subject: `Recommendation Request for ${studentName} — ${scholarshipTitle}`,
      type: 'Recommendation Request',
      text: `Hello ${recommenderName}, ${studentName} has requested a recommendation for the ${scholarshipTitle}. Link: ${tokenLink}`,
      html: renderEmail({
        title: `A recommendation letter has been requested`,
        preheader: `${studentName} has asked you for a recommendation.`,
        greeting: `Hello <strong>${escapeHtml(recommenderName)}</strong>,`,
        body: [
          `<strong>${escapeHtml(studentName)}</strong> has requested a recommendation letter in support of their application to the <strong>${escapeHtml(scholarshipTitle)}</strong>.`,
          `You can write or upload your letter directly using the secure link below — no account or sign-up is needed.`,
        ],
        button: { label: 'Write my recommendation', url: tokenLink },
        showPlainLink: true,
        note: `This link is personal to you and expires in ${TOKEN_DAYS} days. Please do not forward it.`,
      })
    });

    // A request nobody received must not show as Pending (docs/13 §3).
    if (!emailResult.success) {
      await tokenRef.update({ cancelled: true, updatedAt: FieldValue.serverTimestamp() });
      return { success: false, error: 'The invitation email could not be sent. Please check the address and try again.' };
    }


    const slotFields = {
      [`recommenderName${requestIndex}`]: recommenderName,
      [`recommenderEmail${requestIndex}`]: recommenderEmail,
      [`recommenderTitle${requestIndex}`]: recommenderTitle,
      [`recommendationStatus${requestIndex}`]: 'Pending',
    };
    await db.collection('applications').doc(appId).set({
      ...(application ? {} : {
        id: appId,
        studentId: student.uid,
        scholarshipId: params.scholarshipId,
        scholarshipName: scholarshipTitle,
        organizationId,
        status: 'Draft',
        createdAt: FieldValue.serverTimestamp(),
      }),
      ...slotFields,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await writeAudit({
      organizationId,
      action: 'Recommendation requested',
      actorId: student.uid,
      actorName: studentName,
      targetId: appId,
      targetType: 'application',
      subject: recommenderEmail,
      details: { slot: requestIndex, tokenId: tokenRef.id, scholarshipId: params.scholarshipId },
    });

    return { success: true, deliveryMethod: emailResult.method };
  } catch (error) {
    return failure(error);
  }
}

export async function sendRecommendationReminder(idToken: string, params: {
  scholarshipId: string;
  requestIndex: number;
}) {
  try {
    const student = await requireStudent(idToken);
    const { requestIndex } = params;
    if (!isRequestIndex(requestIndex)) return { success: false, error: 'Invalid endorsement slot.' };

    const db = getAdminDb();
    const appId = applicationId(student.uid, params.scholarshipId);
    const querySnapshot = await openTokens(appId, requestIndex);
    if (querySnapshot.empty) {
      return { success: false, error: "Active invitation not found or already used/cancelled." };
    }

    const tokenDoc = querySnapshot.docs[0];
    const tokenData = tokenDoc.data();

    const expiresAt = tokenData.expiresAt?.toDate ? tokenData.expiresAt.toDate() : new Date(tokenData.expiresAt);
    if (Date.now() > expiresAt.getTime()) {
      return { success: false, error: "The recommendation link has expired. Cancel it and send a new request." };
    }

    // One reminder a day, so the button can't be used to flood a teacher.
    const lastSent = tokenData.lastReminderSentAt?.toDate?.();
    if (lastSent && Date.now() - lastSent.getTime() < REMINDER_INTERVAL_MS) {
      return { success: false, error: 'A reminder was already sent in the last 24 hours.' };
    }

    const emailResult = await sendRecommendationReminderEmail({
      email: tokenData.recommenderEmail,
      studentName: tokenData.studentName || 'A Student',
      recommenderName: tokenData.recommenderName,
      tokenLink: await appLink(`/recommend/${tokenDoc.id}`),
    });
    if (!emailResult.success) {
      return { success: false, error: emailResult.error || 'The reminder could not be sent.' };
    }

    await tokenDoc.ref.update({ lastReminderSentAt: FieldValue.serverTimestamp() });
    await db.collection('applications').doc(appId).set({
      [`recommendationLastReminder${requestIndex}`]: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, method: emailResult.method };
  } catch (error) {
    return failure(error);
  }
}

export async function cancelRecommendationRequest(idToken: string, params: {
  scholarshipId: string;
  requestIndex: number;
}) {
  try {
    const student = await requireStudent(idToken);
    const { requestIndex } = params;
    if (!isRequestIndex(requestIndex)) return { success: false, error: 'Invalid endorsement slot.' };

    const db = getAdminDb();
    const appId = applicationId(student.uid, params.scholarshipId);
    const appRef = db.collection('applications').doc(appId);
    const appSnap = await appRef.get();

    if (appSnap.get(`recommendationStatus${requestIndex}`) === 'Received') {
      return { success: false, error: 'This letter has already been received and cannot be cancelled.' };
    }

    // 1. Cancel every open link for this slot, not just one.
    const cancelled = await cancelOpenTokens(appId, requestIndex);


    if (appSnap.exists) {
      const reset = {
        [`recommendationStatus${requestIndex}`]: 'Not Requested',
        [`recommenderName${requestIndex}`]: '',
        [`recommenderEmail${requestIndex}`]: '',
        [`recommenderTitle${requestIndex}`]: '',
        [`recommendationLastReminder${requestIndex}`]: null,
      };
      await appRef.update({ ...reset, updatedAt: FieldValue.serverTimestamp() });
    }

    await writeAudit({
      organizationId: appSnap.get('organizationId') ?? student.orgId,
      action: 'Recommendation request cancelled',
      actorId: student.uid,
      actorName: student.email,
      targetId: appId,
      targetType: 'application',
      subject: appSnap.get(`recommenderEmail${requestIndex}`) || null,
      details: { slot: requestIndex, linksCancelled: cancelled },
    });

    return { success: true };
  } catch (error) {
    return failure(error);
  }
}
