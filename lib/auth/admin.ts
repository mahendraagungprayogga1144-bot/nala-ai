/** Single source of truth for platform admin access. */
export const FALLBACK_ADMIN_EMAIL = "mahendraagungprayogga1144@gmail.com";

export function normalizeEmail(email: string | null | undefined) {
  return (email || "").trim().toLowerCase();
}

export function isAdminEmail(
  email: string | null | undefined,
  adminEmails?: string[] | null,
) {
  const e = normalizeEmail(email);
  if (!e) return false;
  const list = (adminEmails && adminEmails.length > 0
    ? adminEmails
    : [FALLBACK_ADMIN_EMAIL]
  ).map(normalizeEmail);
  return list.includes(e);
}
