import type { SupabaseClient } from "@supabase/supabase-js";

async function trySignIn(supabase: SupabaseClient, email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

export async function registerAccount(
  supabase: SupabaseClient,
  opts: { name: string; email: string; password: string },
) {
  const name = opts.name.trim();
  const email = opts.email.trim().toLowerCase();
  const password = opts.password;

  const apiRes = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const apiBody = await apiRes.json().catch(() => ({}));

  if (apiRes.ok && apiBody.ok) {
    const loggedIn = await trySignIn(supabase, email, password);
    if (!loggedIn) {
      return { ok: false as const, error: "Akun dibuat tapi gagal masuk. Coba login manual." };
    }
    return { ok: true as const, needsEmailConfirm: false };
  }

  if (apiRes.status === 409) {
    return { ok: false as const, error: apiBody.error || "Email sudah terdaftar. Coba masuk." };
  }

  if (!apiBody.code && apiBody.error && apiRes.status !== 503) {
    return { ok: false as const, error: apiBody.error };
  }

  // Fallback: Supabase client signUp (butuh Confirm Email = OFF di dashboard Supabase)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    const alreadyExists = /already registered|already been registered|User already registered/i.test(error.message);
    if (alreadyExists) {
      const loggedIn = await trySignIn(supabase, email, password);
      if (loggedIn) return { ok: true as const, needsEmailConfirm: false };
      return {
        ok: false as const,
        error: "Email sudah terdaftar tapi belum aktif. Coba masuk di /login — kalau gagal, pakai email lain atau hubungi admin.",
      };
    }
    return { ok: false as const, error: error.message };
  }

  if (data.user) {
    await supabase.from("profiles").upsert({ id: data.user.id, full_name: name }, { onConflict: "id" });
    // Trial 5 hari — best-effort (RLS may block; register API is preferred path)
    const ends = new Date();
    ends.setDate(ends.getDate() + 5);
    await supabase.from("subscriptions").upsert(
      {
        user_id: data.user.id,
        plan: "trial",
        status: "trial",
        started_at: new Date().toISOString(),
        expired_at: ends.toISOString(),
        trial_ends_at: ends.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }

  if (data.session) {
    return { ok: true as const, needsEmailConfirm: false };
  }

  const loggedIn = await trySignIn(supabase, email, password);
  if (loggedIn) {
    return { ok: true as const, needsEmailConfirm: false };
  }

  return {
    ok: false as const,
    error: "Akun terdaftar tapi belum bisa masuk otomatis. Email konfirmasi tidak aktif di server — admin perlu menambahkan SUPABASE_SERVICE_ROLE_KEY di Vercel, atau matikan 'Confirm email' di Supabase → Authentication → Email.",
  };
}
