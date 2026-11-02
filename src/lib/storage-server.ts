
import 'server-only';
import { randomUUID } from 'crypto';
import { getAdminBucket } from '@/firebase/admin';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function assertPdf(file: File): string | null {
  if (file.type !== 'application/pdf') return 'Only PDF documents are accepted.';
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_UPLOAD_BYTES) return 'File too large. Please upload a PDF under 10MB.';
  return null;
}

/** Uploads `file` to `path` and returns a public Firebase Storage download URL for it. */
export async function uploadPdf(path: string, file: File): Promise<string> {
  const bucket = getAdminBucket();
  const token = randomUUID();
  const bytes = Buffer.from(await file.arrayBuffer());

  await bucket.file(path).save(bytes, {
    contentType: 'application/pdf',
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}
