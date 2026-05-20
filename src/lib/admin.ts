export const ADMIN_EMAILS = [
  "lennyhuynh526@gmail.com",
  "lenny@getescapehatch.com",
] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((adminEmail) => adminEmail === normalized);
}
