"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerAccount } from "@/lib/auth/register-client";
import { clearFastGateCookies } from "@/lib/auth/post-login";
import { TRIAL_DAYS } from "@/lib/auth/trial";
import { Check, Eye, EyeOff } from "lucide-react";

function safeNext(raw: string | null) {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.startsWith("/login") || raw.startsWith("/signup")) return null;
  return raw;
}

function SignupForm() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const preferredNext = safeNext(searchParams.get("next"));
  const trackingNext = preferredNext?.startsWith("/t/") ? preferredNext : null;
  const prefillNama = (searchParams.get("nama") || "").trim();
  const [name, setName] = useState(prefillNama);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupOpen, setSignupOpen] = useState(true);
  const [trialDays, setTrialDays] = useState(TRIAL_DAYS);
  const [supportEmail, setSupportEmail] = useState("hellogercepai@gmail.com");

  useEffect(() => {
    fetch("/api/public/platform")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.signup_open === "boolean") setSignupOpen(d.signup_open);
        if (typeof d.trial_days === "number") setTrialDays(d.trial_days);
        if (d.support_email) setSupportEmail(String(d.support_email));
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!signupOpen) {
      setError("Pendaftaran sedang ditutup.");
      return;
    }

    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setLoading(true);
    const result = await registerAccount(supabase, { name, email, password });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    clearFastGateCookies();
    window.location.assign(trackingNext || "/onboarding");
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#12141A] px-6 py-10 text-[#F4F1EA]">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 text-center">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-lg font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-gercep.png" alt="" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
            <span>Gercep AI</span>
          </Link>
          <h1 className="mt-6 mb-2 text-2xl font-semibold">{trackingNext ? "Buat akun check-in" : "Buat akun bisnis"}</h1>
          <p className="text-sm text-[#C8C2B6]">
            {trackingNext ? (
              <>Daftar sekali di HP sales. Setelah itu langsung kembali ke halaman check-in.</>
            ) : (
              <>
                Daftar gratis, trial penuh <span className="font-medium text-[#E9D5FF]">{trialDays} hari</span>
              </>
            )}
          </p>
        </div>

        {trackingNext ? (
          <div className="mb-5 rounded-lg border border-[#8A8478] bg-[#1A1D24] px-4 py-3 text-[13px] leading-5 text-[#C8C2B6]">
            Ini akun sales lapangan, bukan akun owner. Pakai email HP sendiri. Setelah daftar, buka lagi link check-in dari founder.
          </div>
        ) : (
          <div className="mb-5 rounded-lg border border-[#8A8478] bg-[#1A1D24] px-4 py-3">
            <p className="mb-2 text-sm font-medium text-[#F4F1EA]">
              Termasuk trial {trialDays} hari
            </p>
            <ul className="space-y-1.5 text-[13px] text-[#C8C2B6]">
              {[
                "Inventory & kasir sesuai jenis bisnis",
                "Keuangan bisnis otomatis tercatat",
                "Bisa upgrade kapan saja sebelum trial habis",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-[#E9D5FF]" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="mb-1.5 block text-xs text-[#C8C2B6]" htmlFor="signup-name">Nama lengkap</label>
            <input
              id="signup-name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#8A8478] bg-[#1A1D24] px-4 py-3 text-[#F4F1EA] placeholder:text-[#A39E93]"
              placeholder="Nama kamu"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[#C8C2B6]" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#8A8478] bg-[#1A1D24] px-4 py-3 text-[#F4F1EA] placeholder:text-[#A39E93]"
              placeholder="email@gmail.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[#C8C2B6]" htmlFor="signup-password">Password</label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPw ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#8A8478] bg-[#1A1D24] py-3 pr-14 pl-4 text-[#F4F1EA] placeholder:text-[#A39E93]"
                placeholder="Minimal 6 karakter"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute top-1/2 right-1 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center text-[#C8C2B6] hover:text-[#F4F1EA]"
                aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPw ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[#C8C2B6]" htmlFor="signup-confirm">Ulangi password</label>
            <input
              id="signup-confirm"
              type={showPw ? "text" : "password"}
              required
              minLength={6}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-[#8A8478] bg-[#1A1D24] px-4 py-3 text-[#F4F1EA] placeholder:text-[#A39E93]"
              placeholder="Samakan password"
            />
          </div>

          {error && <p className="text-sm text-[#FB7185]" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 min-h-11 w-full rounded-lg bg-[#5B21B6] py-3.5 font-semibold text-[#F8F5FF] hover:bg-[#4C1D95] disabled:opacity-50"
          >
            {loading ? "Membuat akun..." : trackingNext ? "Daftar · lanjut check-in" : `Daftar · Trial ${trialDays} hari`}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#C8C2B6]">
          Sudah punya akun?{" "}
          <Link
            href={trackingNext ? `/login?next=${encodeURIComponent(trackingNext)}` : "/login"}
            className="text-[#E9D5FF] underline underline-offset-2"
          >
            Masuk di sini
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-[#C8C2B6]">
          Bantuan:{" "}
          <a href={`mailto:${supportEmail}`} className="underline">
            {supportEmail}
          </a>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#12141A] px-6 text-[#F4F1EA]">
          <p className="text-sm text-[#C8C2B6]">Memuat formulir daftar.</p>
        </main>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
