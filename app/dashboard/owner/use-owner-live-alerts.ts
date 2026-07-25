"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type LiveAlert = {
  id: string;
  kind: "stok";
  title: string;
  sub: string;
  href: string;
  updatedAt: number;
};

type BizMeta = { id: string; name: string };

type ProductRow = {
  id: string | number;
  name: string;
  stock: number | string | null;
  min_stock: number | string | null;
  business_id: string;
};

const DISMISS_KEY = "gercep_owner_notif_dismissed_v2";
const POLL_MS = 40_000;

/** id → fingerprint isi alert saat di-dismiss (supaya muncul lagi kalau stok berubah). */
type DismissMap = Record<string, string>;

function loadDismissed(): DismissMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as DismissMap) : {};
  } catch {
    return {};
  }
}

function saveDismissed(map: DismissMap) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DISMISS_KEY, JSON.stringify(map));
}

function alertFp(a: Pick<LiveAlert, "id" | "sub">) {
  return `${a.id}::${a.sub}`;
}

export function useOwnerLiveAlerts(businesses: BizMeta[]) {
  const supabase = useMemo(() => createClient(), []);
  const bizKey = useMemo(
    () =>
      businesses
        .map((b) => b.id)
        .sort()
        .join(","),
    [businesses],
  );
  const bizRef = useRef(businesses);
  useEffect(() => {
    bizRef.current = businesses;
  });

  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [dismissed, setDismissed] = useState<DismissMap>(() => loadDismissed());
  const [live, setLive] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const fetching = useRef(false);

  const refresh = useCallback(async () => {
    const bizList = bizRef.current;
    const ids = bizList.map((b) => b.id);
    if (!ids.length || fetching.current) return;
    fetching.current = true;
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, stock, min_stock, business_id")
        .in("business_id", ids);

      if (error) {
        setLive(false);
        return;
      }

      const nameById: Record<string, string> = {};
      bizList.forEach((b) => {
        nameById[b.id] = b.name;
      });

      const byBiz: Record<string, { name: string; stock: number }[]> = {};
      ((data || []) as ProductRow[]).forEach((p) => {
        const stock = Number(p.stock ?? 0);
        const min = Number(p.min_stock ?? 0);
        if (stock > min) return;
        if (!byBiz[p.business_id]) byBiz[p.business_id] = [];
        byBiz[p.business_id].push({ name: p.name, stock });
      });

      const next: LiveAlert[] = Object.entries(byBiz).map(([bizId, items]) => {
        const habis = items.filter((i) => i.stock <= 0);
        const kritis = items.filter((i) => i.stock > 0);
        const title =
          habis.length > 0
            ? `${nameById[bizId] || "Bisnis"} — ${habis.length} stok habis`
            : `${nameById[bizId] || "Bisnis"} — ${kritis.length} stok kritis`;
        const sample = [...habis, ...kritis]
          .slice(0, 3)
          .map((i) => (i.stock <= 0 ? i.name : `${i.name} (${i.stock})`))
          .join(", ");
        return {
          id: `stok-${bizId}`,
          kind: "stok" as const,
          title,
          sub: sample || "Cek inventory",
          href: "/dashboard/inventory",
          updatedAt: Date.now(),
        };
      });

      setAlerts(next);
      setLastSyncAt(Date.now());
      setLive(true);
    } finally {
      fetching.current = false;
    }
  }, [supabase]);

  useEffect(() => {
    if (!bizKey) return;

    const ids = bizKey.split(",").filter(Boolean);
    const idSet = new Set(ids);

    void refresh();

    const onFocus = () => {
      void refresh();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const poll = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    const channel = supabase
      .channel(`owner-live-alerts-${bizKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        (payload) => {
          const row = (payload.new || payload.old) as { business_id?: string } | null;
          if (row?.business_id && idSet.has(row.business_id)) void refresh();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLive(true);
      });

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [bizKey, refresh, supabase]);

  const dismiss = useCallback((alert: LiveAlert) => {
    setDismissed((prev) => {
      const next = { ...prev, [alert.id]: alertFp(alert) };
      saveDismissed(next);
      return next;
    });
  }, []);

  const visible = alerts.filter((a) => dismissed[a.id] !== alertFp(a));

  return {
    alerts: visible,
    count: visible.length,
    live,
    lastSyncAt,
    dismiss,
    refresh,
  };
}
