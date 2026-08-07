import { createClient } from "@/lib/supabase/server";
import { guardPage } from "../lib/page-guard";
import { getCandleFeedStatus, type BridgeKeyRow, type CandleFeedStatus } from "@/lib/trading-ai";
import TradingAiClient from "./trading-ai-client";

export default async function TradingAiPage() {
  return guardPage("Trading AI Brain", async () => {
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

    const ingestUrl =
      (process.env.NEXT_PUBLIC_APP_URL || "https://gercepos.id").replace(/\/$/, "") +
      "/api/trading-ai/ingest";

    return (
      <TradingAiClient
        userId={user.id}
        userLabel={displayName}
        initialFeed={feed}
        initialKeys={keys}
        ingestUrl={ingestUrl}
        schemaReady={schemaReady}
        schemaError={schemaError}
      />
    );
  });
}
