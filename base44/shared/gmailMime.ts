// Shared Gmail MIME helpers used by functions that send email through the Gmail connector.

export function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Strip CR/LF and trim to prevent header injection from user-controlled
// names, subjects, and email addresses interpolated into MIME headers.
function sanitizeHeader(s: string): string {
  return String(s || '').replace(/[\r\n]+/g, ' ').trim();
}

export function encodeSubject(subject: string): string {
  const sanitized = sanitizeHeader(subject);
  if (/^[\x00-\x7F]*$/.test(sanitized)) return sanitized;
  const bytes = new TextEncoder().encode(sanitized);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return '=?UTF-8?B?' + btoa(binary) + '?=';
}

export function buildMimeMessage(senderEmail: string, toName: string, toEmail: string, subject: string, bodyText: string): string {
  const safeName = sanitizeHeader(toName);
  const safeEmail = sanitizeHeader(toEmail).replace(/\s+/g, '');
  const safeSender = sanitizeHeader(senderEmail).replace(/\s+/g, '');
  return [
    `From: Vardin Alerts <${safeSender}>`,
    `To: ${safeName} <${safeEmail}>`,
    `Subject: ${encodeSubject(subject)}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `MIME-Version: 1.0`,
    ``,
    bodyText,
  ].join('\r\n');
}

export async function sendGmail(accessToken: string, mimeMessage: string): Promise<boolean> {
  const raw = base64UrlEncode(mimeMessage);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  return res.ok;
}

export async function getGmailSenderEmail(accessToken: string): Promise<string> {
  const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await profileRes.json();
  return profile.emailAddress || 'me';
}