/**
 * Owner-only gate for HENIMA AI Business Master Mentor.
 *
 * Identification used (existing Gercep OS patterns — no new permission system):
 * 1. Supabase Auth session required.
 * 2. User must own at least one row in `businesses` (`user_id = auth.uid()`).
 * 3. User must not be an active kasir-only member (`business_members.role = 'kasir'`).
 *
 * Platform admin `requireOwner()` is intentionally NOT used — that gate is for
 * /admin tooling, not product modules.
 *
 * Gap note: `business_members` is queried by proxy.ts but has no CREATE TABLE in
 * repo migrations. If the table is missing, the kasir check is skipped safely
 * (ownership via `businesses` still required). Access is never opened as a
 * workaround for missing owner identity.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MentorAuthError, type MentorOwnerContext } from "./types";

type Db = Awaited<ReturnType<typeof createClient>>;

async function isActiveKasir(db: Db, userId: string): Promise<boolean> {
  try {
    const { data, error } = await db
      .from("business_members")
      .select("role")
      .eq("member_user_id", userId)
      .eq("status", "aktif")
      .eq("role", "kasir")
      .limit(1)
      .maybeSingle();
    if (error) {
      // Missing relation / schema drift — do not grant access; ownership still required.
      const msg = error.message || "";
      if (/does not exist|relation|schema cache/i.test(msg)) return false;
      console.error("[master-mentor/authz] kasir check failed:", error.message);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.error("[master-mentor/authz] kasir check exception:", err);
    return false;
  }
}

export async function resolveMentorOwner(): Promise<MentorOwnerContext> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    throw new MentorAuthError("Unauthorized", 401, "unauthorized");
  }

  if (await isActiveKasir(db, user.id)) {
    throw new MentorAuthError(
      "Modul HENIMA AI hanya tersedia untuk owner bisnis.",
      403,
      "kasir_forbidden",
    );
  }

  const { data: businesses, error: bizError } = await db
    .from("businesses")
    .select("id, name, type")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (bizError) {
    throw new MentorAuthError("Gagal memuat data bisnis.", 500, "business_lookup_failed");
  }

  const list = businesses || [];
  if (list.length === 0) {
    throw new MentorAuthError(
      "Owner identity belum lengkap: akun ini belum memiliki bisnis Gercep OS.",
      403,
      "no_owned_business",
    );
  }

  const cookieStore = await cookies();
  const preferred = cookieStore.get("active_business_id")?.value;
  const active = list.find((b) => b.id === preferred) || list[0];

  const { data: profile } = await db.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const ownerName =
    profile?.full_name?.trim() || user.email?.split("@")[0] || "Owner";

  return {
    userId: user.id,
    email: user.email || "",
    ownerName,
    gercepBusinesses: list,
    activeGercepBusinessId: active?.id || null,
  };
}

export async function requireMentorOwnerPage(): Promise<MentorOwnerContext> {
  try {
    return await resolveMentorOwner();
  } catch (err) {
    if (err instanceof MentorAuthError) {
      if (err.code === "unauthorized") redirect("/login");
      if (err.code === "kasir_forbidden") redirect("/dashboard/ai-kasir");
      if (err.code === "no_owned_business") redirect("/onboarding");
    }
    throw err;
  }
}

export async function withMentorOwner<T>(
  fn: (ctx: { owner: MentorOwnerContext; db: Db }) => Promise<T>,
): Promise<Response> {
  const { NextResponse } = await import("next/server");
  try {
    const owner = await resolveMentorOwner();
    const db = await createClient();
    const result = await fn({ owner, db });
    if (result instanceof Response) return result;
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof MentorAuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.httpStatus });
    }
    const { MentorValidationError } = await import("./types");
    if (err instanceof MentorValidationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.httpStatus });
    }
    console.error("[master-mentor/api]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}
