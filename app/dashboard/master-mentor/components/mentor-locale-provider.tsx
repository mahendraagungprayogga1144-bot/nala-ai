"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  MENTOR_LOCALE_COOKIE,
  MENTOR_LOCALE_DEFAULT,
  MENTOR_LOCALE_STORAGE,
  getMentorDictionary,
  resolveMentorLocale,
  type MentorDictionary,
  type MentorLocale,
} from "@/lib/master-mentor/i18n";

type MentorLocaleContextValue = {
  locale: MentorLocale;
  t: MentorDictionary;
  setLocale: (next: MentorLocale) => void;
};

const MentorLocaleContext = createContext<MentorLocaleContextValue | null>(null);

function persistLocale(locale: MentorLocale) {
  try {
    window.localStorage.setItem(MENTOR_LOCALE_STORAGE, locale);
  } catch {
    /* ignore */
  }
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${MENTOR_LOCALE_COOKIE}=${locale}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function MentorLocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale?: MentorLocale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<MentorLocale>(
    initialLocale || MENTOR_LOCALE_DEFAULT,
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MENTOR_LOCALE_STORAGE);
      if (stored) {
        const resolved = resolveMentorLocale(stored);
        setLocaleState(resolved);
        persistLocale(resolved);
        return;
      }
    } catch {
      /* ignore */
    }
    persistLocale(initialLocale || MENTOR_LOCALE_DEFAULT);
  }, [initialLocale]);

  const setLocale = useCallback((next: MentorLocale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      t: getMentorDictionary(locale),
      setLocale,
    }),
    [locale, setLocale],
  );

  return <MentorLocaleContext.Provider value={value}>{children}</MentorLocaleContext.Provider>;
}

export function useMentorLocale() {
  const ctx = useContext(MentorLocaleContext);
  if (!ctx) {
    const t = getMentorDictionary(MENTOR_LOCALE_DEFAULT);
    return {
      locale: MENTOR_LOCALE_DEFAULT,
      t,
      setLocale: (_: MentorLocale) => undefined,
    };
  }
  return ctx;
}
