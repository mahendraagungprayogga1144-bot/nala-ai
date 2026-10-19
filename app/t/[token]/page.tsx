import { isMissingTrackingTable, publicTrackingState } from "@/lib/henima-tracking/service";
import FieldClient, { type FieldState } from "./field-client";

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
      <main className="flex min-h-screen items-center justify-center bg-[#08080f] px-6 text-center text-white">
        <div>
          <p className="text-lg font-semibold">Henima Tracking</p>
          <p className="mt-2 text-sm text-white/50">
            {missing ? "Modul belum aktif di database. Jalankan migration 20261019_henima_tracking.sql." : "Link ini tidak berlaku. Minta link baru ke leader."}
          </p>
        </div>
      </main>
    );
  }
  return <FieldClient token={token} initial={state} />;
}
