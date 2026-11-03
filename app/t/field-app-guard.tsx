"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  HENIMA_FIELD_APP_COOKIE,
  isFieldAppAllowedPath,
  rememberFieldToken,
} from "@/lib/henima-tracking/field-app";
import { isNativeApp } from "@/lib/henima-tracking/native-geo";

/**
 * Kunci app Cap: set cookie field-app + cegah navigasi ke Gercep OS internal.
 * Proxy ikut menolak path di luar /t saat cookie aktif.
 */
export default function FieldAppGuard() {
  const pathname = usePathname() || "/t";
  const router = useRouter();

  useEffect(() => {
    let alive = true;

    void (async () => {
      const native = await isNativeApp();
      if (!alive || !native) return;

      document.cookie = `${HENIMA_FIELD_APP_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;

      const match = pathname.match(/^\/t\/([a-f0-9]{32})$/i);
      if (match?.[1]) rememberFieldToken(match[1]);

      if (!isFieldAppAllowedPath(pathname)) {
        router.replace("/t");
      }
    })();

    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (!isFieldAppAllowedPath(url.pathname)) {
          event.preventDefault();
          event.stopPropagation();
          window.location.assign("/t");
        }
      } catch {
        /* ignore bad href */
      }
    }

    document.addEventListener("click", onClick, true);
    return () => {
      alive = false;
      document.removeEventListener("click", onClick, true);
    };
  }, [pathname, router]);

  return null;
}
