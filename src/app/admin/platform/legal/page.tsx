'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, FileText, ShieldAlert } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { getLegalContent } from '@/app/legal-actions';
import { saveLegalContent } from '@/app/admin/platform-actions';
import { RichTextEditor } from '@/components/shared/RichTextEditor';

// Lets a platform admin write and update the Terms and Privacy text shown at
// /terms and /privacy without a developer. The public pages render whatever
// is saved here (src/lib/legal-server.ts).
export default function LegalContentPage() {
  const { user, userData } = useFirebase();
  const { toast } = useToast();
  const isPlatformAdmin = userData?.platformAdmin === true;

  const [isLoading, setIsLoading] = useState(true);
  const [terms, setTerms] = useState('');
  const [privacy, setPrivacy] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLegalContent().then((content) => {
      if (cancelled) return;
      setTerms(content.terms);
      setPrivacy(content.privacy);
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const result = await saveLegalContent(await user.getIdToken(), { terms, privacy });
      if (result.success) {
        toast({ title: 'Saved', description: 'The Terms and Privacy pages now show this text.' });
      } else {
        toast({ title: 'Save failed', description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!isPlatformAdmin) {
    return (
      <Card className="max-w-2xl">
        <CardContent className="p-8 flex items-center gap-3 text-muted-foreground">
          <ShieldAlert className="h-5 w-5" /> Only a platform administrator can edit this content.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><FileText className="h-5 w-5" /> Legal Content</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Edit the text shown at /terms and /privacy. Changes take effect as soon as you save.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Card>
          <CardContent className="p-4">
            <Tabs defaultValue="terms">
              <div className="flex items-center justify-between gap-3">
                <TabsList>
                  <TabsTrigger value="terms">Terms of Service</TabsTrigger>
                  <TabsTrigger value="privacy">Privacy Policy</TabsTrigger>
                </TabsList>
                <Button onClick={handleSave} disabled={isSaving} className="font-bold">
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </div>

              <TabsContent value="terms">
                <RichTextEditor value={terms} onChange={setTerms} placeholder="Write the Terms of Service here..." />
              </TabsContent>
              <TabsContent value="privacy">
                <RichTextEditor value={privacy} onChange={setPrivacy} placeholder="Write the Privacy Policy here..." />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
