"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Lock } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Pastikan ada sesi recovery dari link email
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError("Link reset tidak valid atau sudah kedaluwarsa. Minta link baru.");
        return;
      }
      setReady(true);
    });
  }, []);

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
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message || "Gagal ubah password.");
      return;
    }
    setDone(true);
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
          <h1 className="mt-6 mb-2 text-2xl font-semibold">Buat kata sandi baru</h1>
          <p className="text-sm text-[#8B8AA0]">Setelah diganti, kamu bisa masuk dengan password baru.</p>
        </div>

        {done ? (
          <div className="rounded-2xl border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 p-5 text-center">
            <CheckCircle2 size={28} className="mx-auto mb-3 text-[#2DD4BF]" />
            <p className="mb-1 font-semibold">Password berhasil diganti</p>
            <p className="mb-4 text-sm text-[#8B8AA0]">Silakan masuk dengan kata sandi baru.</p>
            <Link
              href="/login"
              className="inline-block w-full rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] py-3 font-semibold text-[#0A0A12]"
            >
              Ke halaman masuk
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs text-[#8B8AA0]">Password baru</label>
              <div className="relative">
                <Lock size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-[#5A5B7A]" />
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!ready && !error}
                  className="w-full rounded-xl border border-white/10 bg-[#0F0F1A] py-3 pr-4 pl-10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:border-[#2DD4BF]/50 focus:outline-none disabled:opacity-50"
                  placeholder="Minimal 6 karakter"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#8B8AA0]">Ulangi password</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={!ready && !error}
                className="w-full rounded-xl border border-white/10 bg-[#0F0F1A] px-4 py-3 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:border-[#2DD4BF]/50 focus:outline-none disabled:opacity-50"
                placeholder="Samakan dengan di atas"
              />
            </div>

            {error && <p className="text-sm text-[#EC4899]">{error}</p>}

            <button
              type="submit"
              disabled={loading || !ready}
              className="mt-1 w-full rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] py-3.5 font-semibold text-[#0A0A12] disabled:opacity-50"
            >
              {loading ? "Menyimpan..." : "Simpan password baru"}
            </button>

            {!ready && !error && <p className="text-center text-xs text-[#5A5B7A]">Memverifikasi link...</p>}
            {error && !ready && (
              <Link href="/forgot-password" className="text-center text-sm text-[#2DD4BF] hover:underline">
                Minta link reset baru
              </Link>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
