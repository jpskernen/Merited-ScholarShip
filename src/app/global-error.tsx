'use client';

import './globals.css';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4 text-center text-foreground">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold sm:text-3xl">Something went wrong</h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            This page could not be loaded. Please try again, or go back to the home page.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => reset()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border px-4 py-2 text-sm font-medium">
            Back to home
          </a>
        </div>
      </body>
    </html>
  );
}
