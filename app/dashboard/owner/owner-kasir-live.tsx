export type LiveKasirRow = {
  employeeId: string;
  nama: string;
  jamMasuk: string;
  orderCount: number;
  omzet: number;
  isActive: boolean;
};

export default function OwnerKasirLive({
  rows,
  businessName,
}: {
  rows: LiveKasirRow[];
  businessName?: string;
}) {
  const active = rows.filter(r => r.isActive);

  return (
    <div className="dashboard-card dashboard-card-hover mb-4 overflow-hidden p-0">
      <div className="h-[2px] bg-gradient-to-r from-transparent via-[#A78BFA]/60 to-transparent" />
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div>
            <h2 className="dash-card-title flex items-center gap-2">
              Kasir Live
              {active.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#2DD4BF]/15 px-2 py-0.5 text-[10px] font-medium text-[#2DD4BF]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2DD4BF]" />
                  {active.length} aktif
                </span>
              )}
            </h2>
            {businessName && <p className="text-[10px] text-slate-500">{businessName} · shift hari ini</p>}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-600">Belum ada karyawan check-in hari ini</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map(r => (
              <div
                key={r.employeeId}
                className={
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 " +
                  (r.isActive ? "border-[#2DD4BF]/25 bg-[#2DD4BF]/5" : "border-white/[0.06] bg-[#0b0e14]/40 opacity-70")
                }
              >
                <div
                  className={
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold " +
                    (r.isActive ? "bg-[#2DD4BF]/20 text-[#2DD4BF]" : "bg-white/5 text-slate-500")
                  }
                >
                  {r.nama.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200">{r.nama}</p>
                  <p className="text-[10px] text-slate-500">
                    {r.isActive ? `Shift · masuk ${r.jamMasuk}` : `Pulang · masuk ${r.jamMasuk}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs font-semibold text-[#2DD4BF]">{r.orderCount} order</p>
                  <p className="font-mono text-[10px] text-slate-500">Rp{r.omzet.toLocaleString("id-ID")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
