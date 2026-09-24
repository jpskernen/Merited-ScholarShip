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
import { saveApplicantData, sendRecommendationRequest, sendRecommendationReminder, cancelRecommendationRequest } from './actions';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Separator } from '@/components/ui/separator';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { 
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

export default function ProfilePage() {
  const { toast } = useToast();
  const { user, isUserLoading, firestore, storage } = useFirebase();
  
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

  const { data: applicantData, isLoading: isApplicantDataLoading } = useDoc<Applicant>(userDocRef);

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
  const [essayGeneralMethod, setEssayGeneralMethod] = useState<'text' | 'file'>('text');

  useEffect(() => {
    if (user && !isUserLoading) {
      if (!applicantData?.email) setValue('email', user.email || '');
      if (!applicantData?.name) setValue('name', user.displayName || '');
    }
    if (applicantData) {
        reset(applicantData);
    }
  }, [user, applicantData, isUserLoading, setValue, reset]);

  const finishUpload = async (downloadURL: string, fileName: string, field: string, promptId?: string) => {
    if (!userDocRef) return;
    try {
      if (promptId) {
        await updateDoc(userDocRef, {
          essays: arrayUnion({
            promptId,
            fileUrl: downloadURL,
            fileName: fileName,
            uploadedAt: serverTimestamp()
          }),
          updatedAt: serverTimestamp()
        });
      } else {
        const updateObj: any = { [field]: downloadURL, updatedAt: serverTimestamp() };
        await updateDoc(userDocRef, updateObj);
      }
    } catch (err: any) {
      throw err;
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
      const path = promptId 
        ? `applications/${user.uid}/essays/${promptId}.pdf`
        : `applications/${user.uid}/${field}.pdf`;
      
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
  }, [user, storage, firestore, toast]);

  const handleSendRecommendationRequest = async (index: number) => {
    if (!user) return;
    const name = getValues(`recommenderName${index}` as any);
    const email = getValues(`recommenderEmail${index}` as any);
    const title = getValues(`recommenderTitle${index}` as any);

    if (!name || !email || !title) {
      setRecErrors(prev => ({ ...prev, [index]: "Please fill out all recommender details." }));
      return;
    }

    setIsRequestingRec(prev => ({ ...prev, [index]: true }));
    try {
      const result = await sendRecommendationRequest({
        applicationId: user.uid,
        studentName: user.displayName || 'A Student',
        recommenderName: name,
        recommenderEmail: email,
        recommenderTitle: title,
        requestIndex: index,
        origin: window.location.origin
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

  const performAutoSave = useCallback(async () => {
    if (!user || !firestore || !isDirty || applicantData?.status === 'Submitted' || applicantData?.status === 'In Review') {
      return;
    }
    setSaveStatus('saving');
    try {
      const currentValues = getValues();
      await setDoc(doc(firestore, 'users', user.uid), {
        ...currentValues,
        status: applicantData?.status || 'Draft',
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
    }
  }, [user, firestore, isDirty, applicantData?.status, getValues]);

  useEffect(() => {
    const interval = setInterval(() => performAutoSave(), 30000);
    return () => clearInterval(interval);
  }, [performAutoSave]);

  const onSave = async (submit: boolean = false) => {
    if (!user || !formRef.current) return;
    if (submit) setIsSubmitting(true);
    else setIsSaving(true);
    setFormError(null);
    const formData = new FormData(formRef.current);
    try {
      const result = await saveApplicantData(user.uid, formData, submit);
      if (result.success) {
        toast({ title: submit ? 'Portfolio Finalized' : 'Draft Saved', description: submit ? 'Submitted for review.' : 'Progress stored.' });
        setSaveStatus('saved');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      setFormError(error.message);
      setSaveStatus('error');
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

  const isAlreadySubmitted = applicantData?.status === 'Submitted' || applicantData?.status === 'In Review' || applicantData?.status === 'Awarded' || applicantData?.status === 'Not Awarded';

  return (
    <form ref={formRef} className="space-y-6 md:space-y-8" noValidate>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">Scholarship Portfolio</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {isAlreadySubmitted ? 'Your portfolio is locked and undergoing institutional review.' : 'Provide your academic background and supporting evidence.'}
          </p>
          {!isAlreadySubmitted && (
            <div className="flex items-center pt-1">
              {saveStatus === 'saving' && <Badge variant="outline" className="animate-pulse text-primary border-primary/20 text-[10px]"><CloudUpload className="h-3 w-3 mr-1" /> Auto-Saving...</Badge>}
              {saveStatus === 'saved' && <Badge variant="outline" className="text-green-500 border-green-500/20 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" /> All Changes Saved</Badge>}
            </div>
          )}
        </div>
        {isAlreadySubmitted && <Badge className="bg-primary/10 text-primary border-primary/20 py-1.5 px-4 self-start md:self-center font-bold"><Lock className="h-4 w-4 mr-2" /> PORTFOLIO LOCKED</Badge>}
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
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="address" className="text-xs font-bold uppercase tracking-wider">Permanent Mailing Address</Label><Input id="address" {...register('address')} disabled={isAlreadySubmitted} className="h-10" /></div>
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <Label className="text-sm font-black uppercase tracking-tight">Personal Statement (Core Essay)</Label>
                  {!isAlreadySubmitted && (
                    <div className="flex bg-muted rounded-md p-1 w-fit border">
                      <Button type="button" size="sm" variant={essayGeneralMethod === 'text' ? 'secondary' : 'ghost'} className="h-8 text-[10px] font-bold" onClick={() => setEssayGeneralMethod('text')}><Type className="h-3 w-3 mr-1.5" /> Direct Entry</Button>
                      <Button type="button" size="sm" variant={essayGeneralMethod === 'file' ? 'secondary' : 'ghost'} className="h-8 text-[10px] font-bold" onClick={() => setEssayGeneralMethod('file')}><Upload className="h-3 w-3 mr-1.5" /> PDF Upload</Button>
                    </div>
                  )}
                </div>
                {essayGeneralMethod === 'text' ? (
                  <Textarea {...register('essay')} rows={8} placeholder="Tell your unique story..." disabled={isAlreadySubmitted} onBlur={performAutoSave} className="text-sm leading-relaxed" />
                ) : (
                  <div className="p-8 border-2 border-dashed rounded-xl bg-muted/10 space-y-4 text-center">
                    <Input type="file" accept=".pdf" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'essays', 'personal-statement')} disabled={isAlreadySubmitted} className="text-xs h-10 w-full max-w-sm mx-auto cursor-pointer" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={cn(isAlreadySubmitted && "opacity-80")}>
            <CardHeader className="p-4 md:p-6 border-b bg-muted/20">
              <CardTitle className="text-lg md:text-xl">External Endorsements</CardTitle>
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
                    {status === 'Not Requested' && !isAlreadySubmitted && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Input {...register(`recommenderName${i}` as any)} placeholder="Recommender Name" className="h-9 text-xs" />
                        <Input type="email" {...register(`recommenderEmail${i}` as any)} placeholder="Email Address" className="h-9 text-xs" />
                        <Input {...register(`recommenderTitle${i}` as any)} placeholder="Relationship/Title" className="h-9 text-xs" />
                      </div>
                    )}
                    {status === 'Not Requested' && !isAlreadySubmitted && <Button type="button" size="sm" className="w-full h-10 text-xs font-bold" onClick={() => handleSendRecommendationRequest(i)} disabled={isRequestingRec[i]}><Mail className="h-4 w-4 mr-2" />Send Secure Invitation</Button>}
                    {status === 'Received' && <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-[11px] text-green-700 font-black uppercase"><CheckCircle className="h-4 w-4" /> Letter Verified & Attached</div>}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {!isAlreadySubmitted && (
            <div className="flex flex-col sm:flex-row gap-4 justify-end pt-4 pb-10">
              <Button type="button" variant="outline" onClick={() => onSave(false)} disabled={isSaving || isSubmitting} className="w-full sm:w-auto h-12 px-8 font-bold">Save Draft Progress</Button>
              <Button type="button" className="font-black uppercase tracking-widest w-full sm:w-auto h-12 px-10 shadow-lg" onClick={() => onSave(true)} disabled={isSaving || isSubmitting}>Finalize & Submit</Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="lg:sticky lg:top-24 border-primary/20 shadow-sm">
            <CardHeader className="p-4 md:p-6 bg-muted/10 border-b"><CardTitle className="text-base md:text-lg flex items-center gap-2"><CheckCircle className="h-5 w-5 text-primary" /> Submission Checklist</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-xs md:text-sm p-4 md:p-6">
              <div className="flex items-center gap-3"><div className={cn("h-6 w-6 rounded-full flex items-center justify-center border-2 text-[10px] font-bold", getValues('name') ? "bg-primary text-primary-foreground border-primary" : "border-muted text-muted-foreground")}>{getValues('name') ? '✓' : '1'}</div><span>Personal Details</span></div>
              <div className="flex items-center gap-3"><div className={cn("h-6 w-6 rounded-full flex items-center justify-center border-2 text-[10px] font-bold", (watch('essay') || applicantData?.essays?.some(e => e.promptId === 'personal-statement')) ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30 text-muted-foreground")}>{(watch('essay') || applicantData?.essays?.some(e => e.promptId === 'personal-statement')) ? '✓' : '2'}</div><span>Personal Statement</span></div>
              <div className="flex items-center gap-3"><div className={cn("h-6 w-6 rounded-full flex items-center justify-center border-2 text-[10px] font-bold", ((applicantData as any)?.recommendationStatus1 === 'Received') ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30 text-muted-foreground")}>{((applicantData as any)?.recommendationStatus1 === 'Received') ? '✓' : '3'}</div><span>Endorsement Verified</span></div>
              {!isAlreadySubmitted && <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200"><p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase">Important: Once submitted, you will no longer be able to modify your portfolio.</p></div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}