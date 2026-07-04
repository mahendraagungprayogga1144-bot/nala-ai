"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo/config";
import { signInDemoAccount } from "@/lib/demo/auth-client";
import { registerAccount } from "@/lib/auth/register-client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await registerAccount(supabase, { name, email, password });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  };

  const handleDemoSignup = async () => {
    setError("");
    setLoading(true);
    const result = await signInDemoAccount(supabase);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/owner");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[#0A0A12] text-[#F2F1F8] flex items-center justify-center px-6">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-2 font-semibold text-lg"><img src="/logo-gercep.png" alt="Gercep AI" className="h-10 w-10 rounded-xl object-cover" /><span>Gercep<span className="holo-text">AI</span></span></a>
          <h1 className="text-2xl font-semibold mt-6 mb-2">Buat akun kamu</h1>
          <p className="text-sm text-[#8B8AA0]">Daftar gratis — kelola bisnis sendiri, bukan akun demo.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-[#8B8AA0] mb-1.5 block">Nama lengkap</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[#0F0F1A] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" placeholder="Nama kamu" />
          </div>
          <div>
            <label className="text-xs text-[#8B8AA0] mb-1.5 block">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[#0F0F1A] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" placeholder="email@kamu.com" />
          </div>
          <div>
            <label className="text-xs text-[#8B8AA0] mb-1.5 block">Password</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[#0F0F1A] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" placeholder="Minimal 6 karakter" />
          </div>

          {error && <p className="text-sm text-[#EC4899]">{error}</p>}

          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[#0A0A12] font-semibold disabled:opacity-50 mt-2">
            {loading ? "Membuat akun..." : "Daftar Akun Saya"}
          </button>
        </form>

        <p className="text-center text-sm text-[#8B8AA0] mt-6">Udah punya akun? <a href="/login" className="text-[#2DD4BF]">Masuk di sini</a></p>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-[#0A0A12] px-3 text-[#5A5B7A]">hanya mau lihat-lihat?</span></div>
        </div>

        <button type="button" onClick={handleDemoSignup} disabled={loading}
          className="w-full py-3 rounded-xl border border-white/10 text-[#8B8AA0] text-sm hover:bg-white/[0.03] disabled:opacity-50">
          Coba akun demo ({DEMO_EMAIL})
        </button>
      </div>
    </main>
  );
}
