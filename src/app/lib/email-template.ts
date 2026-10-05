/**
 * Shared presentation layer for every outbound email.
 *
 * Mail clients strip <style> blocks, external CSS and most modern layout, so
 * this renders old-fashioned nested tables with inline styles only. Every
 * notification goes through renderEmail() so the branding stays in one place
 * instead of drifting across the individual templates.
 */

import fs from 'fs';
import path from 'path';

const BRAND_NAME = 'ScholarShip';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');

/**
 * The brand mark in the header.
 *
 * Mail clients cannot render inline SVG or data URIs, so the mark has to be a
 * real image. By default it is attached to the message and referenced by
 * Content-ID, which is what makes it show up even on localhost where no public
 * URL exists. Setting EMAIL_LOGO_URL to a hosted square mark switches to a
 * plain <img src>, which keeps the message smaller once the app is deployed.
 */
const LOGO_URL = process.env.EMAIL_LOGO_URL || '';
export const EMAIL_LOGO_CID = 'scholarship-logo';
const EMAIL_LOGO_PATH = path.join(process.cwd(), 'public', 'email-logo.png');

const hasEmbeddedLogo = (() => {
  try {
    return !LOGO_URL && fs.existsSync(EMAIL_LOGO_PATH);
  } catch {
    return false;
  }
})();

/**
 * The attachment that backs `cid:` above, or undefined when the logo is hosted
 * or missing. Spread into nodemailer's `attachments`.
 */
export function getEmailLogoAttachment() {
  if (!hasEmbeddedLogo) return undefined;
  return { filename: 'email-logo.png', path: EMAIL_LOGO_PATH, cid: EMAIL_LOGO_CID };
}

const COLORS = {
  pageBg: '#f1f5f9',
  cardBg: '#ffffff',
  brandBg: '#020817',
  brandText: '#ffffff',
  ink: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  footerBg: '#f8fafc',
} as const;

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Interpolated names and titles are user supplied, so they cannot go in raw. */
export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface EmailContent {
  /** Headline inside the card. */
  title: string;
  /** Hidden preview line shown in the inbox list next to the subject. */
  preheader?: string;
  /** e.g. "Hello Shashank," */
  greeting?: string;
  /** Body paragraphs. Safe HTML only — run escapeHtml over anything dynamic. */
  body: string[];
  /** Primary call to action. */
  button?: { label: string; url: string };
  /** Shown under the button for clients that strip it. */
  showPlainLink?: boolean;
  /** Small print above the footer. */
  note?: string;
}

function renderLogo(): string {
  const wordmark = `<span style="font-family:${FONT_STACK};font-size:22px;line-height:28px;font-weight:700;color:${COLORS.brandText};letter-spacing:-0.4px;white-space:nowrap;">${BRAND_NAME}</span>`;

  const src = LOGO_URL ? escapeHtml(LOGO_URL) : hasEmbeddedLogo ? `cid:${EMAIL_LOGO_CID}` : '';
  if (!src) return wordmark;

  // A two-cell table rather than vertical-align on the image itself: Outlook
  // ignores the latter and drops the wordmark onto its own line.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:12px;">
                    <img src="${src}" width="40" height="40" alt="${BRAND_NAME}" style="display:block;border:0;outline:none;text-decoration:none;width:40px;height:40px;border-radius:10px;" />
                  </td>
                  <td valign="middle">${wordmark}</td>
                </tr>
              </table>`;
}

function renderButton(button: { label: string; url: string }): string {
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px 0;">
                <tr>
                  <td align="center" bgcolor="${COLORS.ink}" style="border-radius:8px;">
                    <a href="${escapeHtml(button.url)}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:${FONT_STACK};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(button.label)}</a>
                  </td>
                </tr>
              </table>`;
}

export function renderEmail(content: EmailContent): string {
  const year = new Date().getFullYear();

  const preheader = content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(content.preheader)}</div>`
    : '';

  const greeting = content.greeting
    ? `<p style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:15px;line-height:24px;color:${COLORS.ink};">${content.greeting}</p>`
    : '';

  const paragraphs = content.body
    .map(
      (line) =>
        `<p style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:15px;line-height:24px;color:${COLORS.ink};">${line}</p>`
    )
    .join('\n              ');

  const button = content.button ? renderButton(content.button) : '';

  const plainLink =
    content.button && content.showPlainLink
      ? `<p style="margin:8px 0 0 0;font-family:${FONT_STACK};font-size:13px;line-height:20px;color:${COLORS.muted};">If the button does not work, copy and paste this link into your browser:<br /><a href="${escapeHtml(content.button.url)}" style="color:${COLORS.ink};word-break:break-all;">${escapeHtml(content.button.url)}</a></p>`
      : '';

  const note = content.note
    ? `<p style="margin:24px 0 0 0;padding-top:20px;border-top:1px solid ${COLORS.border};font-family:${FONT_STACK};font-size:13px;line-height:20px;color:${COLORS.muted};">${content.note}</p>`
    : '';

  const footerLink = APP_URL
    ? `<a href="${escapeHtml(APP_URL)}" style="color:${COLORS.muted};text-decoration:underline;">${escapeHtml(APP_URL.replace(/^https?:\/\//, ''))}</a><br />`
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(content.title)}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${COLORS.pageBg};-webkit-text-size-adjust:100%;">
${preheader}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${COLORS.pageBg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background-color:${COLORS.cardBg};border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td align="left" bgcolor="${COLORS.brandBg}" style="padding:24px 32px;background-color:${COLORS.brandBg};">
              ${renderLogo()}
            </td>
          </tr>
          <tr>
            <td align="left" style="padding:32px;">
              <h1 style="margin:0 0 20px 0;font-family:${FONT_STACK};font-size:21px;line-height:28px;font-weight:700;color:${COLORS.ink};letter-spacing:-0.3px;">${escapeHtml(content.title)}</h1>
              ${greeting}
              ${paragraphs}
              ${button}
              ${plainLink}
              ${note}
            </td>
          </tr>
          <tr>
            <td align="left" bgcolor="${COLORS.footerBg}" style="padding:20px 32px;background-color:${COLORS.footerBg};border-top:1px solid ${COLORS.border};">
              <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:19px;color:${COLORS.muted};">
                ${footerLink}You are receiving this email because of your activity on ${BRAND_NAME}.<br />
                &copy; ${year} ${BRAND_NAME}. Please do not reply to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Wraps content that was authored elsewhere (an AI-generated invitation body,
 * for example) in the same shell so no email escapes the branding.
 */
export function renderEmailFromHtml(title: string, innerHtml: string, preheader?: string): string {
  return renderEmail({ title, preheader, body: [innerHtml] });
}

/** Absolute link into the app, or undefined when no public URL is configured. */
export function appUrl(path = ''): string | undefined {
  return APP_URL ? `${APP_URL}${path}` : undefined;
}

/** Turns plain text (AI-generated invitation bodies) into safe, linked HTML. */
export function textToHtml(text: string): string {
  return escapeHtml(text)
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      `<a href="$1" style="color:${COLORS.ink};word-break:break-all;">$1</a>`
    )
    .replace(/\n/g, '<br />');
}
