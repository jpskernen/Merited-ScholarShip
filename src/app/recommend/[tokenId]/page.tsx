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
import { FileText, CheckCircle, AlertCircle, Loader2, GraduationCap } from 'lucide-react';
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
        if (data.used) setError('Already uploaded.');
        else setTokenData(data);
      } catch (err) {
        setError('Error loading portal.');
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
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            {isSuccess ? <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" /> : <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />}
            <CardTitle>{isSuccess ? 'Upload Complete' : 'Error'}</CardTitle>
            <CardDescription>{isSuccess ? 'Thank you. The student has been notified.' : error}</CardDescription>
          </CardHeader>
          <CardFooter><Button variant="outline" className="w-full" asChild><Link href="/">Return to Site</Link></Button></CardFooter>
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
      <Card className="max-w-lg w-full shadow-2xl">
        <CardHeader>
          <CardTitle>Submit Recommendation</CardTitle>
          <CardDescription>For student: <strong>{tokenData.studentName}</strong></CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="pdf">Select Letter (PDF Only)</Label>
            <Input id="pdf" type="file" accept=".pdf" onChange={handleFileUpload} disabled={isUploading} />
            {isUploading && <Progress value={uploadProgress} className="h-1 mt-2" />}
          </div>
        </CardContent>
        <CardFooter className="text-[10px] text-muted-foreground italic text-center">Your upload is secure and will be viewed only by the selection committee.</CardFooter>
      </Card>
    </div>
  );
}
