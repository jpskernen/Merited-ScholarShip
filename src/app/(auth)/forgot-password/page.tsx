'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, initiatePasswordReset } from '@/firebase';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setIsSending(true);

    try {
      // Non-blocking call
      initiatePasswordReset(auth, email);
      
      toast({
        title: 'Check your email',
        description: 'If an account exists for ' + email + ', we have sent a password reset link.',
      });
      
      // Clear email after sending
      setEmail('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleReset}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            Enter your email address and we&apos;ll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSending}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isSending}>
            {isSending ? 'Sending Link...' : 'Send Reset Link'}
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="flex items-center justify-center font-medium text-primary hover:underline">
              <ChevronLeft className="mr-1 h-4 w-4" /> Back to Login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
