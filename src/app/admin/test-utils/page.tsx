
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Check, Copy, ExternalLink, Loader2, FlaskConical } from 'lucide-react';
import Link from 'next/link';

export default function TestUtilsPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const createTestToken = async () => {
    if (!firestore) return;
    setIsCreating(true);
    try {
      // Set expiry to 30 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const docRef = await addDoc(collection(firestore, 'recommendationTokens'), {
        studentName: "Test Student",
        scholarshipTitle: "Test Scholarship",
        recommenderName: "Test Teacher",
        recommenderEmail: "test@test.com",
        applicationId: "test-application-id",
        organizationId: "scholarship-hib4j",
        used: false,
        expiresAt,
        createdAt: serverTimestamp()
      });

      setCreatedToken(docRef.id);
      toast({ 
        title: "Test Token Created", 
        description: "A secure upload token has been added to Firestore." 
      });
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.message || "Failed to create test document.", 
        variant: "destructive" 
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyUrl = () => {
    if (!createdToken) return;
    const url = `${window.location.origin}/recommend/${createdToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied", description: "Recommender portal URL copied to clipboard." });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Development Utilities</h1>
        <p className="text-muted-foreground italic flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          Internal tools for verifying platform workflows and data structures.
        </p>
      </div>

      <Card className="border-dashed border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">Recommendation Portal Verification</CardTitle>
          <CardDescription>
            Generate a mock recommendation token to test the secure public upload portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md bg-muted p-4 space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Document Blueprint</h4>
            <pre className="text-[10px] overflow-auto">
{`{
  studentName: "Test Student",
  scholarshipTitle: "Test Scholarship",
  recommenderName: "Test Teacher",
  recommenderEmail: "test@test.com",
  applicationId: "test-application-id",
  organizationId: "scholarship-hib4j",
  used: false
}`}
            </pre>
          </div>

          <Button onClick={createTestToken} disabled={isCreating} className="w-full sm:w-auto">
            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
            {isCreating ? 'Creating Entry...' : 'Generate Test Token'}
          </Button>

          {createdToken && (
            <div className="p-4 rounded-xl border border-green-200 bg-green-50/50 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-700 font-bold text-xs">
                  <Check className="h-4 w-4" /> Token ID: {createdToken}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyUrl} className="h-8 text-[10px] bg-white">
                    <Copy className="h-3 w-3 mr-1" /> Copy Link
                  </Button>
                  <Button variant="default" size="sm" asChild className="h-8 text-[10px]">
                    <Link href={`/recommend/${createdToken}`} target="_blank">
                      <ExternalLink className="h-3 w-3 mr-1" /> Open Portal
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="text-[10px] font-mono p-2 bg-white border rounded break-all select-all">
                {window.location.origin}/recommend/{createdToken}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
