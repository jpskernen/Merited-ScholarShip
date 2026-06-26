
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
import { saveApplicantData, sendRecommendationRequest } from './actions';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Separator } from '@/components/ui/separator';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, getStorage } from 'firebase/storage';
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
  Paperclip,
  UserPlus,
  Mail,
  Clock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const { toast } = useToast();
  const { user, isUserLoading, firestore } = useFirebase();
  const storage = getStorage();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [isRequestingRec, setIsRequestingRec] = useState<Record<number, boolean>>({});
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

  const essayInputMethod = {
    qual: useState<'text' | 'file'>('text'),
    general: useState<'text' | 'file'>('text'),
  };

  useEffect(() => {
    if (user && !isUserLoading) {
      if (!applicantData?.email) setValue('email', user.email || '');
      if (!applicantData?.name) setValue('name', user.displayName || '');
    }
    if (applicantData) {
        reset(applicantData);
    }
  }, [user, applicantData, isUserLoading, setValue, reset]);

  const handleFileUpload = async (file: File, field: string, promptId?: string) => {
    if (!user || !file) return;

    setUploadErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });

    if (file.type !== 'application/pdf') {
      setUploadErrors(prev => ({ ...prev, [field]: "Please upload a PDF file." }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadErrors(prev => ({ ...prev, [field]: "Maximum file size is 10MB." }));
      return;
    }

    const path = promptId 
      ? `applications/${user.uid}/essays/${promptId}.pdf`
      : `applications/${user.uid}/${field}.pdf`;
    
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(prev => ({ ...prev, [field]: progress }));
      }, 
      (error) => {
        setUploadErrors(prev => ({ ...prev, [field]: error.message }));
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }, 
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        if (promptId) {
          await updateDoc(userDocRef!, {
            essays: arrayUnion({
              promptId,
              fileUrl: downloadURL,
              fileName: file.name,
              uploadedAt: serverTimestamp()
            }),
            updatedAt: serverTimestamp()
          });
        } else {
          const updateObj: any = { [field]: downloadURL, updatedAt: serverTimestamp() };
          if (field === 'transcripts') {
            updateObj.documents = arrayUnion(downloadURL);
          }
          await updateDoc(userDocRef!, updateObj);
        }

        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    );
  };

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
    setRecErrors(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    try {
      // Call the secure Server Action
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
        toast({ 
          title: "Request Dispatched", 
          description: `A secure portal link has been prepared and sent to ${name}.` 
        });
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
      const docRef = doc(firestore, 'users', user.uid);
      
      await setDoc(docRef, {
        ...currentValues,
        status: 'Draft',
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
        toast({
            title: submit ? 'Application Submitted!' : 'Draft Saved',
            description: submit ? 'Your scholarship portfolio has been sent.' : 'Progress saved securely.',
        });
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
    return <div className="flex h-64 items-center justify-center animate-pulse">Loading Application Profile...</div>;
  }

  const isAlreadySubmitted = applicantData?.status === 'Submitted' || applicantData?.status === 'In Review';

  // Step Indicators for visual progress
  const steps = [
    { id: 1, label: 'Academic' },
    { id: 2, label: 'Essays' },
    { id: 3, label: 'Recommendations' },
  ];

  return (
    <form ref={formRef} className="space-y-6 md:space-y-8" noValidate>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">Scholarship Application</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {isAlreadySubmitted ? 'Application finalized and under review.' : 'Complete your portfolio to apply.'}
          </p>
          {!isAlreadySubmitted && (
            <div className="flex items-center pt-1">
              {saveStatus === 'saving' && <Badge variant="outline" className="animate-pulse text-primary border-primary/20 text-[10px]"><CloudUpload className="h-3 w-3 mr-1" /> Saving...</Badge>}
              {saveStatus === 'saved' && <Badge variant="outline" className="text-green-500 border-green-500/20 text-[10px]"><CloudUpload className="h-3 w-3 mr-1" /> Saved</Badge>}
              {saveStatus === 'error' && <Badge variant="destructive" className="text-[10px]"><AlertCircle className="h-3 w-3 mr-1" /> Error</Badge>}
            </div>
          )}
        </div>
        {isAlreadySubmitted && (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20 py-1 px-4 self-start md:self-center">
            <CheckCircle className="h-4 w-4 mr-2" /> Submitted
          </Badge>
        )}
      </div>

      {/* Responsive Step Indicator */}
      <div className="flex items-center justify-between px-2 mb-4">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                step.id === 1 ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground"
              )}>
                {step.id}
              </div>
              <span className="text-[10px] font-medium hidden md:block">{step.label}</span>
              <span className="text-[10px] font-medium md:hidden">{step.id}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className="mx-2 h-[2px] flex-1 bg-muted-foreground/20" />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          {formError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-xl">Step 1: Academic Profile</CardTitle>
              <CardDescription className="text-xs md:text-sm">Basic details and transcript upload.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6 pt-0 md:pt-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm">Full Name</Label>
                  <Input id="name" {...register('name')} disabled={isAlreadySubmitted} onBlur={performAutoSave} className="h-9" />
                  {errors.name && <p className="text-[10px] text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gpa" className="text-sm">GPA</Label>
                  <Input id="gpa" type="number" step="0.01" {...register('gpa')} disabled={isAlreadySubmitted} onBlur={performAutoSave} className="h-9" />
                  {errors.gpa && <p className="text-[10px] text-destructive">{errors.gpa.message}</p>}
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm">Official Transcript (PDF only)</Label>
                <div className="flex flex-col gap-2">
                  <Input 
                    type="file" 
                    accept=".pdf" 
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'transcripts')}
                    disabled={isAlreadySubmitted || !!uploadProgress.transcripts}
                    className="h-9 text-xs"
                  />
                  {uploadErrors.transcripts && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {uploadErrors.transcripts}</p>}
                  {uploadProgress.transcripts !== undefined && (
                    <div className="space-y-1">
                      <Progress value={uploadProgress.transcripts} className="h-1" />
                    </div>
                  )}
                  {applicantData?.transcripts && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <Paperclip className="h-3 w-3" /> Current: <a href={applicantData.transcripts as string} target="_blank" className="underline text-primary">View Transcript</a>
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-xl">Step 2: Essay Submission</CardTitle>
              <CardDescription className="text-xs md:text-sm">Type your response or upload a PDF.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 md:space-y-8 p-4 md:p-6 pt-0 md:pt-0">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <Label className="text-sm md:text-base font-bold">Qualification Statement</Label>
                  <div className="flex bg-muted rounded-md p-0.5 w-fit">
                    <Button type="button" size="sm" variant={essayInputMethod.qual[0] === 'text' ? 'secondary' : 'ghost'} className="h-7 text-[10px]" onClick={() => essayInputMethod.qual[1]('text')}><Type className="h-3 w-3 mr-1" /> Type</Button>
                    <Button type="button" size="sm" variant={essayInputMethod.qual[0] === 'file' ? 'secondary' : 'ghost'} className="h-7 text-[10px]" onClick={() => essayInputMethod.qual[1]('file')}><Upload className="h-3 w-3 mr-1" /> Upload</Button>
                  </div>
                </div>
                
                {essayInputMethod.qual[0] === 'text' ? (
                  <Textarea {...register('qualificationStatement')} rows={5} placeholder="Why are you qualified?" disabled={isAlreadySubmitted} onBlur={performAutoSave} className="text-sm" />
                ) : (
                  <div className="p-4 border-2 border-dashed rounded-lg space-y-4">
                    <Input type="file" accept=".pdf" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'essays', 'qualification')} disabled={isAlreadySubmitted} className="text-xs h-9" />
                    {uploadErrors.essays && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {uploadErrors.essays}</p>}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <Label className="text-sm md:text-base font-bold">Personal Statement</Label>
                  <div className="flex bg-muted rounded-md p-0.5 w-fit">
                    <Button type="button" size="sm" variant={essayInputMethod.general[0] === 'text' ? 'secondary' : 'ghost'} className="h-7 text-[10px]" onClick={() => essayInputMethod.general[1]('text')}><Type className="h-3 w-3 mr-1" /> Type</Button>
                    <Button type="button" size="sm" variant={essayInputMethod.general[0] === 'file' ? 'secondary' : 'ghost'} className="h-7 text-[10px]" onClick={() => essayInputMethod.general[1]('file')}><Upload className="h-3 w-3 mr-1" /> Upload</Button>
                  </div>
                </div>
                
                {essayInputMethod.general[0] === 'text' ? (
                  <Textarea {...register('essay')} rows={6} placeholder="Tell us your story..." disabled={isAlreadySubmitted} onBlur={performAutoSave} className="text-sm" />
                ) : (
                  <div className="p-4 border-2 border-dashed rounded-lg space-y-4">
                    <Input type="file" accept=".pdf" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'essays', 'personal-statement')} disabled={isAlreadySubmitted} className="text-xs h-9" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-xl">Step 3: Recommendation Letters</CardTitle>
              <CardDescription className="text-xs md:text-sm">Request official endorsements.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-6 pt-0 md:pt-0">
              {[1, 2].map((i) => {
                const status = (applicantData as any)?.[`recommendationStatus${i}`] || 'Not Requested';
                return (
                  <div key={i} className="rounded-lg border p-4 space-y-4 bg-muted/20">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs md:text-sm font-bold flex items-center gap-2">
                        <UserPlus className="h-3 w-3 md:h-4 md:w-4 text-primary" /> Request #{i}
                      </h4>
                      <Badge variant={status === 'Received' ? 'default' : 'secondary'} className={cn(
                        "text-[9px] px-2 py-0.5",
                        status === 'Pending' ? 'bg-amber-500/10 text-amber-600 border-amber-200' : ''
                      )}>
                        {status === 'Pending' && <Clock className="h-2 w-2 mr-1 animate-pulse" />}
                        {status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] md:text-xs">Name</Label>
                        <Input {...register(`recommenderName${i}` as any)} placeholder="Dr. Smith" disabled={isAlreadySubmitted || status !== 'Not Requested'} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] md:text-xs">Email</Label>
                        <Input type="email" {...register(`recommenderEmail${i}` as any)} placeholder="smith@school.edu" disabled={isAlreadySubmitted || status !== 'Not Requested'} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] md:text-xs">Relationship</Label>
                        <Input {...register(`recommenderTitle${i}` as any)} placeholder="Teacher" disabled={isAlreadySubmitted || status !== 'Not Requested'} className="h-8 text-xs" />
                      </div>
                    </div>

                    {recErrors[i] && (
                      <Alert variant="destructive" className="py-1 px-3">
                        <AlertCircle className="h-3 w-3" />
                        <AlertDescription className="text-[10px]">{recErrors[i]}</AlertDescription>
                      </Alert>
                    )}

                    {status === 'Not Requested' && !isAlreadySubmitted && (
                      <Button 
                        type="button" 
                        size="sm" 
                        className="w-full h-8 text-xs" 
                        onClick={() => handleSendRecommendationRequest(i)}
                        disabled={isRequestingRec[i]}
                      >
                        {isRequestingRec[i] ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Mail className="h-3 w-3 mr-2" />}
                        Send Request
                      </Button>
                    )}
                    
                    {status === 'Received' && (
                      <div className="flex items-center gap-2 text-[10px] text-green-600 font-bold">
                        <CheckCircle className="h-3 w-3" /> Endorsement Verified
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {!isAlreadySubmitted && (
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => onSave(false)} disabled={isSaving || isSubmitting} className="w-full sm:w-auto h-10">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Draft
              </Button>
              <Button type="button" className="font-bold w-full sm:w-auto h-10" onClick={() => onSave(true)} disabled={isSaving || isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Submit Application
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="lg:sticky lg:top-24">
            <CardHeader className="p-4 md:p-6"><CardTitle className="text-base md:text-lg">Checklist</CardTitle></CardHeader>
            <CardContent className="space-y-3 md:space-y-4 text-xs md:text-sm p-4 md:p-6 pt-0 md:pt-0">
              <div className="flex items-center gap-2">
                <Badge variant={getValues('name') ? 'default' : 'outline'} className="h-5 w-5 p-0 justify-center">{getValues('name') ? '✓' : '!'}</Badge>
                <span>Profile Details</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={applicantData?.transcripts ? 'default' : 'outline'} className="h-5 w-5 p-0 justify-center">{applicantData?.transcripts ? '✓' : '!'}</Badge>
                <span>Academic Transcript</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={(watch('essay') || applicantData?.essays?.some(e => e.promptId === 'personal-statement')) ? 'default' : 'outline'} className="h-5 w-5 p-0 justify-center">
                  {(watch('essay') || applicantData?.essays?.some(e => e.promptId === 'personal-statement')) ? '✓' : '!'}
                </Badge>
                <span>Personal Statement</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={((applicantData as any)?.recommendationStatus1 === 'Pending' || (applicantData as any)?.recommendationStatus1 === 'Received') ? 'default' : 'outline'} className="h-5 w-5 p-0 justify-center">
                  {((applicantData as any)?.recommendationStatus1 === 'Pending' || (applicantData as any)?.recommendationStatus1 === 'Received') ? '✓' : '!'}
                </Badge>
                <span>Rec Letter #1 Request</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
