// src/lib/legal-server.ts
//
// Terms and Privacy text, editable by a platform admin (System Admin >
// Legal Content) instead of being hardcoded, so updating them doesn't need a
// developer. Read through the Admin SDK rather than opening a Firestore rule
// for it, matching how other public content (org-actions.ts) is served.
import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import sanitizeHtml from 'sanitize-html';
import { getAdminDb } from '@/firebase/admin';
import type { Caller } from './auth-server';

export type LegalContent = { terms: string; privacy: string };

const DOC_PATH = ['platformSettings', 'legal'] as const;



function decodeEscapedTags(html: string): string {
  if (!/&lt;\/?[a-z][a-z0-9]*/i.test(html)) return html;
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function sanitize(html: string): string {
  const clean = sanitizeHtml(decodeEscapedTags(html), {
    allowedTags: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'blockquote'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
    },
  });
  // Collapse whitespace between tags (newlines in the source HTML), which the
  // editor would otherwise turn into empty list items / blank lines. Inline
  // spaces inside text (e.g. "</strong> support@...") are untouched because
  // they aren't bounded by two tags.
  return clean.replace(/>\s+</g, '><').trim();
}

export async function getLegalContent(): Promise<LegalContent> {
  const snap = await getAdminDb().collection(DOC_PATH[0]).doc(DOC_PATH[1]).get();
  const data = snap.data();
  return { terms: sanitize(data?.terms || ''), privacy: sanitize(data?.privacy || '') };
}

export async function saveLegalContentAs(caller: Caller, content: LegalContent): Promise<void> {
  await getAdminDb().collection(DOC_PATH[0]).doc(DOC_PATH[1]).set({
    terms: sanitize(content.terms.trim()),
    privacy: sanitize(content.privacy.trim()),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: caller.uid,
  }, { merge: true });
}
