import Link from "next/link";

export default function TrackingLinkMissing() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08080f] px-6 text-center text-white">
      <div className="max-w-sm">
        <p className="text-lg font-semibold">Henima Tracking</p>
        <p className="mt-2 text-sm text-white/60">Link check-in belum lengkap. Buka dari dashboard, lalu tap Buka check-in pada nama orangnya.</p>
        <Link href="/dashboard/henima-tracking" className="mt-4 inline-block text-sm text-[#d4af37]">
          Ke Henima Tracking
        </Link>
      </div>
    </main>
  );
}
