
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
import { FileText, CheckCircle, AlertCircle, Loader2, Upload, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchToken() {
      if (!firestore || !tokenId) return;
      
      try {
        const tokenRef = doc(firestore, 'recommendationTokens', tokenId);
        const tokenSnap = await getDoc(tokenRef);
        
        if (!tokenSnap.exists()) {
          setError('Invalid recommendation link. Please contact the student who requested this letter.');
          setIsLoading(false);
          return;
        }

        const data = tokenSnap.data();
        
        if (data.used) {
          setError('This recommendation link has already been used.');
          setIsLoading(false);
          return;
        }

        if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
          setError('This recommendation link has expired.');
          setIsLoading(false);
          return;
        }

        setTokenData(data);
      } catch (err: any) {
        setError('Failed to load recommendation details.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchToken();
  }, [firestore, tokenId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tokenData || !tokenId) return;

    setUploadError(null);

    if (file.type !== 'application/pdf') {
      setUploadError("Please upload a PDF file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Maximum file size is 10MB.");
      return;
    }

    setIsUploading(true);
    const storageRef = ref(storage, `recommendations/${tokenId}.pdf`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      }, 
      (error) => {
        setUploadError(error.message);
        setIsUploading(false);
      }, 
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        try {
          await updateDoc(doc(firestore, 'recommendationTokens', tokenId), {
            used: true,
            fileUrl: downloadURL,
            uploadedAt: serverTimestamp()
          });

          const studentRef = doc(firestore, 'users', tokenData.applicationId);
          const updateObj: any = {
            updatedAt: serverTimestamp()
          };
          
          const index = tokenData.requestIndex || 1;
          updateObj[`recommendationStatus${index}`] = 'Received';
          updateObj[`recommendationLetter${index}`] = downloadURL;

          await updateDoc(studentRef, updateObj);

          setIsSuccess(true);
          toast({ title: "Letter Submitted", description: "Your recommendation has been securely uploaded." });
        } catch (err: any) {
          setUploadError("The file was uploaded but we couldn't link it to the application.");
        } finally {
          setIsUploading(false);
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 md:p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="animate-pulse text-muted-foreground font-medium text-sm">Loading portal...</p>
        </div>
      </div>
    );
  }

  if (error || isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 md:p-6">
        <Card className="max-w-md w-full shadow-xl border-primary/5">
          <CardHeader className="text-center p-6">
            <div className="flex justify-center mb-4">
              {isSuccess ? (
                <div className="bg-green-100 p-3 rounded-full">
                  <CheckCircle className="h-8 w-8 md:h-10 md:w-10 text-green-600" />
                </div>
              ) : (
                <div className="bg-destructive/10 p-3 rounded-full">
                  <AlertCircle className="h-8 w-8 md:h-10 md:w-10 text-destructive" />
                </div>
              )}
            </div>
            <CardTitle className="text-xl md:text-2xl">{isSuccess ? 'Submission Complete' : 'Access Restricted'}</CardTitle>
            <CardDescription className="text-xs md:text-sm mt-2">
              {isSuccess 
                ? 'Your recommendation letter has been securely received by the scholarship committee.' 
                : error}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center border-t p-6">
            <Button variant="outline" asChild className="w-full md:w-auto">
              <Link href="/">Return to ScholarShip</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 md:p-6">
      <div className="mb-6 md:mb-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-7 w-7 md:h-8 md:w-8 text-primary" />
          <span className="text-xl md:text-2xl font-bold">ScholarShip</span>
        </div>
        <Badge variant="outline" className="bg-primary/5 text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2 py-0.5">
          Secure Recommender Portal
        </Badge>
      </div>

      <Card className="max-w-lg w-full shadow-2xl border-primary/10 overflow-hidden">
        <CardHeader className="space-y-1 p-5 md:p-6 bg-card">
          <CardTitle className="text-xl md:text-2xl">Upload Recommendation</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Providing a recommendation for <strong>{tokenData.studentName}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-5 md:p-6 pt-0 md:pt-0">
          <div className="rounded-lg bg-muted/30 p-4 border space-y-2 md:space-y-3">
            <div className="flex justify-between items-center text-xs md:text-sm">
              <span className="text-muted-foreground">Scholarship:</span>
              <span className="font-bold text-right ml-2">{tokenData.scholarshipTitle}</span>
            </div>
            <div className="flex justify-between items-center text-xs md:text-sm">
              <span className="text-muted-foreground">Recommender:</span>
              <span className="font-bold">{tokenData.recommenderName}</span>
            </div>
          </div>

          <div className="space-y-4">
            <Label htmlFor="pdf-upload" className="text-xs md:text-sm font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Select Letter (PDF Only)
            </Label>
            <div className="relative">
              <Input 
                id="pdf-upload" 
                type="file" 
                accept=".pdf" 
                className="cursor-pointer h-10 md:h-11 text-xs md:text-sm"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md">
                  <div className="w-full px-4 md:px-6 space-y-2">
                    <div className="flex justify-between text-[10px] md:text-xs font-bold text-primary">
                      <span>Uploading...</span>
                      <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-1.5 md:h-2" />
                  </div>
                </div>
              )}
            </div>
            {uploadError && (
              <Alert variant="destructive" className="py-2 px-3">
                <AlertCircle className="h-3 w-3" />
                <AlertDescription className="text-[10px] md:text-xs">{uploadError}</AlertDescription>
              </Alert>
            )}
            <p className="text-[9px] md:text-[10px] text-muted-foreground leading-tight">
              Max file size: 10MB. Once uploaded, the student and selection committee will be notified automatically.
            </p>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/10 border-t flex flex-col items-center p-5 md:p-6 gap-2">
          <p className="text-[9px] md:text-[10px] text-muted-foreground text-center italic">
            By uploading, you verify that this document is an authentic evaluation of the candidate.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
