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
import { saveApplicantData } from './actions';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Separator } from '@/components/ui/separator';
import { useDoc, useFirebase, useMemoFirebase, useFunctions } from '@/firebase';
import { doc, setDoc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, getStorage } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { 
  CheckCircle, 
  Send, 
  Save, 
  Loader2, 
  CloudCheck, 
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

export default function ProfilePage() {
  const { toast } = useToast();
  const { user, isUserLoading, firestore } = useFirebase();
  const functions = useFunctions();
  const storage = getStorage();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isRequestingRec, setIsRequestingRec] = useState<Record<number, boolean>>({});
  
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

    if (file.type !== 'application/pdf') {
      toast({ title: "Invalid File Type", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Maximum file size is 10MB.", variant: "destructive" });
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
        toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
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

        toast({ title: "Upload Successful", description: `${file.name} has been saved.` });
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    );
  };

  const handleSendRecommendationRequest = async (index: number) => {
    if (!user || !functions) return;
    
    const name = getValues(`recommenderName${index}` as any);
    const email = getValues(`recommenderEmail${index}` as any);
    const title = getValues(`recommenderTitle${index}` as any);

    if (!name || !email || !title) {
      toast({ title: "Missing Information", description: "Please fill out all recommender details.", variant: "destructive" });
      return;
    }

    setIsRequestingRec(prev => ({ ...prev, [index]: true }));

    try {
      const sendReq = httpsCallable(functions, 'sendRecommendationRequest');
      await sendReq({
        applicationId: user.uid,
        scholarshipId: 'general-portfolio',
        organizationId: 'default-school',
        studentName: user.displayName || 'A Student',
        scholarshipTitle: 'General Scholarship Portfolio',
        recommenderName: name,
        recommenderEmail: email,
        recommenderTitle: title,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days default
      });

      // Update local status in Firestore
      await updateDoc(userDocRef!, {
        [`recommendationStatus${index}`]: 'Pending',
        updatedAt: serverTimestamp(),
      });

      toast({ title: "Request Sent", description: `An invitation has been sent to ${name}.` });
    } catch (error: any) {
      toast({ title: "Request Failed", description: error.message || "Could not send request.", variant: "destructive" });
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
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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

  return (
    <form ref={formRef} className="space-y-8" noValidate>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Scholarship Application</h1>
            <p className="text-muted-foreground">
              {isAlreadySubmitted ? 'Application finalized and under review.' : 'Complete your portfolio to apply.'}
            </p>
          </div>
          {!isAlreadySubmitted && (
            <div className="flex items-center">
              {saveStatus === 'saving' && <Badge variant="outline" className="animate-pulse text-primary border-primary/20"><CloudUpload className="h-3 w-3 mr-1" /> Saving...</Badge>}
              {saveStatus === 'saved' && <Badge variant="outline" className="text-green-500 border-green-500/20"><CloudCheck className="h-3 w-3 mr-1" /> Saved</Badge>}
              {saveStatus === 'error' && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Error</Badge>}
            </div>
          )}
        </div>
        {isAlreadySubmitted && (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20 py-1 px-4"><CheckCircle className="h-4 w-4 mr-2" /> Submitted</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* Step 1: Academic Profile */}
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Academic Profile</CardTitle>
              <CardDescription>Basic details and transcript upload.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" {...register('name')} disabled={isAlreadySubmitted} onBlur={performAutoSave} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gpa">GPA</Label>
                  <Input id="gpa" type="number" step="0.01" {...register('gpa')} disabled={isAlreadySubmitted} onBlur={performAutoSave} />
                </div>
              </div>

              <div className="space-y-4">
                <Label>Official Transcript (PDF only)</Label>
                <div className="flex flex-col gap-2">
                  <Input 
                    type="file" 
                    accept=".pdf" 
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'transcripts')}
                    disabled={isAlreadySubmitted || !!uploadProgress.transcripts}
                  />
                  {uploadProgress.transcripts !== undefined && (
                    <div className="space-y-1">
                      <Progress value={uploadProgress.transcripts} className="h-1" />
                    </div>
                  )}
                  {applicantData?.transcripts && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Paperclip className="h-3 w-3" /> Current: <a href={applicantData.transcripts as string} target="_blank" className="underline text-primary">View Transcript</a>
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Essays */}
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Essay Submission</CardTitle>
              <CardDescription>Type your response or upload a PDF.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold">Qualification Statement</Label>
                  <div className="flex bg-muted rounded-md p-0.5">
                    <Button type="button" size="sm" variant={essayInputMethod.qual[0] === 'text' ? 'secondary' : 'ghost'} className="h-7 text-[10px]" onClick={() => essayInputMethod.qual[1]('text')}><Type className="h-3 w-3 mr-1" /> Type</Button>
                    <Button type="button" size="sm" variant={essayInputMethod.qual[0] === 'file' ? 'secondary' : 'ghost'} className="h-7 text-[10px]" onClick={() => essayInputMethod.qual[1]('file')}><Upload className="h-3 w-3 mr-1" /> Upload</Button>
                  </div>
                </div>
                
                {essayInputMethod.qual[0] === 'text' ? (
                  <Textarea {...register('qualificationStatement')} rows={6} placeholder="Why are you qualified?" disabled={isAlreadySubmitted} onBlur={performAutoSave} />
                ) : (
                  <div className="p-4 border-2 border-dashed rounded-lg space-y-4">
                    <Input type="file" accept=".pdf" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'essays', 'qualification')} disabled={isAlreadySubmitted} />
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold">Personal Statement</Label>
                  <div className="flex bg-muted rounded-md p-0.5">
                    <Button type="button" size="sm" variant={essayInputMethod.general[0] === 'text' ? 'secondary' : 'ghost'} className="h-7 text-[10px]" onClick={() => essayInputMethod.general[1]('text')}><Type className="h-3 w-3 mr-1" /> Type</Button>
                    <Button type="button" size="sm" variant={essayInputMethod.general[0] === 'file' ? 'secondary' : 'ghost'} className="h-7 text-[10px]" onClick={() => essayInputMethod.general[1]('file')}><Upload className="h-3 w-3 mr-1" /> Upload</Button>
                  </div>
                </div>
                
                {essayInputMethod.general[0] === 'text' ? (
                  <Textarea {...register('essay')} rows={8} placeholder="Tell us your story..." disabled={isAlreadySubmitted} onBlur={performAutoSave} />
                ) : (
                  <div className="p-4 border-2 border-dashed rounded-lg space-y-4">
                    <Input type="file" accept=".pdf" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'essays', 'personal-statement')} disabled={isAlreadySubmitted} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Recommendation Letters</CardTitle>
              <CardDescription>Request official endorsements from teachers or mentors.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[1, 2].map((i) => {
                const status = (applicantData as any)?.[`recommendationStatus${i}`] || 'Not Requested';
                return (
                  <div key={i} className="rounded-lg border p-4 space-y-4 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-primary" /> Recommendation Request #{i}
                      </h4>
                      <Badge variant={status === 'Received' ? 'default' : 'secondary'} className={status === 'Pending' ? 'bg-amber-500/10 text-amber-600 border-amber-200' : ''}>
                        {status === 'Pending' && <Clock className="h-3 w-3 mr-1 animate-pulse" />}
                        {status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Recommender Name</Label>
                        <Input {...register(`recommenderName${i}` as any)} placeholder="Dr. Smith" disabled={isAlreadySubmitted || status !== 'Not Requested'} />
                      </div>
                      <div className="space-y-2">
                        <Label>Recommender Email</Label>
                        <Input type="email" {...register(`recommenderEmail${i}` as any)} placeholder="smith@school.edu" disabled={isAlreadySubmitted || status !== 'Not Requested'} />
                      </div>
                      <div className="space-y-2">
                        <Label>Title/Relationship</Label>
                        <Input {...register(`recommenderTitle${i}` as any)} placeholder="Math Teacher" disabled={isAlreadySubmitted || status !== 'Not Requested'} />
                      </div>
                    </div>

                    {status === 'Not Requested' && !isAlreadySubmitted && (
                      <Button 
                        type="button" 
                        size="sm" 
                        className="w-full sm:w-auto" 
                        onClick={() => handleSendRecommendationRequest(i)}
                        disabled={isRequestingRec[i]}
                      >
                        {isRequestingRec[i] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                        Send Request
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {!isAlreadySubmitted && (
            <div className="flex gap-4 justify-end">
              <Button type="button" variant="outline" onClick={() => onSave(false)} disabled={isSaving || isSubmitting}>
                <Save className="mr-2 h-4 w-4" /> Save Draft
              </Button>
              <Button type="button" className="font-bold" onClick={() => onSave(true)} disabled={isSaving || isSubmitting}>
                <Send className="mr-2 h-4 w-4" /> Submit Application
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="sticky top-24">
            <CardHeader><CardTitle>Submission Checklist</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={getValues('name') ? 'default' : 'outline'}>{getValues('name') ? '✓' : '!'}</Badge>
                <span>Profile Details</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={applicantData?.transcripts ? 'default' : 'outline'}>{applicantData?.transcripts ? '✓' : '!'}</Badge>
                <span>Academic Transcript</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={(watch('essay') || applicantData?.essays?.some(e => e.promptId === 'personal-statement')) ? 'default' : 'outline'}>
                  {(watch('essay') || applicantData?.essays?.some(e => e.promptId === 'personal-statement')) ? '✓' : '!'}
                </Badge>
                <span>Personal Statement</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={((applicantData as any)?.recommendationStatus1 === 'Pending' || (applicantData as any)?.recommendationStatus1 === 'Received') ? 'default' : 'outline'}>
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
