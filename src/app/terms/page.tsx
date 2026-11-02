import { SiteHeader } from '@/components/shared/SiteHeader';
import { SiteFooter } from '@/components/shared/SiteFooter';
import { getLegalContent } from '@/app/legal-actions';
import { LEGAL_PROSE } from '@/lib/legal-prose';

export default async function TermsPage() {
  const { terms } = await getLegalContent();

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background text-foreground font-sans">
      <SiteHeader />

      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Terms of Service</h1>
          <div className="mt-8">
            {terms ? (
              <div className={LEGAL_PROSE} dangerouslySetInnerHTML={{ __html: terms }} />
            ) : (
              <p className="text-sm text-muted-foreground italic">This page hasn&apos;t been published yet.</p>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
