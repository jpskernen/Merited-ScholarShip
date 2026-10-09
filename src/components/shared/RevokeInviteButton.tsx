'use client';

import { Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

/**
 * Trash button that asks before revoking an invitation. Used by the reviewer,
 * administrator and organization invite lists, where a single misclick used to
 * delete the invite and kill its link (backlog C-7).
 */
export function RevokeInviteButton({
  email,
  onConfirm,
  compact = false,
}: {
  email: string;
  onConfirm: () => void | Promise<void>;
  /** Smaller icon button for dense rows. */
  compact?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon' : 'sm'}
          className={compact ? 'h-7 w-7' : undefined}
          title="Revoke invitation"
        >
          <Trash2 className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-destructive')} />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
          <AlertDialogDescription>
            The invitation for <span className="font-semibold">{email}</span> will be deleted and its link will stop
            working immediately. You can send a new invitation later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={() => onConfirm()}>
            Revoke
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
