import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./config";

export async function signInDemoAccount(supabase: SupabaseClient) {
  // 1) Coba login langsung — tidak butuh service role
  let { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (!error) return { ok: true as const };

  // 2) Kalau gagal, provision via admin API (butuh SUPABASE_SERVICE_ROLE_KEY di Vercel)
  const res = await fetch("/api/demo/provision", { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof body.error === "string" ? body.error : "";
    if (/SERVICE_ROLE|service role|belum diset/i.test(detail)) {
      return {
        ok: false as const,
        error:
          "Demo belum bisa dibuat otomatis di deployment ini (service role key belum di Vercel). Coba tombol Masuk biasa dengan email/password demo, atau set SUPABASE_SERVICE_ROLE_KEY lalu redeploy.",
      };
    }
    return { ok: false as const, error: detail || "Gagal menyiapkan akun demo." };
  }

  ({ error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  }));

  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      return {
        ok: false as const,
        error: "Akun demo belum dikonfirmasi di Supabase. Set SERVICE_ROLE_KEY lalu provision ulang, atau konfirmasi email di dashboard Supabase.",
      };
    }
    return { ok: false as const, error: "Akun demo sudah dibuat tapi gagal masuk. Coba lagi." };
  }

  return { ok: true as const };
}
