export default function HenimaRiwayatLoading() {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 bg-[#F8FAFC] px-6 text-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#BFDBFE] border-t-[#2563EB]" aria-hidden />
      <p className="text-sm font-semibold text-[#0F172A]">Memuat Riwayat…</p>
      <p className="text-xs font-medium text-[#64748B]">Sedang mengambil aktivitas perusahaan.</p>
    </div>
  );
}
