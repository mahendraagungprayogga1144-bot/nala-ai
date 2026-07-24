import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";

const MAX = 5000;

function csvEscape(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: unknown[][]) {
  return [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { admin } = gate;
  if (!admin) return NextResponse.json({ error: "Admin client unavailable" }, { status: 500 });

  const type = req.nextUrl.searchParams.get("type") || "users";
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const event = req.nextUrl.searchParams.get("event");
  const moduleFilter = req.nextUrl.searchParams.get("module");

  if (type === "users") {
    const { data: profiles } = await admin.from("profiles").select("id, full_name").limit(MAX);
    const { data: subs } = await admin.from("subscriptions").select("user_id, plan, status, expired_at").limit(MAX);
    const { data: auth } = await admin.auth.admin.listUsers({ perPage: Math.min(MAX, 1000) });
    const subMap = new Map((subs || []).map((s: { user_id: string; plan: string; status: string; expired_at: string | null }) => [s.user_id, s]));
    const nameMap = new Map((profiles || []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name || ""]));
    const rows = (auth?.users || []).map((u) => {
      const sub = subMap.get(u.id);
      return [
        u.id,
        u.email || "",
        nameMap.get(u.id) || "",
        sub?.plan || "free",
        sub?.status || "—",
        sub?.expired_at || "",
        u.created_at,
        u.last_sign_in_at || "",
      ];
    });
    const csv = toCsv(
      ["user_id", "email", "name", "plan", "status", "expired_at", "created_at", "last_sign_in"],
      rows,
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="users-${Date.now()}.csv"`,
      },
    });
  }

  if (type === "payments") {
    const { data } = await admin
      .from("payments")
      .select("id, user_id, plan, amount, status, invoice_id, method, created_at, confirmed_at")
      .order("created_at", { ascending: false })
      .limit(MAX);
    const rows = (data || []).map((p: Record<string, unknown>) => [
      p.id,
      p.user_id,
      p.plan,
      p.amount,
      p.status,
      p.invoice_id,
      p.method,
      p.created_at,
      p.confirmed_at,
    ]);
    const csv = toCsv(
      ["id", "user_id", "plan", "amount", "status", "invoice_id", "method", "created_at", "confirmed_at"],
      rows,
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payments-${Date.now()}.csv"`,
      },
    });
  }

  if (type === "businesses") {
    const { data } = await admin
      .from("businesses")
      .select("id, name, type, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(MAX);
    const { data: auth } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const emailMap = new Map((auth?.users || []).map((u) => [u.id, u.email || ""]));
    const rows = (data || []).map((b: { id: string; name: string; type: string; user_id: string; created_at: string }) => [
      b.id,
      b.name,
      b.type,
      b.user_id,
      emailMap.get(b.user_id) || "",
      b.created_at,
    ]);
    const csv = toCsv(["id", "name", "type", "user_id", "owner_email", "created_at"], rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="businesses-${Date.now()}.csv"`,
      },
    });
  }

  if (type === "activity") {
    let q = admin
      .from("app_events")
      .select("created_at, event, module, user_id, path, meta")
      .order("created_at", { ascending: false })
      .limit(MAX);
    if (event) q = q.eq("event", event);
    if (moduleFilter) q = q.eq("module", moduleFilter);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);
    const { data } = await q;
    const rows = (data || []).map((e: Record<string, unknown>) => [
      e.created_at,
      e.event,
      e.module,
      e.user_id,
      e.path,
      JSON.stringify(e.meta || {}),
    ]);
    const csv = toCsv(["created_at", "event", "module", "user_id", "path", "meta"], rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="activity-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
