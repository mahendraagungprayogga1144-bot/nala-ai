"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Ev = {
  id: string;
  user_id: string | null;
  event: string;
  module: string | null;
  meta: Record<string, unknown>;
  path: string | null;
  created_at: string;
};

export default function AdminActivityClient() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [eventFilter, setEventFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const load = useCallback(
    async (append = false, nextCursor?: string | null) => {
      setLoading(true);
      const params = new URLSearchParams({ limit: "50" });
      if (eventFilter) params.set("event", eventFilter);
      if (moduleFilter) params.set("module", moduleFilter);
      if (append && nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/admin/activity?${params}`);
      const data = await res.json();
      setLoading(false);
      if (!res.ok) return;
      setEvents((prev) => (append ? [...prev, ...(data.events || [])] : data.events || []));
      setCursor(data.nextCursor || null);
    },
    [eventFilter, moduleFilter],
  );

  useEffect(() => {
    void load(false);
    const t = setInterval(() => void load(false), 20000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Activity</h1>
          <p className="text-xs text-[#5A5B7A]">Live feed aktivitas aplikasi · auto-refresh 20s</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams({ type: "activity" });
            if (eventFilter) params.set("event", eventFilter);
            if (moduleFilter) params.set("module", moduleFilter);
            window.location.href = `/api/admin/export?${params}`;
          }}
          className="rounded-xl border border-white/10 px-3 py-2 text-xs text-[#8B8AA0] hover:text-[#F2F1F8]"
        >
          Export CSV
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          placeholder="Filter event"
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#0F0F1A] px-3 py-2 text-sm"
        />
        <input
          placeholder="Filter module"
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#0F0F1A] px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void load(false)}
          className="rounded-xl bg-[#2DD4BF]/15 px-3 py-2 text-xs font-semibold text-[#2DD4BF]"
        >
          Terapkan
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/[0.08]" style={{ background: "#0D0D1A" }}>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-[10px] tracking-wide text-[#5A5B7A] uppercase">
              <th className="p-3">Waktu</th>
              <th className="p-3">Event</th>
              <th className="p-3">Module</th>
              <th className="p-3">User</th>
              <th className="p-3">Path</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-white/[0.04]">
                <td className="p-3 text-xs text-[#8B8AA0]">{new Date(e.created_at).toLocaleString("id-ID")}</td>
                <td className="p-3 font-medium text-[#2DD4BF]">{e.event}</td>
                <td className="p-3 text-[#8B8AA0]">{e.module || "—"}</td>
                <td className="p-3">
                  {e.user_id ? (
                    <Link href={`/admin/users/${e.user_id}`} className="text-[#38BDF8] hover:underline">
                      {e.user_id.slice(0, 8)}…
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-[200px] truncate p-3 text-xs text-[#5A5B7A]">{e.path || "—"}</td>
              </tr>
            ))}
            {!loading && events.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-[#5A5B7A]">
                  Belum ada event. Pastikan migration `app_events` sudah dijalankan di Supabase.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cursor && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(true, cursor)}
          className="mt-4 text-sm text-[#2DD4BF] hover:underline"
        >
          Muat lebih banyak
        </button>
      )}
    </div>
  );
}
