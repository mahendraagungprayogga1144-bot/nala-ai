import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ProfitEngineError } from "./types";

export type ProfitActor = {
  userId: string;
  businessId: string;
  email: string;
  role: "OWNER" | "ADMIN" | "STAFF";
};

export async function withProfitActor<T>(
  fn: (ctx: {
    actor: ProfitActor;
    db: Awaited<ReturnType<typeof createClient>>;
  }) => Promise<T>,
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
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    const businessId = businesses?.find((b) => b.id === preferred)?.id || businesses?.[0]?.id;
    if (!businessId) {
      return NextResponse.json({ error: "Bisnis aktif tidak ditemukan." }, { status: 400 });
    }
    const result = await fn({
      actor: { userId: user.id, businessId, email: user.email || "", role: "OWNER" },
      db: supabase,
    });
    if (result instanceof NextResponse) return result;
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ProfitEngineError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.httpStatus });
    }
    console.error("[gercep-profit/api]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ProfitEngineError("JSON tidak valid.", "invalid_json");
  }
}

export function queryParam(request: Request, key: string) {
  return new URL(request.url).searchParams.get(key) || undefined;
}
