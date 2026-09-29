'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * The reviewer dashboard lives at /review. This route previously held a second,
 * parallel implementation built on the nested
 * organizations/{org}/scholarships/{id}/applications model, but submissions are
 * only ever written under the hardcoded 'general-portfolio' scholarship id, so
 * its queue was always empty. Kept as a redirect so existing links still work.
 */
export default function ReviewerDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/review');
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
