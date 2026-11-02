"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronRight,
  FileText,
  MapPinned,
  Package,
  ShoppingBag,
  Star,
  Target,
  Trophy,
  Wallet,
} from "lucide-react";
import { type OwnerDashboardSummary, pctChange } from "@/lib/henima-tracking/owner-dashboard";

const GOLD = "#C5A358";

function rp(n: number) {
  return `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const pct = pctChange(current, previous);
  if (!previous && !current) return <span className="text-xs text-[#8A8A8A]">vs bulan lalu</span>;
  const up = pct >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct)}% dari bulan lalu
    </span>
  );
}

export default function TrackingHome({
  ownerName,
  summary,
  onOpenLokasi,
}: {
  ownerName: string;
  summary: OwnerDashboardSummary;
  onOpenLokasi: () => void;
}) {
  const [chartMode, setChartMode] = useState<"harian" | "mingguan" | "bulanan">("harian");
  const series = useMemo(() => {
    if (chartMode === "mingguan") return summary.chartWeekly.map((r) => ({ label: r.label, value: r.omzet }));
    if (chartMode === "bulanan") return summary.chartMonthly.map((r) => ({ label: r.label, value: r.omzet }));
    return summary.chartDaily.map((r) => ({ label: r.label, value: r.omzet }));
  }, [chartMode, summary]);

  const targetGoal = summary.targetRevenue > 0 ? summary.targetRevenue : summary.targetQty > 0 ? summary.targetQty : 0;
  const targetLabel = summary.targetRevenue > 0 ? rp(summary.targetRevenue) : summary.targetQty > 0 ? `${summary.targetQty} botol` : "Belum di-set";
  const progress = Math.min(100, Math.max(0, summary.pencapaianPct));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111]">
            Selamat Datang, <span style={{ color: GOLD }}>{ownerName}</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B6B6B]">Semangat hari ini, tingkatkan penjualan HENIMA.</p>
        </div>
        <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E8E8E4] bg-white px-3 text-sm font-semibold text-[#111]">
          {summary.monthLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Shortcut href="#lokasi" icon={MapPinned} title="Check-in Lokasi" onClick={onOpenLokasi} />
        <Shortcut href="/dashboard/sales/orders" icon={ShoppingBag} title="Catat Penjualan" />
        <Shortcut href="/dashboard/sales/orders" icon={Wallet} title="Input Pembayaran" />
        <Shortcut href="/dashboard/sales/reports" icon={FileText} title="Lihat Laporan" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric
          icon={ShoppingBag}
          label="Total Penjualan"
          value={rp(summary.omzetBulan)}
          footer={<Delta current={summary.omzetBulan} previous={summary.omzetBulanLalu} />}
        />
        <Metric
          icon={Package}
          label="Total Botol Terjual"
          value={`${summary.botolBulan} pcs`}
          footer={<Delta current={summary.botolBulan} previous={summary.botolBulanLalu} />}
        />
        <Metric
          icon={Wallet}
          label="Saldo Penjualan"
          value={rp(summary.saldoPenjualan)}
          footer={<span className="text-xs text-[#8A8A8A]">Lunas bulan ini · pending {rp(summary.pendingTotal)}</span>}
        />
        <Metric
          icon={Target}
          label="Target Bulanan"
          value={targetLabel}
          footer={
            <Progress pct={progress} />
          }
        />
        <Metric
          icon={Trophy}
          label="Pencapaian"
          value={rp(summary.pencapaianOmzet)}
          footer={<Progress pct={progress} caption={`${progress}%`} />}
        />
        <Metric
          icon={Star}
          label="Bonus"
          value={rp(summary.bonusBulan)}
          footer={
            <Link href="/dashboard/sales/commissions" className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: GOLD }}>
              Detail komisi <ChevronRight size={12} />
            </Link>
          }
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
        <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7F4EC]">
                <FileText size={16} color={GOLD} />
              </span>
              <h2 className="text-sm font-bold text-[#111]">Ringkasan Penjualan</h2>
            </div>
            <div className="flex overflow-hidden rounded-full border border-[#E8E8E4] text-xs font-semibold">
              {(
                [
                  ["harian", "Harian"],
                  ["mingguan", "Mingguan"],
                  ["bulanan", "Bulanan"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setChartMode(id)}
                  className={`px-3 py-1.5 ${chartMode === id ? "bg-[#111] text-white" : "bg-white text-[#6B6B6B]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <SalesChart points={series} />
        </div>

        <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)]">
          <h2 className="text-sm font-bold text-[#111]">Produk Terlaris</h2>
          <p className="mt-1 text-xs text-[#8A8A8A]">Bulan ini · data lunas</p>
          <ul className="mt-4 space-y-3">
            {summary.topProducts.map((product, index) => (
              <li key={product.name} className="flex items-center gap-3 rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-3">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl text-[10px] font-bold ${
                    product.kind === "afternoon" ? "bg-[#111] text-white" : "bg-white text-[#111] border border-[#E8E8E4]"
                  }`}
                >
                  {product.kind === "afternoon" ? "AFT" : product.kind === "distance" ? "DST" : `#${index + 1}`}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold uppercase tracking-wide">{product.name}</p>
                  <p className="text-xs text-[#6B6B6B]">{product.qty} pcs</p>
                </div>
              </li>
            ))}
          </ul>
          {!summary.topProducts.some((p) => p.qty > 0) && (
            <p className="mt-3 text-xs text-[#8A8A8A]">Belum ada penjualan lunas bulan ini.</p>
          )}
        </div>
      </section>

      {targetGoal === 0 && (
        <p className="rounded-xl border border-[#E8E8E4] bg-[#F7F4EC] px-3 py-2 text-xs text-[#6B6B6B]">
          Target bulanan belum di-set. Atur di{" "}
          <Link href="/dashboard/sales/targets" className="font-semibold underline" style={{ color: GOLD }}>
            Sales → Target
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function Shortcut({
  href,
  icon: Icon,
  title,
  onClick,
}: {
  href: string;
  icon: typeof MapPinned;
  title: string;
  onClick?: () => void;
}) {
  const className =
    "flex items-center gap-3 rounded-2xl border border-[#E8E8E4] bg-white px-3.5 py-3 text-left shadow-[0_4px_16px_rgba(17,17,17,0.03)] transition hover:border-[#C5A358]/50";
  const inner = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F4EC]">
        <Icon size={18} color={GOLD} />
      </span>
      <span className="min-w-0 flex-1 text-sm font-bold text-[#111]">{title}</span>
      <ChevronRight size={16} className="text-[#B0B0B0]" />
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  footer,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
  footer: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8A8A]">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7F4EC]">
          <Icon size={15} color={GOLD} />
        </span>
      </div>
      <p className="mt-2 text-xl font-bold text-[#111]">{value}</p>
      <div className="mt-2">{footer}</div>
    </div>
  );
}

