"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo/config";
import { signInDemoAccount } from "@/lib/demo/auth-client";
import { homeForBizType, setFastGateCookies } from "@/lib/auth/post-login";

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
) {
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
    return "/onboarding";
  }

  const active = list[0];
  setFastGateCookies({ businessId: active?.id });

  // Kalau next spesifik (bukan owner berat), hormati
  if (preferredNext && preferredNext !== "/dashboard/owner") {
    return preferredNext;
  }

  // Default: hub ringan per tipe — bukan Dashboard Owner (paling berat)
  return homeForBizType(active?.type);
}

function LoginForm() {
  const searchParams = useSearchParams();
  const preferredNext = safeNext(searchParams.get("next"));
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(urlError ? mapAuthError(urlError) : "");
  const [loading, setLoading] = useState(false);

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

      const path = await resolvePostLoginPath(supabase, userId, preferredNext);
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

  const handleDemoLogin = async () => {
    if (loading) return;
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
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
      if (!userId) {
        go("/dashboard/inventory");
        return;
      }
      const path = await resolvePostLoginPath(supabase, userId, null);
      go(path);
    } catch {
      setError("Gagal masuk akun demo. Coba lagi.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#0A0A12] px-6 text-[#F2F1F8]">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <a href="/" className="inline-flex items-center gap-2 text-lg font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-gercep.png" alt="Gercep AI" className="h-10 w-10 rounded-xl object-cover" />
            <span>
              Gercep<span className="holo-text">AI</span>
            </span>
          </a>
          <h1 className="mt-6 mb-2 text-2xl font-semibold">Selamat datang lagi</h1>
          <p className="text-sm text-[#8B8AA0]">Masuk buat kelola semua bisnis kamu.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs text-[#8B8AA0]">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0F0F1A] px-4 py-3 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:border-[#2DD4BF]/50 focus:outline-none"
              placeholder="email@kamu.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[#8B8AA0]">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0F0F1A] px-4 py-3 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:border-[#2DD4BF]/50 focus:outline-none"
              placeholder="Password kamu"
            />
          </div>

          {error && <p className="text-sm text-[#EC4899]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] py-3.5 font-semibold text-[#0A0A12] disabled:opacity-50"
          >
            {loading ? "Masuk..." : "Masuk"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void handleDemoLogin()}
          disabled={loading}
          className="mt-3 w-full rounded-xl border border-violet-500/30 bg-violet-500/10 py-3.5 text-sm font-semibold text-violet-300 hover:bg-violet-500/20 disabled:opacity-50"
        >
          {loading ? "Menyiapkan demo..." : "Masuk Akun Demo"}
        </button>
        <p className="mt-2 text-center text-[10px] text-[#5A5B7A]">
          Demo: {DEMO_EMAIL} · {DEMO_PASSWORD}
        </p>

        <p className="mt-6 text-center text-sm text-[#8B8AA0]">
          Belum punya akun?{" "}
          <a href="/signup" className="text-[#2DD4BF]">
            Daftar gratis
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
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#0A0A12] px-6 text-[#F2F1F8]">
          <p className="text-sm text-[#8B8AA0]">Memuat...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
