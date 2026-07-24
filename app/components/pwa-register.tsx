"use client";
import { useEffect } from "react";
import InstallAppBanner from "./install-app-banner";

/** Registers SW (prod) + shows install banner so web feels like a mobile app. */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return <InstallAppBanner />;
}
