// Shared family email guard: verifies that an email address stored on a
// ProtectedSenior record matches the actual platform email of the referenced
// user. This prevents email relay attacks where a user creates a
// ProtectedSenior with an arbitrary guardian_email or email via the entity
// API (bypassing addFamilyMember, which correctly derives guardian_email
// from the authenticated user's platform email).

export async function verifyFamilyEmail(
  base44: any,
  userId: string | null | undefined,
  email: string | null | undefined,
): Promise<boolean> {
  if (!userId || !email) return false;
  try {
    const u = await base44.asServiceRole.entities.User.get(userId);
    if (!u?.email) return false;
    return u.email.toLowerCase() === String(email).toLowerCase();
  } catch {
    return false;
  }
}