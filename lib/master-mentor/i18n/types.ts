export type MentorLocale = "id" | "en";

export const MENTOR_LOCALES: MentorLocale[] = ["id", "en"];

export const MENTOR_LOCALE_COOKIE = "mentor_locale";
export const MENTOR_LOCALE_STORAGE = "henima.mentor.locale";
export const MENTOR_LOCALE_DEFAULT: MentorLocale = "id";

export function isMentorLocale(value: unknown): value is MentorLocale {
  return value === "id" || value === "en";
}

export function resolveMentorLocale(raw: string | null | undefined): MentorLocale {
  const v = (raw || "").trim().toLowerCase();
  return isMentorLocale(v) ? v : MENTOR_LOCALE_DEFAULT;
}
