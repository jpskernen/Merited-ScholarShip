'use client';

import { useState, useEffect, use } from 'react';
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
import { FileText, CheckCircle, AlertCircle, Loader2, GraduationCap, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { sendNotification } from '@/app/lib/notifications';

export default function RecommendUploadPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = use(params);
  const firestore = useFirestore();
  const storage = getStorage();
  const { toast } = useToast();

  const [tokenData, setTokenData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchToken() {
      if (!firestore || !tokenId) return;
      try {
        const tokenSnap = await getDoc(doc(firestore, 'recommendationTokens', tokenId));
        if (!tokenSnap.exists()) {
          setError('Invalid token.');
          setIsLoading(false);
          return;
        }
        const data = tokenSnap.data();
        if (data.used) {
          setError('This recommendation has already been uploaded.');
        } else if (data.cancelled) {
          setError('This recommendation request has been cancelled by the student.');
        } else {
          setTokenData(data);
        }
      } catch (err) {
        setError('Error loading the recommendation portal.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchToken();
  }, [firestore, tokenId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tokenData || !tokenId || !firestore) return;

    setIsUploading(true);
    const storageRef = ref(storage, `recommendations/${tokenId}.pdf`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
      (err) => { setIsUploading(false); toast({ title: "Upload Failed", variant: "destructive" }); },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        // Update Token
        await updateDoc(doc(firestore, 'recommendationTokens', tokenId), { used: true, fileUrl: downloadURL });

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

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  if (error || isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full border-primary/20 shadow-xl">
          <CardHeader className="text-center">
            {isSuccess ? (
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            ) : (
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            )}
            <CardTitle>{isSuccess ? 'Upload Complete' : 'Portal Error'}</CardTitle>
            <CardDescription>{isSuccess ? 'Thank you. The student has been notified that your endorsement is verified.' : error}</CardDescription>
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="mb-8 flex items-center gap-2">
        <GraduationCap className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold">ScholarShip</span>
      </div>
      <Card className="max-w-lg w-full shadow-2xl border-primary/10">
        <CardHeader>
          <CardTitle className="text-2xl">Submit Recommendation</CardTitle>
          <CardDescription>
            Confidential endorsement for: <strong>{tokenData.studentName}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
            <p className="text-sm text-muted-foreground leading-relaxed">
              You have been requested to provide a professional recommendation for the general scholarship portfolio of <strong>{tokenData.studentName}</strong>. 
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="pdf" className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Select Letter (PDF Only)</Label>
            <div className="relative group">
              <Input 
                id="pdf" 
                type="file" 
                accept=".pdf" 
                onChange={handleFileUpload} 
                disabled={isUploading}
                className="h-14 py-4 cursor-pointer"
              />
              <FileText className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black text-primary">
                  <span>Uploading to Secure Storage...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-1.5" />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
           <Separator className="mb-2" />
           <p className="text-[10px] text-muted-foreground italic text-center leading-tight">
             Your upload is encrypted and will be viewed only by the authorized scholarship selection committee. 
             This link is unique to your email address and should not be shared.
           </p>
        </CardFooter>
      </Card>
    </div>
  );
}
