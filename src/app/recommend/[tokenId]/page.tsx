
'use client';

import { useState, useEffect, use, useRef } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, getStorage } from 'firebase/storage';
import { useFirestore, useFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  GraduationCap, 
  XCircle, 
  Type, 
  Upload,
  Bold,
  Italic,
  List,
  ArrowLeft,
  Send
} from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { sendNotification } from '@/app/lib/notifications';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { submitTypedRecommendation } from './actions';

export default function RecommendUploadPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = use(params);
  const { firestore } = useFirebase();
  const storage = getStorage();
  const { toast } = useToast();

  const [tokenData, setTokenData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputMethod, setInputMethod] = useState<'selection' | 'type' | 'upload'>('selection');
  
  // Typed Letter State
  const [letterText, setLetterText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function fetchToken() {
      if (!firestore || !tokenId) return;
      try {
        const tokenSnap = await getDoc(doc(firestore, 'recommendationTokens', tokenId));
        if (!tokenSnap.exists()) {
          setError('Invalid or expired token.');
          setIsLoading(false);
          return;
        }
        const data = tokenSnap.data();
        if (data.used) {
          setIsSuccess(true);
          setIsLoading(false);
          return;
        }
        if (data.cancelled) {
          setError('This recommendation request has been cancelled by the student.');
          setIsLoading(false);
          return;
        }
        setTokenData(data);
      } catch (err) {
        setError('Error loading the recommendation portal.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchToken();
  }, [firestore, tokenId]);

  const wordCount = letterText.trim() === '' ? 0 : letterText.trim().split(/\s+/).length;
  const isWordCountValid = wordCount >= 2000 && wordCount <= 5000;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tokenData || !tokenId || !firestore) return;

    if (file.type !== 'application/pdf') {
      toast({ title: "Invalid File", description: "Only PDF documents are accepted.", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10MB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const storageRef = ref(storage, `recommendations/${tokenId}.pdf`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
      (err) => { setIsUploading(false); toast({ title: "Upload Failed", variant: "destructive" }); },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        // Update Token
        await updateDoc(doc(firestore, 'recommendationTokens', tokenId), { 
          used: true, 
          fileUrl: downloadURL,
          updatedAt: serverTimestamp()
        });

        // Update Student
        const studentRef = doc(firestore, 'users', tokenData.applicationId);
        const studentSnap = await getDoc(studentRef);
        const student = studentSnap.data();
        
        const index = tokenData.requestIndex || 1;
        await updateDoc(studentRef, {
          [`recommendationStatus${index}`]: 'Received',
          [`recommendationLetter${index}`]: downloadURL,
          updatedAt: serverTimestamp()
        });

        // Notify Confirmation to Recommender
        await sendNotification({
          to: tokenData.recommenderEmail,
          subject: 'Recommendation Uploaded Successfully',
          type: 'Recommendation Received',
          text: `Thank you. Your letter for ${tokenData.studentName} has been received.`,
          html: `<p>Hello ${tokenData.recommenderName},</p><p>Your recommendation letter for <strong>${tokenData.studentName}</strong> has been uploaded and attached to their portfolio. Thank you for your support.</p>`
        });

        // Notify Student
        if (student?.email) {
          await sendNotification({
            to: student.email,
            subject: 'Recommendation Received',
            type: 'Recommendation Received',
            text: `Hello ${student.name}, a recommendation letter has been uploaded by ${tokenData.recommenderName}.`,
            html: `<p>Hi ${student.name},</p><p>We have received a new recommendation letter for your portfolio from <strong>${tokenData.recommenderName}</strong>.</p>`
          });
        }

        setIsSuccess(true);
        setIsUploading(false);
      }
    );
  };

  const handleTextSubmit = async () => {
    if (!isWordCountValid || isUploading) return;
    setIsUploading(true);
    
    const result = await submitTypedRecommendation(tokenId, letterText, tokenData);
    
    if (result.success) {
      setIsSuccess(true);
    } else {
      toast({ title: "Submission Failed", description: result.error, variant: "destructive" });
    }
    setIsUploading(false);
  };

  const insertFormatting = (marker: string, suffix = marker) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = textareaRef.current.value;
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);
    
    const newText = `${before}${marker}${selected}${suffix}${after}`;
    setLetterText(newText);
    
    // Focus back and set selection
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + marker.length, end + marker.length);
    }, 0);
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
        <Card className="max-w-md w-full border-primary/20 shadow-2xl">
          <CardHeader className="text-center">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Submission Complete</CardTitle>
            <CardDescription className="text-base pt-2">
              Your recommendation letter for <strong>{tokenData?.studentName || 'the student'}</strong> has been submitted successfully. 
              Thank you for supporting their scholarship application.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" className="w-full font-bold" asChild>
              <Link href="/">Finish & Close</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/20 shadow-xl">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Portal Restricted</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/">Return to Site</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 p-4 md:p-8">
      <div className="mb-8 flex items-center gap-2">
        <GraduationCap className="h-8 w-8 text-primary" />
        <span className="text-2xl font-black uppercase tracking-tighter">Merited</span>
      </div>

      <Card className="max-w-3xl w-full shadow-2xl border-primary/10 overflow-hidden">
        <CardHeader className="bg-primary/5 border-b">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">Professional Endorsement</CardTitle>
              <CardDescription className="font-medium text-primary/80">
                Candidate: <strong>{tokenData.studentName}</strong>
              </CardDescription>
            </div>
            {inputMethod !== 'selection' && (
              <Button variant="ghost" size="sm" onClick={() => setInputMethod('selection')} className="text-xs">
                <ArrowLeft className="h-3 w-3 mr-1" /> Change Method
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-8 space-y-8">
          {inputMethod === 'selection' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-32 flex flex-col gap-3 border-2 hover:border-primary hover:bg-primary/5 transition-all"
                onClick={() => setInputMethod('type')}
              >
                <Type className="h-8 w-8 text-primary" />
                <div className="text-center">
                  <p className="font-bold">Type my letter</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Direct Entry</p>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="h-32 flex flex-col gap-3 border-2 hover:border-primary hover:bg-primary/5 transition-all"
                onClick={() => setInputMethod('upload')}
              >
                <Upload className="h-8 w-8 text-primary" />
                <div className="text-center">
                  <p className="font-bold">Upload a PDF</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Max 10MB</p>
                </div>
              </Button>
            </div>
          )}

          {inputMethod === 'type' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recommendation Letter Content</Label>
                <div className="flex bg-muted rounded-md p-1 border">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => insertFormatting('**')}><Bold className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => insertFormatting('*')}><Italic className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => insertFormatting('\n- ')}><List className="h-4 w-4" /></Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Textarea 
                  ref={textareaRef}
                  placeholder="Enter your comprehensive recommendation here..." 
                  className="min-h-[400px] text-base leading-relaxed p-6"
                  value={letterText}
                  onChange={(e) => setLetterText(e.target.value)}
                  disabled={isUploading}
                />
                <div className="flex justify-between items-center">
                  <p className={cn(
                    "text-[10px] font-black uppercase tracking-widest",
                    isWordCountValid ? "text-green-600" : "text-amber-600"
                  )}>
                    Word Count: {wordCount} / 2000 minimum
                  </p>
                  <p className="text-[10px] text-muted-foreground italic">Target: 2000 - 5000 words</p>
                </div>
              </div>

              <Button 
                className="w-full h-14 text-lg font-black uppercase tracking-widest shadow-lg"
                disabled={!isWordCountValid || isUploading}
                onClick={handleTextSubmit}
              >
                {isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                Finalize & Submit Recommendation
              </Button>
            </div>
          )}

          {inputMethod === 'upload' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-8 border-2 border-dashed rounded-2xl bg-muted/20 text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold">Choose a PDF file</h4>
                  <p className="text-xs text-muted-foreground mt-1">Official letterhead preferred. Maximum 10MB.</p>
                </div>
                <Input 
                  type="file" 
                  accept=".pdf" 
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="max-w-xs mx-auto cursor-pointer"
                />
              </div>

              {isUploading && (
                <div className="space-y-3 px-4">
                  <div className="flex justify-between text-[10px] font-black uppercase text-primary">
                    <span>Transmitting Securely...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-muted/10 border-t p-6">
          <div className="flex gap-4 items-center">
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
              Your submission is strictly confidential and encrypted. Once submitted, it will be visible only to the authorized selection committee.
              The student will be notified that an endorsement has been received, but will not be able to view the contents of this letter.
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
