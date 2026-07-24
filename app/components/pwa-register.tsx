"use client";
import { useEffect, useState } from "react";
import InstallAppBanner from "./install-app-banner";

/** Registers SW (prod) + shows install banner so web feels like a mobile app. */
export default function PwaRegister() {
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    fetch("/api/public/platform")
      .then((r) => r.json())
      .then((d) => {
        if (d?.feature_flags && d.feature_flags.pwa_banner === false) {
          setShowBanner(false);
        }
      })
      .catch(() => {});
  }, []);

  return showBanner ? <InstallAppBanner /> : null;
}
