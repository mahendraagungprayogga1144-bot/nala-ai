import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { salesDb } from "./db";
import { resolveActorByUserId } from "./authz";
import { ForbiddenError, NotFoundError, SalesError } from "./types";
import type { Actor } from "./types";

export async function withSalesActor<T>(
  fn: (ctx: { actor: Actor; db: ReturnType<typeof salesDb> }) => Promise<T>,
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const cookieStore = await cookies();
    const preferred = cookieStore.get("active_business_id")?.value;
    const db = salesDb();
    const { data: profile } = await db.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const actor = await resolveActorByUserId(db, user.id, preferred, profile?.full_name || user.email || "Owner");
    const result = await fn({ actor, db });
    if (result instanceof NextResponse) return result;
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError || err instanceof SalesError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.httpStatus });
    }
    console.error("[henima-sales/api]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new SalesError("JSON tidak valid.", "invalid_json");
  }
}

export function queryParam(request: Request, key: string) {
  return new URL(request.url).searchParams.get(key) || undefined;
}
