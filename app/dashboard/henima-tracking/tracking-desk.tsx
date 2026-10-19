"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { mapsUrl, type TrackingLink, type TrackingPoint } from "@/lib/henima-tracking/shared";
import TrackingMap, { staffColor } from "./tracking-map";

const KIND: Record<TrackingPoint["kind"], string> = {
  checkin_pagi: "Check-in",
  checkin_sore: "Check-out",
  visit: "Nawar",
  ping: "Jejak",
};

function clock(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function TrackingDesk({
  date,
  links,
  points,
  notice,
}: {
  date: string;
  links: TrackingLink[];
  points: TrackingPoint[];
  notice?: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState("");
  const [focus, setFocus] = useState<string>("all");
  const [nama, setNama] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 25000);
    return () => window.clearInterval(timer);
  }, [router]);

  const colorOf = useMemo(() => {
    const map = new Map(links.map((link, index) => [link.staffId, staffColor(index)]));
    return (staffId: string) => map.get(staffId) || "#00f0ff";
  }, [links]);

  const visible = focus === "all" ? points : points.filter((point) => point.staff_id === focus);
  const docs = [...visible]
    .filter((point) => point.kind === "visit" || point.kind === "checkin_pagi" || point.photo_url)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));

  async function copy(link: TrackingLink) {
    await navigator.clipboard.writeText(`${window.location.origin}${link.path}`);
    setCopied(link.staffId);
  }

  async function addSales() {
    const name = nama.trim();
    if (!name) return;
    setAdding(true);
    setFormError("");
    try {
      const created = await fetch("/api/sales/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: name, role: "SALES" }),
      });
      const json = await created.json();
      if (!created.ok) throw new Error(json.error || "Gagal menambah sales.");
      const activated = await fetch("/api/sales/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_status", staffId: json.id, status: "active" }),
      });
      const activatedJson = await activated.json();
      if (!activated.ok) throw new Error(activatedJson.error || "Sales tercatat, tetapi belum bisa check-in.");
      setNama("");
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menambah sales.");
    } finally {
      setAdding(false);
    }
  }

  async function activate(staffId: string) {
    setFormError("");
    const response = await fetch("/api/sales/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", staffId, status: "active" }),
    });
    const json = await response.json();
    if (!response.ok) {
      setFormError(json.error || "Gagal mengaktifkan sales.");
      return;
    }
    router.refresh();
  }

  return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#00f0ff]/25 bg-[#05070d] shadow-[0_0_40px_rgba(0,240,255,0.08)]">
      <style>{`
        .henima-track-map .leaflet-control-zoom a { background:#070b12; color:#00f0ff; border-color:rgba(0,240,255,.35); }
        .henima-track-map .leaflet-popup-content-wrapper, .henima-track-map .leaflet-popup-tip {
          background:#070b12; color:#e7fff8; box-shadow:0 0 18px rgba(0,240,255,.28);
        }
        .henima-track-map .leaflet-container { background:#05070d; font-family:inherit; }
      `}</style>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_1fr]">
        <aside className="max-h-[40vh] overflow-y-auto border-b border-[#00f0ff]/15 bg-[#070b12]/95 p-4 lg:max-h-none lg:border-b-0 lg:border-r">
          <p className="text-[10px] font-bold tracking-[0.22em] text-[#00f0ff]">HENIMA TRACKING</p>
          <p className="mt-1 text-xs text-white/45">{date} · peta diperbarui otomatis</p>
          {notice && <p className="mt-2 rounded-lg border border-red-500/30 bg-red-950/40 px-2 py-2 text-[11px] text-red-200">{notice}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFocus("all")}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${focus === "all" ? "border-[#00f0ff] text-[#00f0ff]" : "border-white/10 text-white/45"}`}
            >
              Semua
            </button>
            {links.map((link) => (
              <button
                key={link.staffId}
                type="button"
                onClick={() => setFocus(link.staffId)}
                className="rounded-full border px-2.5 py-1 text-[11px]"
                style={{
                  borderColor: focus === link.staffId ? colorOf(link.staffId) : "rgba(255,255,255,.12)",
                  color: colorOf(link.staffId),
                }}
              >
                {link.nama}
              </button>
            ))}
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void addSales();
            }}
          >
            <input
              value={nama}
              onChange={(event) => setNama(event.target.value)}
              placeholder="Nama sales"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs text-white outline-none"
            />
            <button type="submit" disabled={adding || !nama.trim()} className="rounded-lg bg-[#d4af37] px-2 py-2 text-[11px] font-semibold text-[#08080f] disabled:opacity-40">
              {adding ? "..." : "Tambah"}
            </button>
          </form>
          {formError && <p className="mt-2 text-[11px] text-red-300">{formError}</p>}

          <div className="mt-4 space-y-3">
            {links.length === 0 && <p className="text-xs text-white/40">Belum ada orang. Isi nama di atas, atau buka link check-in setelah namamu muncul.</p>}
            {links
              .filter((link) => focus === "all" || link.staffId === focus)
              .map((link) => {
                const mine = points.filter((point) => point.staff_id === link.staffId);
                const pagi = mine.find((point) => point.kind === "checkin_pagi");
                const sore = mine.find((point) => point.kind === "checkin_sore");
                const visits = mine.filter((point) => point.kind === "visit");
                const last = mine[0];
                return (
                  <article key={link.staffId} className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-white" style={{ color: colorOf(link.staffId) }}>
                        {link.nama}
                      </p>
                      <button type="button" onClick={() => void copy(link)} className="text-[11px] text-[#d4af37]">
                        {copied === link.staffId ? "Tersalin" : "Salin link"}
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-white/40">
                      {link.status !== "active"
                        ? "Belum aktif. Aktifkan dulu supaya bisa check-in."
                        : link.terhubung
                          ? "Akun sudah terhubung"
                          : "Buka check-in, lalu sales masuk dengan akunnya."}
                    </p>
                    {link.status === "active" ? (
                      <a
                        href={link.path}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block rounded-lg bg-[#d4af37] py-2 text-center text-[11px] font-semibold text-[#08080f]"
                      >
                        Buka check-in
                      </a>
                    ) : (
                      <button type="button" onClick={() => void activate(link.staffId)} className="mt-2 w-full rounded-lg bg-white/10 py-2 text-[11px]">
                        Aktifkan untuk check-in
                      </button>
                    )}
                    <p className="mt-1 text-[11px] text-white/50">
                      {pagi ? `CI ${clock(pagi.recorded_at)}${pagi.late ? " telat" : ""}` : "Belum check-in"}
                      {sore ? ` · CO ${clock(sore.recorded_at)}` : pagi ? " · masih di jalan" : ""}
                      {` · ${visits.length} nawar`}
                    </p>
                    {last && (
                      <a href={mapsUrl(last.lat, last.lng)} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-[#00f0ff]">
                        Terakhir {clock(last.recorded_at)} · {KIND[last.kind]}
                      </a>
                    )}
                  </article>
                );
              })}
          </div>

          <h2 className="mb-2 mt-5 text-[10px] font-bold tracking-[0.18em] text-[#d4af37]">DOKUMENTASI</h2>
          {docs.length === 0 ? (
            <p className="text-xs text-white/35">Foto dan tempat nawar muncul di sini setelah sales check-in.</p>
          ) : (
            <ul className="space-y-3">
              {docs.map((point) => {
                const who = links.find((link) => link.staffId === point.staff_id)?.nama || "Sales";
                return (
                  <li key={point.id} className="overflow-hidden rounded-xl border border-white/10">
                    {point.photo_url && <img src={point.photo_url} alt="" className="h-28 w-full object-cover" />}
                    <div className="p-2">
                      <p className="text-xs text-white">
                        {who} · {KIND[point.kind]}
                      </p>
                      <p className="text-[11px] text-white/50">
                        {clock(point.recorded_at)}
                        {point.note ? ` · ${point.note}` : ""}
                      </p>
                      <a href={mapsUrl(point.lat, point.lng)} target="_blank" rel="noreferrer" className="text-[11px] text-[#00f0ff]">
                        Buka titik
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className="relative min-h-[55vh] lg:min-h-0">
          <div className="pointer-events-none absolute inset-0 z-[400] bg-[linear-gradient(rgba(0,240,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <TrackingMap points={visible} colorOf={colorOf} />
        </div>
      </div>
    </div>
  );
}
