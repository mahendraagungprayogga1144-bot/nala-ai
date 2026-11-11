"use client";
import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { homeForBizType, setFastGateCookies, clearFastGateCookies } from "@/lib/auth/post-login";
import { trackClientEvent } from "@/lib/admin/track-event";
import { isAdminEmail, FALLBACK_ADMIN_EMAIL } from "@/lib/auth/admin";

function mapAuthError(message: string) {
  if (/invalid login credentials|invalid_credentials/i.test(message)) {
    return "Email atau password salah";
  }
  if (/email not confirmed/i.test(message)) {
    return "Email belum dikonfirmasi. Cek inbox atau hubungi admin.";
  }
  if (/too many requests|rate limit/i.test(message)) {
    return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  }
  return message || "Gagal masuk. Coba lagi.";
}

function safeNext(raw: string | null) {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.startsWith("/login") || raw.startsWith("/signup")) return null;
  return raw;
}

async function resolvePostLoginPath(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  preferredNext: string | null,
  userEmail?: string | null,
) {
  // Tim Gercep (admin) → command center, bukan onboarding bisnis
  try {
    const plat = await fetch("/api/public/platform").then((r) => r.json());
    if (preferredNext === "/admin") return "/admin";
    if (isAdminEmail(userEmail, plat.admin_emails || [FALLBACK_ADMIN_EMAIL])) {
      return "/admin";
    }
  } catch {
    if (isAdminEmail(userEmail, [FALLBACK_ADMIN_EMAIL, "henimascent@gmail.com", "dandy123@gmail.com"])) {
      return "/admin";
    }
  }

  // Satu query ringan — set cookie biar middleware tidak query lagi
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, type, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(5);

  const list = businesses || [];
  const hasReal = list.some((b) => !(b.type === "retail" && b.name === "Bisnis Utama") && b.type);

  if (!hasReal && list.length === 0) {
    if (preferredNext?.startsWith("/t/")) return preferredNext;
    clearFastGateCookies();
    return "/onboarding";
  }

  // Pertahankan bisnis aktif di cookie kalau masih milik user (jangan reset ke bisnis pertama)
  const cookieMatch = document.cookie.match(/(?:^|; )active_business_id=([^;]*)/);
  const existingId = cookieMatch ? decodeURIComponent(cookieMatch[1]) : "";
  const active = list.find((b) => b.id === existingId) || list[0];
  setFastGateCookies({ businessId: active?.id });

  if (preferredNext && preferredNext !== "/dashboard/owner") {
    return preferredNext;
  }

  return homeForBizType(active?.type);
}

function LoginForm() {
  const searchParams = useSearchParams();
  const preferredNext = safeNext(searchParams.get("next"));
  const trackingNext = preferredNext?.startsWith("/t/") ? preferredNext : null;
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(urlError ? mapAuthError(urlError) : "");
  const [loading, setLoading] = useState(false);
  const [trialDays, setTrialDays] = useState(5);
  const [supportEmail, setSupportEmail] = useState("hellogercepai@gmail.com");

  useEffect(() => {
    fetch("/api/public/platform")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.trial_days === "number") setTrialDays(d.trial_days);
        if (d.support_email) setSupportEmail(String(d.support_email));
      })
      .catch(() => {});
  }, []);

  const go = (path: string) => {
    window.location.assign(path);
  };

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });
      if (authError) {
        trackClientEvent({ event: "login_failed", module: "auth", meta: { reason: "credentials" } });
        setError(mapAuthError(authError.message));
        setLoading(false);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setError("Sesi gagal dibuat. Coba lagi.");
        setLoading(false);
        return;
      }

      trackClientEvent({ event: "login", module: "auth", path: "/login" });
      const path = await resolvePostLoginPath(supabase, userId, preferredNext, data.user?.email);
      go(path);
    } catch {
      setError("Koneksi gagal. Cek internet lalu coba lagi.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doLogin(email, password);
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#12141A] px-6 text-[#F4F1EA]">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-lg font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-gercep.png" alt="" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
            <span>Gercep AI</span>
          </Link>
          <h1 className="mt-6 mb-2 text-2xl font-semibold">{trackingNext ? "Masuk untuk check-in" : "Selamat datang lagi"}</h1>
          <p className="text-sm text-[#C8C2B6]">
            {trackingNext
              ? "Pakai akun HP sales kamu. Setelah masuk, kamu kembali ke halaman check-in."
              : "Masuk buat kelola semua bisnis kamu."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs text-[#C8C2B6]" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#8A8478] bg-[#1A1D24] px-4 py-3 text-[#F4F1EA] placeholder:text-[#A39E93]"
              placeholder="email@kamu.com"
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs text-[#C8C2B6]" htmlFor="login-password">Password</label>
              <a href="/forgot-password" className="text-[11px] text-[#E9D5FF] underline underline-offset-2">
                Lupa kata sandi?
              </a>
            </div>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[#8A8478] bg-[#1A1D24] px-4 py-3 text-[#F4F1EA] placeholder:text-[#A39E93]"
              placeholder="Password kamu"
            />
          </div>

          {error && <p className="text-sm text-[#FB7185]" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 min-h-11 w-full rounded-lg bg-[#5B21B6] py-3.5 font-semibold text-[#F8F5FF] hover:bg-[#4C1D95] disabled:opacity-50"
          >
            {loading ? "Masuk..." : "Masuk"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#C8C2B6]">
          Belum punya akun?{" "}
          <a
            href={trackingNext ? `/signup?next=${encodeURIComponent(trackingNext)}` : "/signup"}
            className="text-[#E9D5FF] underline underline-offset-2"
          >
            {trackingNext ? "Daftar sekali untuk check-in" : `Daftar gratis · trial ${trialDays} hari`}
          </a>
        </p>
        <p className="mt-3 text-center text-xs text-[#C8C2B6]">
          Bantuan:{" "}
          <a href={`mailto:${supportEmail}`} className="underline underline-offset-2">
            {supportEmail}
          </a>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#12141A] px-6 text-[#F4F1EA]">
          <p className="text-sm text-[#C8C2B6]">Memuat formulir masuk.</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
