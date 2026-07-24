import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { trialPayload } from "@/lib/auth/trial";

async function findUserByEmail(admin: NonNullable<ReturnType<typeof createAdminClient>>, email: string) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}

async function ensureTrial(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string) {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("user_id, plan, status, trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  // Jangan overwrite langganan berbayar aktif
  if (existing && ["starter", "pro", "enterprise"].includes(existing.plan) && existing.status === "active") {
    return;
  }
  // Trial sudah pernah dibuat — biarkan
  if (existing?.trial_ends_at) return;

  await admin.from("subscriptions").upsert(trialPayload(userId), { onConflict: "user_id" });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!name || !email || password.length < 6) {
    return NextResponse.json(
      { error: "Nama, email, dan password (min 6 karakter) wajib diisi." },
      { status: 400 },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        code: "NO_SERVICE_ROLE",
        error: "Server belum punya SUPABASE_SERVICE_ROLE_KEY — daftar otomatis nonaktif.",
      },
      { status: 503 },
    );
  }

  const existing = await findUserByEmail(admin, email);

  if (existing) {
    // Jangan reset password sembarangan lewat daftar — minta login / lupa sandi
    return NextResponse.json(
      { error: "Email sudah terdaftar. Silakan masuk, atau pakai Lupa kata sandi." },
      { status: 409 },
    );
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message || "Gagal buat akun." }, { status: 400 });
  }

  await admin.from("profiles").upsert({ id: data.user.id, full_name: name }, { onConflict: "id" });
  await ensureTrial(admin, data.user.id);

  return NextResponse.json({ ok: true, trialDays: 5 });
}
