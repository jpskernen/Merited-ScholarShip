'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Applicant, ApplicantSchema } from '@/types/applicant';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { saveApplication, ensureLegacyApplication, sendRecommendationRequest, sendRecommendationReminder, cancelRecommendationRequest } from './actions';
import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { applicationId as buildApplicationId } from '@/types/application';
import { Separator } from '@/components/ui/separator';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { orgIdOf } from '@/lib/org';
import { doc, setDoc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  ArrowLeft,
  CheckCircle,
  Send, 
  Save, 
  Loader2, 
  CloudUpload, 
  AlertCircle, 
  FileText, 
  Upload, 
  Type, 
  UserPlus,
  Mail,
  Clock,
  Lock,
  Bell,
  UserMinus
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function ProfilePageContent() {
  const { toast } = useToast();
  const { user, isUserLoading, firestore, storage, userData } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Which scholarship this form is an application to. Every entry point
  // (Opportunities card, My Status row) now carries it; arriving without one is
  // ambiguous now that a student can hold several applications, so send them
  // back to pick one rather than guessing.
  const scholarshipId = searchParams.get('scholarshipId');

  useEffect(() => {
    if (!scholarshipId) router.replace('/dashboard/scholarships');
  }, [scholarshipId, router]);

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, string>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [isRequestingRec, setIsRequestingRec] = useState<Record<number, boolean>>({});
  const [isRemindingRec, setIsRemindingRec] = useState<Record<number, boolean>>({});
  const [isCancellingRec, setIsCancellingRec] = useState<Record<number, boolean>>({});
  const [recErrors, setRecErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  
  const formRef = useRef<HTMLFormElement>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: profileData, isLoading: isProfileLoading } = useDoc<Applicant>(userDocRef);

  const appId = user && scholarshipId ? buildApplicationId(user.uid, scholarshipId) : null;

  const appDocRef = useMemoFirebase(() => {
    if (!firestore || !appId) return null;
    return doc(firestore, 'applications', appId);
  }, [firestore, appId]);

  const { data: applicationData, isLoading: isApplicationLoading } = useDoc<any>(appDocRef);

  const programDocRef = useMemoFirebase(() => {
    if (!firestore || !scholarshipId) return null;
    return doc(firestore, 'programs', scholarshipId);
  }, [firestore, scholarshipId]);

  const { data: programData } = useDoc<any>(programDocRef);

  const scholarshipName =
    applicationData?.scholarshipName || programData?.name || 'Scholarship Application';

  const prompts = useMemo<{ id: string; title: string; description: string }[]>(() => {
    const defined = Array.isArray(programData?.prompts) ? programData.prompts : [];
    return defined.length > 0
      ? defined.map((prompt: any, index: number) => ({
          id: String(prompt.id || `prompt-${index + 1}`),
          title: String(prompt.title || `Essay ${index + 1}`),
          description: prompt.description ? String(prompt.description) : '',
        }))
      : [{ id: 'personal-statement', title: 'Personal Statement', description: 'Tell your unique story.' }];
  }, [programData]);

  // Shared profile fields live on users/{uid}, application-specific ones on
  // applications/{id}. The rest of this form reads a single merged object, so
  // the split stays confined to load and save.
  //
  // Only the SHARED fields may be inherited from the user document. Spreading
  // the whole of it leaked the legacy mirror of a previously submitted
  // application into every new one — a scholarship the student had never
  // applied to would show their old essay and their old endorsements as
  // "Pending"/"Received", and cancelling one blew up on an application document
  // that didn't exist.
  const applicantData = useMemo(() => {
    const shared: Record<string, any> = {};
    if (profileData) {
      for (const field of ['name', 'email', 'secondaryEmail', 'address', 'gpa',
                           'major', 'school', 'interests', 'schoolId', 'organizationId']) {
        const value = (profileData as any)[field];
        if (value !== undefined) shared[field] = value;
      }
    }
    const merged: Record<string, any> = { ...shared, ...(applicationData || {}) };

    const answers: Record<string, string> = {};
    (applicationData?.promptResponses || []).forEach((response: any) => {
      if (response?.promptId) answers[response.promptId] = response.answer || '';
    });
    prompts.forEach((prompt, index) => {
      const existing = answers[prompt.id];
      merged[`prompt:${prompt.id}`] =
        existing ?? (index === 0 && !applicationData?.promptResponses?.length ? (applicationData?.essay || '') : '');
    });

    return merged as Applicant;
  }, [profileData, applicationData, prompts]);

  const isApplicantDataLoading = isProfileLoading || isApplicationLoading;

  // Students who built a portfolio before applications existed get it backfilled
  // as an application to the legacy general portfolio, so their work isn't lost.
  useEffect(() => {
    if (user) user.getIdToken().then(ensureLegacyApplication);
  }, [user]);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    reset,
    getValues,
    watch
  } = useForm<Applicant>({
    resolver: zodResolver(ApplicantSchema),
    defaultValues: {
      name: '',
      email: '',
      secondaryEmail: '',
      address: '',
      gpa: 0,
      major: '',
      school: '',
      interests: '',
      activities: '',
      essay: '',
      qualificationStatement: '',
      essays: [],
      documents: []
    }
  });

  const [essayQualMethod, setEssayQualMethod] = useState<'text' | 'file'>('text');
  const [promptMethod, setPromptMethod] = useState<Record<string, 'text' | 'file'>>({});

  // Mirrors the submit dialog's check. Scholarships define their own prompts,
  // so the answers live under `prompt:<id>` (or an upload tagged with that id)
  // and never in the legacy single `essay` field.
  const narrativesComplete = prompts.length > 0 && prompts.every((prompt) => {
    const typed = watch(`prompt:${prompt.id}` as any);
    const uploaded = applicantData?.essays?.some((essay: any) => essay.promptId === prompt.id);
    return !!typed || !!uploaded;
  });

  // The application document changes on every invite, reminder, upload and
  // autosave. Resetting the whole form each time threw away anything typed but
  // not yet saved (a changed school, the other endorsement's details), so a
  // full reset happens once per application and later snapshots keep dirty
  // fields as the user left them.
  const hydratedAppId = useRef<string | null>(null);

  useEffect(() => {
    if (!user || isUserLoading || isApplicantDataLoading || !appId) return;

    const values = {
      ...applicantData,
      email: applicantData?.email || user.email || '',
      name: applicantData?.name || user.displayName || '',
    } as Applicant;

    if (hydratedAppId.current !== appId) {
      reset(values);
      hydratedAppId.current = appId;
    } else {
      reset(values, { keepDirtyValues: true });
    }
  }, [user, applicantData, isUserLoading, isApplicantDataLoading, appId, reset]);

  const finishUpload = async (downloadURL: string, fileName: string, field: string, promptId?: string) => {
    // Uploads belong to this application, not to the student's shared profile,
    // so two scholarships can hold two different essay PDFs.
    if (!appDocRef || !user || !scholarshipId) return;
    // The identity fields are included so this write still satisfies the
    // create rule when it's the first thing written to a brand-new application.
    // On an existing Draft they are unchanged, so the update rule ignores them.
    const organizationId = orgIdOf(userData);
    if (!organizationId) return;
    const identity = { id: appDocRef.id, studentId: user.uid, scholarshipId, organizationId, status: 'Draft' };
    if (promptId) {
      await setDoc(appDocRef, {
        ...identity,
        essays: arrayUnion({
          promptId,
          fileUrl: downloadURL,
          fileName: fileName,
          // Firestore rejects serverTimestamp() nested inside an array, which
          // is why this write used to throw and the essay was never attached.
          uploadedAt: new Date().toISOString(),
        }),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else {
      await setDoc(appDocRef, { ...identity, [field]: downloadURL, updatedAt: serverTimestamp() }, { merge: true });
    }
  };

  const handleFileUpload = useCallback(async (file: File, field: string, promptId?: string) => {
    if (!file || !user || !storage || !firestore) return;

    try {
      if (file.type !== 'application/pdf') {
        setUploadErrors(prev => ({ ...prev, [field]: "Only PDF documents are accepted." }));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadErrors(prev => ({ ...prev, [field]: "File too large. Please upload a PDF under 10MB." }));
        return;
      }

      setUploadStatus(prev => ({ ...prev, [field]: 'uploading' }));
      // Scoped per scholarship so an essay uploaded for one application can't
      // overwrite the one uploaded for another.
      const path = promptId
        ? `applications/${user.uid}/${scholarshipId}/essays/${promptId}.pdf`
        : `applications/${user.uid}/${scholarshipId}/${field}.pdf`;
      
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(prev => ({ ...prev, [field]: progress }));
        }, 
        (error) => {
          setUploadStatus(prev => ({ ...prev, [field]: 'error' }));
          setUploadErrors(prev => ({ ...prev, [field]: `Upload failed: ${error.message}` }));
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await finishUpload(downloadURL, file.name, field, promptId);
          setUploadStatus(prev => ({ ...prev, [field]: 'complete' }));
          setUploadProgress(prev => {
            const next = { ...prev };
            delete next[field];
            return next;
          });
          toast({ title: "Success", description: "File attached." });
        }
      );
    } catch (err: any) {
      setUploadStatus(prev => ({ ...prev, [field]: 'error' }));
    }
  }, [user, userData, storage, firestore, toast, scholarshipId, appDocRef]);

  const handleSendRecommendationRequest = async (index: number) => {
    if (!user || !appId || !scholarshipId) return;
    const name = getValues(`recommenderName${index}` as any);
    const email = getValues(`recommenderEmail${index}` as any);
    const title = getValues(`recommenderTitle${index}` as any);
    setRecErrors(prev => ({ ...prev, [index]: '' }));

    if (!name || !email || !title) {
      setRecErrors(prev => ({ ...prev, [index]: "Please fill out all recommender details." }));
      return;
    }

    // Same rules as sendRecommendationRequest, which enforces them; checked
    // here too so the student sees the problem before anything is sent.
    const normalized = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setRecErrors(prev => ({ ...prev, [index]: "Please enter a valid recommender email address." }));
      return;
    }
    const ownEmails = [user.email, getValues('email' as any), getValues('secondaryEmail' as any)]
      .filter((e): e is string => typeof e === 'string' && e.trim() !== '')
      .map(e => e.trim().toLowerCase());
    if (ownEmails.includes(normalized)) {
      setRecErrors(prev => ({ ...prev, [index]: "You cannot be your own recommender. Please enter someone else’s email." }));
      return;
    }
    const otherIndex = index === 1 ? 2 : 1;
    const otherEmail = getValues(`recommenderEmail${otherIndex}` as any);
    if (typeof otherEmail === 'string' && otherEmail.trim().toLowerCase() === normalized) {
      setRecErrors(prev => ({ ...prev, [index]: `This person is already your Endorsement #${otherIndex} recommender. Please choose a different recommender.` }));
      return;
    }

    setIsRequestingRec(prev => ({ ...prev, [index]: true }));
    try {
      // The server takes the student, application, scholarship name and link
      // address from the signed-in account and the database, not from here.
      const result = await sendRecommendationRequest(await user.getIdToken(), {
        scholarshipId,
        recommenderName: name,
        recommenderEmail: email,
        recommenderTitle: title,
        requestIndex: index,
      });

      if (result.success) {
        toast({ title: "Request Dispatched", description: `Invitation sent to ${name}.` });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      setRecErrors(prev => ({ ...prev, [index]: error.message || "Could not send request." }));
    } finally {
      setIsRequestingRec(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleSendReminder = async (index: number) => {
    if (!user || !appId || !scholarshipId) return;
    setIsRemindingRec(prev => ({ ...prev, [index]: true }));
    try {
      const result = await sendRecommendationReminder(await user.getIdToken(), {
        scholarshipId,
        requestIndex: index,
      });
      if (result.success) {
        toast({ title: "Reminder Sent", description: "A follow-up email has been dispatched." });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ title: "Reminder Failed", description: error.message || "Could not send reminder.", variant: "destructive" });
    } finally {
      setIsRemindingRec(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleCancelRecommendation = async (index: number) => {
    if (!user || !appId || !scholarshipId) return;
    setIsCancellingRec(prev => ({ ...prev, [index]: true }));
    try {
      const result = await cancelRecommendationRequest(await user.getIdToken(), {
        scholarshipId,
        requestIndex: index,
      });
      if (result.success) {
        toast({ title: "Request Cancelled", description: "You can send a new invitation now." });
        setRecErrors(prev => ({ ...prev, [index]: '' }));
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ title: "Cancel Failed", description: error.message || "Could not cancel request.", variant: "destructive" });
    } finally {
      setIsCancellingRec(prev => ({ ...prev, [index]: false }));
    }
  };

  // Routed through the same server action as an explicit save so the shared /
  // application field split lives in exactly one place. It also means autosave
  // no longer blind-writes the whole form object, which used to be able to put
  // an empty essays[] back over a freshly uploaded file.
  const performAutoSave = useCallback(async () => {
    const status = applicationData?.status;
    if (!user || !scholarshipId || !formRef.current || !isDirty || (status && status !== 'Draft')) {
      return;
    }
    setSaveStatus('saving');
    try {
      const result = await saveApplication(await user.getIdToken(), scholarshipId, new FormData(formRef.current), false);
      setSaveStatus(result.success ? 'saved' : 'error');
      if (result.success) setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
    }
  }, [user, scholarshipId, isDirty, applicationData?.status]);

  useEffect(() => {
    const interval = setInterval(() => performAutoSave(), 30000);
    return () => clearInterval(interval);
  }, [performAutoSave]);

  const onSave = async (submit: boolean = false) => {
    if (!user || !formRef.current || !scholarshipId) return;
    if (submit) setIsSubmitting(true);
    else setIsSaving(true);
    setFormError(null);
    const formData = new FormData(formRef.current);
    try {
      const result = await saveApplication(await user.getIdToken(), scholarshipId, formData, submit);
      if (result.success) {
        toast({
          title: submit ? 'Application Submitted' : 'Draft Saved',
          description: submit ? `Your application to ${scholarshipName} is with the committee.` : 'Progress stored.',
        });
        setSaveStatus('saved');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      setFormError(error.message);
      setSaveStatus('error');
      toast({ title: submit ? 'Submission Failed' : 'Save Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };
  
  if (isUserLoading || isApplicantDataLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Syncing Secure Profile...</p>
      </div>
    );
  }

  // Read from the application, never from the merged object: the user document
  // carries a legacy mirror of the last submitted application, and using that
  // here would lock a brand-new application to a different scholarship.
  const applicationStatus = applicationData?.status;
  const isAlreadySubmitted = !!applicationStatus && applicationStatus !== 'Draft';
  const isPastDeadline = !!programData?.deadline && new Date(programData.deadline).getTime() < Date.now();

  // Endorsements outlive submission deliberately. A recommender's deadline is
  // normally later than the application's, and chasing or replacing a teacher
  // who hasn't replied is the one thing a student can't do any other way — so
  // inviting, reminding and cancelling stay available after Finalize & Submit.
  // Everything else on the form stays locked. Once a decision is recorded there
  // is nothing left to influence, so it closes for good.
  const canManageEndorsements = applicationStatus !== 'Awarded' && applicationStatus !== 'Not Awarded';

  return (
    <form ref={formRef} className="space-y-6 md:space-y-8" noValidate>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <Link
            href="/dashboard/applications"
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to My Applications
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">{scholarshipName}</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {isAlreadySubmitted
              ? 'This application is locked and undergoing institutional review. You can still manage endorsements below, and your other applications are unaffected.'
              : 'Provide your academic background and supporting evidence for this scholarship.'}
          </p>
          {!isAlreadySubmitted && (
            <div className="flex items-center pt-1">
              {saveStatus === 'saving' && <Badge variant="outline" className="animate-pulse text-primary border-primary/20 text-[10px]"><CloudUpload className="h-3 w-3 mr-1" /> Auto-Saving...</Badge>}
              {saveStatus === 'saved' && <Badge variant="outline" className="text-green-500 border-green-500/20 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" /> All Changes Saved</Badge>}
            </div>
          )}
        </div>
        {isAlreadySubmitted && <Badge className="bg-primary/10 text-primary border-primary/20 py-1.5 px-4 self-start md:self-center font-bold"><Lock className="h-4 w-4 mr-2" /> {applicationStatus?.toUpperCase()}</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <Card className={cn(isAlreadySubmitted && "opacity-80 grayscale-[20%]")}>
            <CardHeader className="p-4 md:p-6 border-b bg-muted/20">
              <CardTitle className="text-lg md:text-xl">Academic & Personal Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-4 md:p-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider">Full Legal Name</Label><Input id="name" {...register('name')} disabled={isAlreadySubmitted} className="h-10" /></div>
                <div className="space-y-2"><Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider">Primary Contact Email</Label><Input id="email" {...register('email')} disabled className="h-10 bg-muted/50" /></div>
                <div className="space-y-2"><Label htmlFor="school" className="text-xs font-bold uppercase tracking-wider">Current Institution</Label><Input id="school" {...register('school')} disabled={isAlreadySubmitted} className="h-10" /></div>
                <div className="space-y-2"><Label htmlFor="gpa" className="text-xs font-bold uppercase tracking-wider">Cumulative GPA</Label><Input id="gpa" type="number" step="0.01" {...register('gpa')} disabled={isAlreadySubmitted} className="h-10" /></div>
                <div className="space-y-2"><Label htmlFor="major" className="text-xs font-bold uppercase tracking-wider">Intended Major</Label><Input id="major" {...register('major')} disabled={isAlreadySubmitted} className="h-10" /></div>
                <div className="space-y-2"><Label htmlFor="interests" className="text-xs font-bold uppercase tracking-wider">Academic Interests</Label><Input id="interests" {...register('interests')} placeholder="e.g. Robotics, Public Policy" disabled={isAlreadySubmitted} className="h-10" /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="address" className="text-xs font-bold uppercase tracking-wider">Permanent Mailing Address</Label><Input id="address" {...register('address')} placeholder="e.g. 123 Maple Street, Apt 4B, Springfield, IL 62704, USA" disabled={isAlreadySubmitted} className="h-10" /></div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(isAlreadySubmitted && "opacity-80")}>
            <CardHeader className="p-4 md:p-6 border-b bg-muted/20"><CardTitle className="text-lg md:text-xl">Merit Statements</CardTitle></CardHeader>
            <CardContent className="space-y-8 p-4 md:p-6">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <Label className="text-sm font-black uppercase tracking-tight">Qualification Summary</Label>
                </div>
                <Textarea {...register('qualificationStatement')} rows={6} placeholder="Summarize your key achievements..." disabled={isAlreadySubmitted} onBlur={performAutoSave} className="text-sm leading-relaxed" />
              </div>
              <Separator />
              <div className="space-y-4">
                <Label className="text-sm font-black uppercase tracking-tight">Activities & Leadership</Label>
                <Textarea {...register('activities')} rows={5} placeholder="List your extracurricular activities, leadership roles, and community involvement..." disabled={isAlreadySubmitted} onBlur={performAutoSave} className="text-sm leading-relaxed" />
              </div>
              <Separator />
              {prompts.map((prompt, index) => {
                const method = promptMethod[prompt.id] || 'text';
                const uploaded = applicantData?.essays?.find((essay: any) => essay.promptId === prompt.id);
                return (
                  <div key={prompt.id} className="space-y-4">
                    {index > 0 && <Separator />}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm font-black uppercase tracking-tight">{prompt.title}</Label>
                        {prompt.description && (
                          <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">{prompt.description}</p>
                        )}
                      </div>
                      {!isAlreadySubmitted && (
                        <div className="flex bg-muted rounded-md p-1 w-fit border shrink-0">
                          <Button type="button" size="sm" variant={method === 'text' ? 'secondary' : 'ghost'} className="h-8 text-[10px] font-bold" onClick={() => setPromptMethod(prev => ({ ...prev, [prompt.id]: 'text' }))}><Type className="h-3 w-3 mr-1.5" /> Direct Entry</Button>
                          <Button type="button" size="sm" variant={method === 'file' ? 'secondary' : 'ghost'} className="h-8 text-[10px] font-bold" onClick={() => setPromptMethod(prev => ({ ...prev, [prompt.id]: 'file' }))}><Upload className="h-3 w-3 mr-1.5" /> PDF Upload</Button>
                        </div>
                      )}
                    </div>
                    {method === 'text' ? (
                      <Textarea
                        {...register(`prompt:${prompt.id}` as any)}
                        rows={8}
                        placeholder="Write your answer..."
                        disabled={isAlreadySubmitted}
                        onBlur={performAutoSave}
                        className="text-sm leading-relaxed"
                      />
                    ) : (
                      <div className="p-8 border-2 border-dashed rounded-xl bg-muted/10 space-y-4 text-center">
                        <Input type="file" accept=".pdf" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'essays', prompt.id)} disabled={isAlreadySubmitted} className="text-xs h-10 w-full max-w-sm mx-auto cursor-pointer" />
                        {uploaded && (
                          <p className="text-xs text-muted-foreground">Uploaded: {uploaded.fileName}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 md:p-6 border-b bg-muted/20">
              <CardTitle className="text-lg md:text-xl">External Endorsements</CardTitle>
              {isAlreadySubmitted && canManageEndorsements && (
                <CardDescription className="text-xs">
                  Your application is locked, but endorsements stay open — you can still invite,
                  remind or replace a recommender while it is under review.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-6 p-4 md:p-6">
              {[1, 2].map((i) => {
                const status = (applicantData as any)?.[`recommendationStatus${i}`] || 'Not Requested';
                return (
                  <div key={i} className="rounded-xl border p-5 space-y-5 bg-muted/5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs md:text-sm font-black uppercase flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /> Endorsement #{i}</h4>
                      <Badge variant={status === 'Received' ? 'default' : 'outline'} className="font-bold">{status}</Badge>
                    </div>
                    {status === 'Not Requested' && canManageEndorsements && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Input {...register(`recommenderName${i}` as any)} placeholder="Recommender Name" className="h-9 text-xs" />
                        <Input type="email" {...register(`recommenderEmail${i}` as any)} placeholder="Email Address" className="h-9 text-xs" />
                        <Input {...register(`recommenderTitle${i}` as any)} placeholder="Relationship/Title" className="h-9 text-xs" />
                      </div>
                    )}
                    {status === 'Not Requested' && canManageEndorsements && <Button type="button" size="sm" className="w-full h-10 text-xs font-bold" onClick={() => handleSendRecommendationRequest(i)} disabled={isRequestingRec[i]}><Mail className="h-4 w-4 mr-2" />Send Secure Invitation</Button>}
                    {/* recErrors was set by every failed send but never rendered,
                        so a rejected invitation looked like a dead button. */}
                    {status === 'Not Requested' && canManageEndorsements && recErrors[i] && (
                      <p className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" /> {recErrors[i]}
                      </p>
                    )}
                    {status === 'Pending' && canManageEndorsements && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-700 font-black uppercase">
                          <Clock className="h-4 w-4" /> Awaiting response from {(applicantData as any)?.[`recommenderName${i}`] || 'recommender'}
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-xs font-bold" onClick={() => handleSendReminder(i)} disabled={isRemindingRec[i]}>
                            {isRemindingRec[i] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}Send Reminder
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-xs font-bold text-destructive hover:text-destructive" disabled={isCancellingRec[i]}>
                                {isCancellingRec[i] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserMinus className="h-4 w-4 mr-2" />}Cancel Request
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel this endorsement request?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This revokes the recommender's link and clears their details so you can invite someone new. This can't be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep Waiting</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleCancelRecommendation(i)}>Cancel Request</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )}
                    {status === 'Received' && <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-[11px] text-green-700 font-black uppercase"><CheckCircle className="h-4 w-4" /> Letter Verified & Attached</div>}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {!isAlreadySubmitted && (
            <div className="flex flex-col gap-4 pt-4 pb-10">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  {formError}
                </div>
              )}
              {isPastDeadline && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  The deadline for this scholarship has passed. Your draft is saved, but it can no longer be submitted.
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-4 justify-end">
                <Button type="button" variant="outline" onClick={() => onSave(false)} disabled={isSaving || isSubmitting} className="w-full sm:w-auto h-12 px-8 font-bold">Save Draft Progress</Button>
                {/* Submitting locks the application for good, so it is confirmed
                    first and the student is shown what is still missing. The
                    checks mirror the Submission Checklist. */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" className="font-black uppercase tracking-widest w-full sm:w-auto h-12 px-10 shadow-lg" disabled={isSaving || isSubmitting || isPastDeadline}>Finalize & Submit</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    {(() => {
                      const missing: string[] = [];
                      if (!getValues('name')) missing.push('Personal details (your name)');
                      prompts.forEach((prompt) => {
                        const typed = watch(`prompt:${prompt.id}` as any);
                        const uploaded = applicantData?.essays?.some((essay: any) => essay.promptId === prompt.id);
                        if (!typed && !uploaded) missing.push(`${prompt.title} (nothing written or uploaded)`);
                      });
                      const pendingLetters = [1, 2].filter(i => (applicantData as any)?.[`recommendationStatus${i}`] !== 'Received');
                      return (
                        <>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{missing.length ? 'Submit with missing items?' : 'Submit this application?'}</AlertDialogTitle>
                            <AlertDialogDescription asChild>
                              <div className="space-y-3 text-sm">
                                <p>Once submitted, this application is <strong>locked</strong> and you cannot edit it any more.</p>
                                {missing.length > 0 && (
                                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
                                    <p className="font-bold">Still missing:</p>
                                    <ul className="list-disc pl-5">{missing.map(m => <li key={m}>{m}</li>)}</ul>
                                  </div>
                                )}
                                {pendingLetters.length > 0 && (
                                  <p className="text-muted-foreground">
                                    Endorsement {pendingLetters.map(i => `#${i}`).join(' and ')} not received yet. You can still invite or remind recommenders after submitting.
                                  </p>
                                )}
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Go Back</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onSave(true)}>{missing.length ? 'Submit Anyway' : 'Submit'}</AlertDialogAction>
                          </AlertDialogFooter>
                        </>
                      );
                    })()}
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="lg:sticky lg:top-24 border-primary/20 shadow-sm">
            <CardHeader className="p-4 md:p-6 bg-muted/10 border-b"><CardTitle className="text-base md:text-lg flex items-center gap-2"><CheckCircle className="h-5 w-5 text-primary" /> Submission Checklist</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-xs md:text-sm p-4 md:p-6">
              <div className="flex items-center gap-3"><div className={cn("h-6 w-6 rounded-full flex items-center justify-center border-2 text-[10px] font-bold", getValues('name') ? "bg-primary text-primary-foreground border-primary" : "border-muted text-muted-foreground")}>{getValues('name') ? '✓' : '1'}</div><span>Personal Details</span></div>
              <div className="flex items-center gap-3"><div className={cn("h-6 w-6 rounded-full flex items-center justify-center border-2 text-[10px] font-bold", narrativesComplete ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30 text-muted-foreground")}>{narrativesComplete ? '✓' : '2'}</div><span>{prompts.length === 1 ? prompts[0].title : 'Narrative Responses'}</span></div>
              <div className="flex items-center gap-3"><div className={cn("h-6 w-6 rounded-full flex items-center justify-center border-2 text-[10px] font-bold", ((applicantData as any)?.recommendationStatus1 === 'Received') ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30 text-muted-foreground")}>{((applicantData as any)?.recommendationStatus1 === 'Received') ? '✓' : '3'}</div><span>Endorsement Verified</span></div>
              {!isAlreadySubmitted && <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200"><p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase">Important: once submitted, this application is locked. You can still apply to other scholarships.</p></div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  );
}