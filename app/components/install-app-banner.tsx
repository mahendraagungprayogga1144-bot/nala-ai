"use client";
import { useEffect, useState } from "react";
import { Download, Share, X, Smartphone } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "gercep_install_dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isMobileUa() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

/** Banner: pasang Gercep ke HP biar terasa seperti aplikasi (sebelum Play Store). */
export default function InstallAppBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (!isMobileUa()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
      setIosHint(false);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // iOS: no beforeinstallprompt — show Share tip after short delay
    if (isIos()) {
      const t = setTimeout(() => {
        if (!isStandalone() && localStorage.getItem(DISMISS_KEY) !== "1") {
          setIosHint(true);
          setShow(true);
        }
      }, 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBip);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-0 z-[55] px-3 md:hidden"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-[#2DD4BF]/30 bg-[#0F0F1A]/95 p-3.5 shadow-[0_8px_40px_rgba(0,0,0,.55)] backdrop-blur-lg">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2DD4BF]/15">
          <Smartphone size={18} className="text-[#2DD4BF]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#F0EFF8]">Pasang Gercep di HP</p>
          {iosHint ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#8B8AA0]">
              Tap <Share size={11} className="inline text-[#2DD4BF]" /> lalu{" "}
              <span className="text-[#F0EFF8]">Add to Home Screen</span> — buka seperti aplikasi, tanpa Play Store.
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#8B8AA0]">
              Install ke layar utama. Buka full-screen seperti app — cocok untuk kasir & stok di HP.
            </p>
          )}
          <div className="mt-2.5 flex gap-2">
            {!iosHint && deferred && (
              <button
                type="button"
                onClick={install}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-[#070711]"
                style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)" }}
              >
                <Download size={12} /> Pasang sekarang
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-xl border border-white/10 px-3 py-1.5 text-[11px] text-[#8B8AA0]"
            >
              Nanti
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} className="shrink-0 p-1 text-[#5A5B7A]" aria-label="Tutup">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
