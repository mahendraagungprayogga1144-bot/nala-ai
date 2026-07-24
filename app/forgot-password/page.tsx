"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getAppOrigin } from "@/lib/auth/app-url";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    const supabase = createClient();
    // Prefer production URL so email links never fall back to localhost Site URL mismatches.
    const origin = getAppOrigin(window.location.origin);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message || "Gagal kirim email. Coba lagi.");
      return;
    }
    setSent(true);
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#0A0A12] px-6 text-[#F2F1F8]">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-gercep.png" alt="Gercep AI" className="h-10 w-10 rounded-xl object-cover" />
            <span>
              Gercep<span className="holo-text">AI</span>
            </span>
          </Link>
          <h1 className="mt-6 mb-2 text-2xl font-semibold">Lupa kata sandi?</h1>
          <p className="text-sm text-[#8B8AA0]">
            Masukkan email akun kamu. Kami kirim link reset ke Gmail/inbox — otomatis dari sistem.
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 p-5 text-center">
            <CheckCircle2 size={28} className="mx-auto mb-3 text-[#2DD4BF]" />
            <p className="mb-1 font-semibold text-[#F0EFF8]">Cek email kamu</p>
            <p className="text-sm leading-relaxed text-[#8B8AA0]">
              Link reset sudah dikirim ke <span className="text-[#2DD4BF]">{email}</span>. Buka inbox
              (dan folder Spam), lalu tap link untuk buat kata sandi baru.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex items-center gap-1.5 text-sm text-[#2DD4BF] hover:underline"
            >
              <ArrowLeft size={14} /> Kembali ke login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs text-[#8B8AA0]">Email terdaftar</label>
              <div className="relative">
                <Mail size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-[#5A5B7A]" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0F0F1A] py-3 pr-4 pl-10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:border-[#2DD4BF]/50 focus:outline-none"
                  placeholder="email@gmail.com"
                />
              </div>
            </div>

            {error && <p className="text-sm text-[#EC4899]">{error}</p>}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="mt-1 w-full rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] py-3.5 font-semibold text-[#0A0A12] disabled:opacity-50"
            >
              {loading ? "Mengirim..." : "Kirim link reset"}
            </button>

            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 text-sm text-[#8B8AA0] hover:text-[#2DD4BF]"
            >
              <ArrowLeft size={14} /> Kembali ke login
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
