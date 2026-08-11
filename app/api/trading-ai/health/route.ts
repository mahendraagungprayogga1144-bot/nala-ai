import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { collectBridgeHealth } from "@/lib/trading-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/trading-ai/health
 *
 * Status jembatan MT5. READ-ONLY: tidak memanggil Trading Brain,
 * tidak mengirim order, tidak mengubah state apa pun.
 *
 * CONNECTED hanya muncul kalau ada heartbeat nyata dari terminal MT5.
 * Endpoint ini merespons 200 bukan berarti MT5 terhubung — lihat field `state`.
 */
export async function GET() {
  const startedAt = Date.now();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const health = await collectBridgeHealth(supabase, user.id);

  // Log koneksi terstruktur: timestamp, target, response, latency, error.
  console.log(
    "[trading-ai/health]",
    JSON.stringify({
      at: new Date(startedAt).toISOString(),
      userId: user.id,
      state: health.state,
      totalLatencyMs: Date.now() - startedAt,
      channels: health.channels.map((c) => ({ id: c.id, state: c.state, ageSec: c.ageSec })),
      probes: health.probes.map((p) => ({
        target: p.target,
        latencyMs: p.latencyMs,
        ok: p.ok,
        errorCode: p.errorCode,
        errorMessage: p.errorMessage,
      })),
    }),
  );

  return NextResponse.json({
    ok: true,
    ...health,
    note: "Read-only. Tidak memanggil Trading Brain dan tidak mengirim order.",
  });
}
