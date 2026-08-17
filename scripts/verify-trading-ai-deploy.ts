/**
 * Read-only deployment verification for v0.7.0-final-scalp.
 * Run: npx tsx --env-file=.env.local scripts/verify-trading-ai-deploy.ts
 * Does NOT change brain/entry logic or place orders.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env (.env.local).");

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Prefer: "count=exact",
};

async function rest<T>(path: string, init?: RequestInit): Promise<{ data: T; status: number; count: string | null }> {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
  });
  const text = await res.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ([] as T);
  } catch {
    throw new Error(`${res.status} non-JSON: ${text.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 500)}`);
  return { data, status: res.status, count: res.headers.get("content-range") };
}

function ageSec(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.round((Date.now() - ms) / 1000);
}

function stage(n: number, title: string) {
  console.log(`\n======== ${n}. ${title} ========`);
}

async function main() {
  stage(1, "Verify migration live_enable");
  // Probe column via selecting it; PostgREST errors if missing.
  try {
    const { data } = await rest<Record<string, unknown>[]>(
      "trading_ai_execution_control?select=user_id,live_enable,autotrade_enabled,emergency_stop,last_signal_at,last_signal_account_mode,last_signal_account_login,last_signal_decision,last_signal_executable,last_signal_m5_bias,last_signal_m1_direction,updated_at&order=last_signal_at.desc.nullslast&limit=5",
    );
    console.log("RESULT: live_enable column EXISTS");
    console.log("rows:", data.length);
    for (const r of data) {
      console.log(
        JSON.stringify({
          user: String(r.user_id).slice(0, 8),
          live_enable: r.live_enable,
          autotrade: r.autotrade_enabled,
          estop: r.emergency_stop,
          last_signal_at: r.last_signal_at,
          ageSec: ageSec(r.last_signal_at as string),
          mode: r.last_signal_account_mode,
          login: r.last_signal_account_login,
          decision: r.last_signal_decision,
          executable: r.last_signal_executable,
          m5: r.last_signal_m5_bias,
          m1: r.last_signal_m1_direction,
        }),
      );
    }
  } catch (e) {
    console.log("RESULT: live_enable MISSING or query failed");
    console.log(String(e));
    process.exitCode = 1;
    return;
  }

  stage(2, "Bridge keys / candle feed heartbeat");
  const keys = await rest<
    { id: string; user_id: string; last_seen_at: string | null; label: string | null; revoked_at: string | null }[]
  >(
    "trading_ai_bridge_keys?select=id,user_id,last_seen_at,label,revoked_at&revoked_at=is.null&order=last_seen_at.desc.nullslast&limit=5",
  );
  for (const k of keys.data) {
    console.log(
      JSON.stringify({
        key: k.id.slice(0, 8),
        user: k.user_id.slice(0, 8),
        label: k.label,
        last_seen_at: k.last_seen_at,
        ageSec: ageSec(k.last_seen_at),
      }),
    );
  }
  const topUser = keys.data[0]?.user_id;
  if (!topUser) {
    console.log("RESULT: no active bridge keys");
    process.exitCode = 1;
    return;
  }

  stage(3, "Candle updated_at (ingest freshness)");
  for (const tf of ["M1", "M5"] as const) {
    for (const sym of ["XAUUSD", "XAUUSDm"]) {
      const { data } = await rest<{ bar_time: number; updated_at: string; symbol: string }[]>(
        `trading_ai_candles?select=bar_time,updated_at,symbol&user_id=eq.${topUser}&symbol=eq.${sym}&timeframe=eq.${tf}&order=updated_at.desc&limit=1`,
      );
      const row = data[0];
      console.log(
        JSON.stringify({
          symbol: sym,
          tf,
          found: !!row,
          bar_time: row?.bar_time ?? null,
          updated_at: row?.updated_at ?? null,
          ageSec: ageSec(row?.updated_at),
        }),
      );
    }
  }

  stage(4, "Executor heartbeat (last_signal_at)");
  const { data: ctl } = await rest<Record<string, unknown>[]>(
    `trading_ai_execution_control?select=*&user_id=eq.${topUser}&limit=1`,
  );
  const c = ctl[0] || null;
  if (!c) {
    console.log("RESULT: no execution_control row for top user");
  } else {
    console.log(
      JSON.stringify({
        autotrade: c.autotrade_enabled,
        live_enable: c.live_enable,
        estop: c.emergency_stop,
        lot: c.lot,
        last_signal_at: c.last_signal_at,
        signalAgeSec: ageSec(c.last_signal_at as string),
        mode: c.last_signal_account_mode,
        login: c.last_signal_account_login,
        decision: c.last_signal_decision,
        confidence: c.last_signal_confidence,
        spread: c.last_signal_spread,
        executable: c.last_signal_executable,
        m5: c.last_signal_m5_bias,
        m1: c.last_signal_m1_direction,
        signalId: c.last_signal_id,
      }),
    );
    const age = ageSec(c.last_signal_at as string);
    if (age == null) console.log("RESULT: executor heartbeat MISSING (last_signal_at null)");
    else if (age > 120) console.log(`RESULT: executor heartbeat STALE (${age}s > 120s)`);
    else console.log(`RESULT: executor heartbeat FRESH (${age}s)`);
  }

  stage(5, "Recent order journal");
  const { data: orders } = await rest<Record<string, unknown>[]>(
    `trading_ai_orders?select=id,status,direction,lot,ticket,entry_price,spread,confidence,error_code,error_message,account_mode,created_at,signal_id&user_id=eq.${topUser}&order=created_at.desc&limit=8`,
  );
  if (!orders.length) console.log("RESULT: no orders yet");
  for (const o of orders) {
    console.log(
      JSON.stringify({
        id: o.id,
        status: o.status,
        dir: o.direction,
        lot: o.lot,
        ticket: o.ticket,
        price: o.entry_price,
        mode: o.account_mode,
        err: o.error_message || o.error_code,
        at: o.created_at,
        ageSec: ageSec(o.created_at as string),
        signalId: o.signal_id,
      }),
    );
  }

  stage(6, "Production version probe (public)");
  try {
    const res = await fetch("https://www.gercepos.id/");
    console.log("gercepos.id HTTP", res.status);
  } catch (e) {
    console.log("gercepos.id fetch failed:", String(e));
  }

  console.log("\n======== DONE (read-only) ========");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
