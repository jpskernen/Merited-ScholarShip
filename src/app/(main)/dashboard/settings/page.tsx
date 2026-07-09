'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUser, useAuth, initiatePasswordReset } from '@/firebase';
import { ShieldCheck, Mail, Key, Loader2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SettingsPage() {
  const { user, role } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const handlePasswordReset = async () => {
    if (!auth || !user?.email) return;
    setIsSending(true);
    try {
      await initiatePasswordReset(auth, user.email);
      toast({
        title: "Recovery Email Sent",
        description: "A secure link to change your password has been sent to your inbox.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">Manage your credentials and security preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Security Profile
          </CardTitle>
          <CardDescription>Verified authentication details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label className="text-xs font-black uppercase text-muted-foreground">Login Email</Label>
            <div className="flex gap-2">
              <Input value={user?.email || ''} readOnly className="bg-muted font-medium" />
              <Badge variant="outline" className="flex items-center gap-1.5 px-3 bg-green-50 text-green-700 border-green-200">
                <ShieldCheck className="h-3 w-3" /> Verified
              </Badge>
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-black uppercase text-muted-foreground">System Role</Label>
            <Input value={role || 'Applicant'} readOnly className="bg-muted font-bold capitalize" />
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-bold mb-2">Password Management</h4>
            <p className="text-xs text-muted-foreground mb-4">
              To update your password, we will send a secure verification link to your registered email address.
            </p>
            <Button 
              variant="outline" 
              onClick={handlePasswordReset}
              disabled={isSending}
              className="w-full sm:w-auto font-bold border-primary/20 hover:bg-primary/5"
            >
              {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
              Request Password Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs text-amber-700 font-medium">
          Note: Reviewers and Administrators are onboarded via institutional invitation. 
          If your role is incorrect, please contact your scholarship coordinator.
        </AlertDescription>
      </Alert>
    </div>
  );
}
