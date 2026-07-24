"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DEMO_EMAIL } from "@/lib/demo/config";
import { signInDemoAccount } from "@/lib/demo/auth-client";
import { registerAccount } from "@/lib/auth/register-client";
import { homeForBizType, setFastGateCookies } from "@/lib/auth/post-login";
import { TRIAL_DAYS } from "@/lib/auth/trial";
import { Check, Eye, EyeOff } from "lucide-react";

export default function SignupPage() {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");

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

    window.location.assign("/onboarding");
  };

  const handleDemoSignup = async () => {
    if (loading) return;
    setError("");
    setLoading(true);
    const result = await signInDemoAccount(supabase);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (userId) {
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id, type")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1);
      const b = businesses?.[0];
      if (b) setFastGateCookies({ businessId: b.id });
      window.location.assign(homeForBizType(b?.type));
      return;
    }
    window.location.assign("/dashboard/inventory");
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#0A0A12] px-6 py-10 text-[#F2F1F8]">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-gercep.png" alt="Gercep AI" className="h-10 w-10 rounded-xl object-cover" />
            <span>
              Gercep<span className="holo-text">AI</span>
            </span>
          </Link>
          <h1 className="mt-6 mb-2 text-2xl font-semibold">Buat akun bisnis</h1>
          <p className="text-sm text-[#8B8AA0]">
            Daftar gratis · trial penuh <span className="font-medium text-[#2DD4BF]">{TRIAL_DAYS} hari</span>
          </p>
        </div>

        <div className="mb-5 rounded-2xl border border-[#2DD4BF]/20 bg-[#2DD4BF]/[0.06] px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-[#2DD4BF] uppercase">
            Termasuk trial {TRIAL_DAYS} hari
          </p>
          <ul className="space-y-1.5 text-[12px] text-[#8B8AA0]">
            {[
              "Inventory & kasir sesuai jenis bisnis",
              "Keuangan bisnis otomatis tercatat",
              "Bisa upgrade kapan saja sebelum trial habis",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check size={14} className="mt-0.5 shrink-0 text-[#2DD4BF]" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="mb-1.5 block text-xs text-[#8B8AA0]">Nama lengkap</label>
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0F0F1A] px-4 py-3 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:border-[#2DD4BF]/50 focus:outline-none"
              placeholder="Nama kamu"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[#8B8AA0]">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0F0F1A] px-4 py-3 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:border-[#2DD4BF]/50 focus:outline-none"
              placeholder="email@gmail.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[#8B8AA0]">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0F0F1A] py-3 pr-11 pl-4 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:border-[#2DD4BF]/50 focus:outline-none"
                placeholder="Minimal 6 karakter"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-[#5A5B7A] hover:text-[#8B8AA0]"
                aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[#8B8AA0]">Ulangi password</label>
            <input
              type={showPw ? "text" : "password"}
              required
              minLength={6}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0F0F1A] px-4 py-3 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:border-[#2DD4BF]/50 focus:outline-none"
              placeholder="Samakan password"
            />
          </div>

          {error && <p className="text-sm text-[#EC4899]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] py-3.5 font-semibold text-[#0A0A12] disabled:opacity-50"
          >
            {loading ? "Membuat akun..." : `Daftar · Trial ${TRIAL_DAYS} hari`}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#8B8AA0]">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-[#2DD4BF] hover:underline">
            Masuk di sini
          </Link>
        </p>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#0A0A12] px-3 text-[#5A5B7A]">atau coba dulu</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleDemoSignup()}
          disabled={loading}
          className="w-full rounded-xl border border-white/10 py-3 text-sm text-[#8B8AA0] hover:bg-white/[0.03] disabled:opacity-50"
        >
          Masuk akun demo ({DEMO_EMAIL})
        </button>
        <p className="mt-2 text-center text-[10px] text-[#5A5B7A]">
          Demo juga terbatas trial {TRIAL_DAYS} hari — data contoh untuk eksplorasi.
        </p>
      </div>
    </main>
  );
}
