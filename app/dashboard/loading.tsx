export default function DashboardLoading() {
  return (
    <div className="w-full min-w-0 animate-pulse px-3 py-6 sm:px-8 sm:py-8">
      <div className="mb-4 h-7 w-48 rounded-lg bg-white/[0.06]" />
      <div className="mb-6 h-4 w-72 max-w-full rounded bg-white/[0.04]" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-white/[0.06] bg-[#0D0D1A]" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-white/[0.06] bg-[#0D0D1A]" />
    </div>
  );
}
