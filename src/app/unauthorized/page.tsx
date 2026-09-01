'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border-destructive/20 shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 bg-destructive/10 rounded-full">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
          <CardDescription>
            You do not have the required administrative permissions to view this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          If you believe this is an error, please contact the system administrator or verify you are logged in with the correct account.
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button asChild className="w-full" variant="default">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" /> Return to Dashboard
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/login">Switch Account</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
