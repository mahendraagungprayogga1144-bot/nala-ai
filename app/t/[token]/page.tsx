import { Plus_Jakarta_Sans } from "next/font/google";
import { isMissingTrackingTable, publicTrackingState } from "@/lib/henima-tracking/service";
import { type FieldState } from "./field-client";
import SalesPortal from "./sales-portal";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default async function TrackingFieldPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let state: FieldState | null = null;
  let missing = false;
  try {
    state = await publicTrackingState(token);
  } catch (err) {
    missing = isMissingTrackingTable(err);
  }
  if (!state) {
    return (
      <main className={`${jakarta.className} flex min-h-screen items-center justify-center bg-[#F7F7F5] px-6 text-center text-[#111]`}>
        <div>
          <p className="text-lg font-semibold tracking-[0.08em]">HENIMA</p>
          <p className="mt-2 text-sm text-[#6B6B6B]">
            {missing
              ? "Modul belum aktif di database. Jalankan migration 20261019_henima_tracking.sql."
              : "Link ini tidak berlaku. Minta link baru ke leader."}
          </p>
        </div>
      </main>
    );
  }
  return <SalesPortal token={token} field={state} />;
}
