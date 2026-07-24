import { getPlatformSettings } from "@/lib/admin/settings";
import Link from "next/link";

export default async function MaintenancePage() {
  const settings = await getPlatformSettings();
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#0A0A12] px-6 text-[#F2F1F8]">
      <div className="max-w-md text-center">
        <img src="/logo-gercep.png" alt="Gercep AI" className="mx-auto mb-6 h-14 w-14 rounded-xl object-cover" />
        <h1 className="mb-2 text-2xl font-semibold">Maintenance</h1>
        <p className="mb-6 text-sm text-[#8B8AA0]">{settings.maintenance_message}</p>
        <Link href="/login" className="text-sm text-[#2DD4BF] hover:underline">
          Coba masuk lagi
        </Link>
      </div>
    </main>
  );
}
