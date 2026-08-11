/**
 * Pure tests for MT5 bridge connection state machine.
 * Run: npx tsx lib/trading-ai/tests/bridge-health-cases.ts
 *
 * Tidak menyentuh Trading Brain. Tidak mengirim order.
 */

import {
  ageSeconds,
  combineBridgeState,
  evaluateChannelHealth,
  summarizeBridge,
  BRIDGE_CONNECT_TIMEOUT_SEC,
  BRIDGE_HEALTHY_WINDOW_SEC,
} from "../bridge-health";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const now = 1_800_000_000_000;

// --- ageSeconds ---
{
  assert(ageSeconds(null, now) === null, "null lastSeen -> null age");
  assert(ageSeconds(now - 45_000, now) === 45, "45s age");
  assert(ageSeconds(now + 5_000, now) === 0, "future clamped to 0");
}

// --- combineBridgeState: worst wins ---
{
  assert(combineBridgeState([]) === "ERROR", "empty -> ERROR");
  assert(
    combineBridgeState(["CONNECTED", "CONNECTED"]) === "CONNECTED",
    "all connected",
  );
  assert(
    combineBridgeState(["CONNECTED", "CONNECTING"]) === "CONNECTING",
    "connecting worse than connected",
  );
  assert(
    combineBridgeState(["CONNECTED", "DISCONNECTED"]) === "DISCONNECTED",
    "disconnected worse",
  );
  assert(
    combineBridgeState(["CONNECTING", "ERROR"]) === "ERROR",
    "error worst",
  );
}

// --- evaluateChannelHealth ---
{
  // Tidak ada API key -> DISCONNECTED, bukan loading.
  const noKey = evaluateChannelHealth({
    id: "feed",
    label: "Candle feed",
    expert: "GercepCandlePush",
    lastSeenAt: null,
    hasApiKey: false,
    now,
  });
  assert(noKey.state === "DISCONNECTED", "no key must be DISCONNECTED");
  assert(/API key/i.test(noKey.detail), "detail menyebut API key");

  // Key baru, belum ada heartbeat -> CONNECTING (dalam window).
  const connecting = evaluateChannelHealth({
    id: "feed",
    label: "Candle feed",
    expert: "GercepCandlePush",
    lastSeenAt: null,
    waitingSince: now - 30_000,
    hasApiKey: true,
    now,
  });
  assert(connecting.state === "CONNECTING", "fresh key without HB -> CONNECTING");

  // Key lama tanpa heartbeat -> DISCONNECTED (bukan loading selamanya).
  const timedOut = evaluateChannelHealth({
    id: "executor",
    label: "Signal executor",
    expert: "GercepTradeExecutor",
    lastSeenAt: null,
    waitingSince: now - (BRIDGE_CONNECT_TIMEOUT_SEC + 5) * 1000,
    hasApiKey: true,
    now,
  });
  assert(timedOut.state === "DISCONNECTED", "connect timeout -> DISCONNECTED");

  // Heartbeat segar -> CONNECTED.
  const live = evaluateChannelHealth({
    id: "feed",
    label: "Candle feed",
    expert: "GercepCandlePush",
    lastSeenAt: now - 20_000,
    hasApiKey: true,
    now,
  });
  assert(live.state === "CONNECTED", "fresh HB -> CONNECTED");
  assert(live.ageSec === 20, "age 20s");

  // Heartbeat basi -> DISCONNECTED.
  const stale = evaluateChannelHealth({
    id: "feed",
    label: "Candle feed",
    expert: "GercepCandlePush",
    lastSeenAt: now - (BRIDGE_HEALTHY_WINDOW_SEC + 10) * 1000,
    hasApiKey: true,
    now,
  });
  assert(stale.state === "DISCONNECTED", "stale HB -> DISCONNECTED");

  // Probe error -> ERROR (tidak boleh diklaim CONNECTED).
  const err = evaluateChannelHealth({
    id: "executor",
    label: "Signal executor",
    expert: "GercepTradeExecutor",
    lastSeenAt: now - 5_000,
    hasApiKey: true,
    probeError: "column last_signal_at does not exist",
    now,
  });
  assert(err.state === "ERROR", "probe error -> ERROR even with fresh HB");
  assert(/last_signal_at/.test(err.detail), "error detail preserved");
}

// --- summarizeBridge ---
{
  const channels = [
    evaluateChannelHealth({
      id: "feed",
      label: "Candle feed",
      expert: "GercepCandlePush",
      lastSeenAt: now - 10_000,
      hasApiKey: true,
      now,
    }),
    evaluateChannelHealth({
      id: "executor",
      label: "Signal executor",
      expert: "GercepTradeExecutor",
      lastSeenAt: now - 10_000,
      hasApiKey: true,
      now,
    }),
  ];
  assert(
    summarizeBridge("CONNECTED", channels).includes("hidup"),
    "summary connected",
  );
}

// --- Aturan kritis: API Gercep hidup saja TIDAK membuat CONNECTED ---
{
  // Simulasi: key ada, probe OK (tidak ada probeError), tapi tidak ada heartbeat.
  const onlyApi = evaluateChannelHealth({
    id: "executor",
    label: "Signal executor",
    expert: "GercepTradeExecutor",
    lastSeenAt: null,
    waitingSince: now - 200_000,
    hasApiKey: true,
    now,
  });
  assert(
    onlyApi.state !== "CONNECTED",
    "API/key tanpa heartbeat MT5 tidak boleh CONNECTED",
  );
}

console.log("PASS bridge-health-cases");
console.log({
  healthyWindowSec: BRIDGE_HEALTHY_WINDOW_SEC,
  connectTimeoutSec: BRIDGE_CONNECT_TIMEOUT_SEC,
});
