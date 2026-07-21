export function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function encodeSubject(subject: string): string {
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  const bytes = new TextEncoder().encode(subject);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return '=?UTF-8?B?' + btoa(binary) + '?=';
}

export async function getGmailSenderEmail(accessToken: string): Promise<string> {
  const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await profileRes.json();
  return profile.emailAddress || 'me';
}

export async function sendGmailEmail(
  accessToken: string,
  senderEmail: string,
  toName: string,
  toEmail: string,
  subject: string,
  bodyText: string
): Promise<boolean> {
  const mimeMessage = [
    `From: Vardin <${senderEmail}>`,
    `To: ${toName} <${toEmail}>`,
    `Subject: ${encodeSubject(subject)}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `MIME-Version: 1.0`,
    ``,
    bodyText,
  ].join('\r\n');

  const raw = base64UrlEncode(mimeMessage);

  const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  return sendRes.ok;
}