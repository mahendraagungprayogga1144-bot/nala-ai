/**
 * Probe production /api/trading-ai/signal (read-only).
 * Run: npx tsx --env-file=.env.local scripts/probe-trading-ai-signal.ts
 */

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const h = { apikey: key, Authorization: `Bearer ${key}` };

  async function rest(path: string) {
    const r = await fetch(`${url}/rest/v1/${path}`, { headers: h });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  const keys = await rest(
    "trading_ai_bridge_keys?select=api_key,user_id,last_seen_at&revoked_at=is.null&order=last_seen_at.desc.nullslast&limit=1",
  );
  const apiKey = keys[0].api_key as string;
  const qs = new URLSearchParams({
    symbol: "XAUUSDm",
    account_mode: "demo",
    account_login: "416229080",
    bid: "4388",
    ask: "4388.2",
    spread: "26",
    balance: "1000",
  });
  const sigRes = await fetch(`https://www.gercepos.id/api/trading-ai/signal?${qs}`, {
    headers: { "x-gercep-api-key": apiKey },
  });
  const j = await sigRes.json();
  console.log(
    JSON.stringify(
      {
        http: sigRes.status,
        version: j.version,
        decision: j.decision,
        confidence: j.confidence,
        serverExecutable: j.serverExecutable,
        eaMayExecute: j.eaMayExecute,
        autotrade: j.autotrade,
        liveEnable: j.liveEnable,
        accountMode: j.accountMode,
        m5Bias: j.m5Bias,
        m1Direction: j.m1Direction,
        generatedAt: j.generatedAt,
        ageMs: Date.now() - Number(j.generatedAt),
        executionBlockedBy: j.executionBlockedBy,
        reasons: (j.reasons || []).slice(0, 6),
        lot: j.lot,
        stopLoss: j.stopLoss,
        takeProfit: j.takeProfit,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
