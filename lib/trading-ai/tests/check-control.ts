/**
 * Read-only: cek tombol execution control user feed aktif.
 * Run: npx tsx --env-file=.env.local lib/trading-ai/tests/check-control.ts
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sb = createClient(url, key);
  const { data: keys, error: ke } = await sb
    .from("trading_ai_bridge_keys")
    .select("user_id,last_seen_at")
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false })
    .limit(1);
  if (ke) throw ke;
  const uid = keys?.[0]?.user_id;
  if (!uid) throw new Error("no key");
  console.log("user", uid.slice(0, 8), "seen", keys?.[0]?.last_seen_at);
  const { data: ctl, error } = await sb
    .from("trading_ai_execution_control")
    .select(
      "autotrade_enabled,live_enable,emergency_stop,cooldown_seconds,last_entry_at,last_signal_at,last_signal_decision,last_signal_account_mode,lot",
    )
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;
  console.log(JSON.stringify(ctl, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
