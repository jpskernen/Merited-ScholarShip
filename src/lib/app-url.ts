// src/lib/app-url.ts
//
// Base URL for links the server puts in emails (recommendation and invite
// links). Built on the server, never from a URL the browser sends, so a caller
// can't make a branded email point at another site (docs/13 S5, N4).
import 'server-only';

import { headers } from 'next/headers';

/** NEXT_PUBLIC_APP_URL when configured, otherwise the host this request was served on. */
export async function getAppBaseUrl(): Promise<string> {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  if (configured) return configured;

  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  if (!host) throw new Error('The app URL is not configured (NEXT_PUBLIC_APP_URL).');
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function appLink(path: string): Promise<string> {
  return (await getAppBaseUrl()) + path;
}