function Progress({ pct, caption }: { pct: number; caption?: string }) {
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-[#EFEFEA]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: GOLD }} />
      </div>
      {caption ? <p className="mt-1 text-xs font-semibold text-[#6B6B6B]">{caption}</p> : null}
    </div>
  );
}

function SalesChart({ points }: { points: { label: string; value: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 560;
  const h = 220;
  const padX = 28;
  const padY = 24;
  const coords = points.map((p, i) => {
    const x = padX + (i * (w - padX * 2)) / Math.max(1, points.length - 1);
    const y = h - padY - (p.value / max) * (h - padY * 2);
    return { ...p, x, y };
  });
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const area = `${line} L${coords[coords.length - 1]?.x || padX},${h - padY} L${padX},${h - padY} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[220px] w-full min-w-[320px]">
        {[0, 0.33, 0.66, 1].map((t) => {
          const y = h - padY - t * (h - padY * 2);
          const label = t === 0 ? "0" : t === 1 ? formatAxis(max) : "";
          return (
            <g key={t}>
              <line x1={padX} x2={w - padX} y1={y} y2={y} stroke="#EFEFEA" strokeWidth="1" />
              {label ? (
                <text x={4} y={y + 4} fontSize="10" fill="#8A8A8A">
                  {label}
                </text>
              ) : null}
            </g>
          );
        })}
        <path d={area} fill="url(#henimaGoldFill)" opacity="0.35" />
        <path d={line} fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c) => (
          <g key={c.label + c.x}>
            <circle cx={c.x} cy={c.y} r="4" fill="#fff" stroke={GOLD} strokeWidth="2" />
            <text x={c.x} y={h - 6} textAnchor="middle" fontSize="10" fill="#8A8A8A">
              {c.label}
            </text>
          </g>
        ))}
        <defs>
          <linearGradient id="henimaGoldFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.45" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      {!points.some((p) => p.value > 0) && (
        <p className="-mt-8 text-center text-xs text-[#8A8A8A]">Belum ada omzet pada periode ini.</p>
      )}
    </div>
  );
}

function formatAxis(n: number) {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10} jt`;
  if (n >= 1000) return `${Math.round(n / 100) / 10} rb`;
  return String(n);
}
