import { createClient } from "@/lib/supabase/server";
import { guardPage } from "../lib/page-guard";
import {
  collectBridgeHealth,
  cooldownRemainingSeconds,
  DEFAULT_EXECUTION_CONTROL,
  getCandleFeedStatus,
  parseExecutionControlRow,
  type BridgeHealthResult,
  type BridgeKeyRow,
  type CandleFeedStatus,
} from "@/lib/trading-ai";
import TradingAiClient from "./trading-ai-client";

export default async function TradingAiPage() {
  return guardPage("Otak MetaTrader", async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return (
        <div className="px-8 py-12 text-center text-sm text-[#8B8AA0]">
          Sesi tidak terbaca. Login ulang.
        </div>
      );
    }

    const displayName = user.email?.split("@")[0] || user.id.slice(0, 8);

    let feed: CandleFeedStatus = {
      symbol: "XAUUSD",
      m5Count: 0,
      m1Count: 0,
      m5LastTime: null,
      m1LastTime: null,
    };
    let keys: BridgeKeyRow[] = [];
    let schemaReady = true;
    let schemaError: string | null = null;

    try {
      feed = await getCandleFeedStatus(supabase, user.id, "XAUUSD");
      const { data, error } = await supabase
        .from("trading_ai_bridge_keys")
        .select("id, api_key, label, last_seen_at, created_at, revoked_at")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (error) {
        schemaReady = false;
        schemaError = error.message;
      } else {
        keys = (data || []) as BridgeKeyRow[];
      }
    } catch (e) {
      schemaReady = false;
      schemaError = e instanceof Error ? e.message : "Schema Trading AI belum siap";
    }

    // Status tombol autotrade. Tabel belum dimigrasi => tampil OFF + peringatan.
    let control = { ...DEFAULT_EXECUTION_CONTROL, cooldownRemaining: 0 };
    let controlReady = true;
    try {
      const { data, error } = await supabase
        .from("trading_ai_execution_control")
        .select(
          "autotrade_enabled, emergency_stop, close_all_on_stop, cooldown_seconds, last_entry_at, last_entry_signal_id",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        controlReady = false;
      } else {
        const parsed = parseExecutionControlRow(data);
        control = { ...parsed, cooldownRemaining: cooldownRemainingSeconds(parsed) };
      }
    } catch {
      controlReady = false;
    }

    // Status bridge dihitung di server supaya UI tidak pernah mulai dari spinner.
    // Kalau probe gagal, kirim ERROR eksplisit — jangan biarkan UI loading.
    let health: BridgeHealthResult;
    try {
      health = await collectBridgeHealth(supabase, user.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Trading AI] bridge health gagal", e);
      const now = Date.now();
      health = {
        state: "ERROR",
        checkedAt: now,
        healthyWindowSec: 90,
        connectTimeoutSec: 120,
        channels: [
          {
            id: "feed",
            label: "Candle feed",
            expert: "GercepCandlePush",
            state: "ERROR",
            lastSeenAt: null,
            ageSec: null,
            detail: msg,
          },
          {
            id: "executor",
            label: "Signal executor",
            expert: "GercepTradeExecutor",
            state: "ERROR",
            lastSeenAt: null,
            ageSec: null,
            detail: msg,
          },
        ],
        probes: [
          {
            target: "collectBridgeHealth",
            startedAt: now,
            latencyMs: 0,
            ok: false,
            errorCode: "EXCEPTION",
            errorMessage: msg,
          },
        ],
        summary: `Gagal cek bridge: ${msg}`,
        account: {
          mode: null,
          login: null,
          lastDecision: null,
          autotrade: false,
          emergencyStop: false,
        },
      };
    }

    const appBase =
      (process.env.NEXT_PUBLIC_APP_URL || "https://www.gercepos.id").replace(/\/$/, "");
    const ingestUrl = appBase + "/api/trading-ai/ingest";
    const signalUrl = appBase + "/api/trading-ai/signal";
    const healthUrl = appBase + "/api/trading-ai/health";

    return (
      <TradingAiClient
        userId={user.id}
        userLabel={displayName}
        initialFeed={feed}
        initialKeys={keys}
        initialControl={control}
        initialControlReady={controlReady}
        initialHealth={health}
        ingestUrl={ingestUrl}
        signalUrl={signalUrl}
        healthUrl={healthUrl}
        schemaReady={schemaReady}
        schemaError={schemaError}
      />
    );
  });
}
