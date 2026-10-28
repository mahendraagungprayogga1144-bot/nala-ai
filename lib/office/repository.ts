import type { OfficeAgent } from "./types";

/**
 * Stage 1 membaca data dummy.
 * Stage 2 mengganti isi ini dengan tabel ai_agents + ai_tasks (Realtime).
 * Kontrak tetap `listAgents(businessId)` supaya service dan hook tidak berubah.
 */
export type OfficeRepository = {
  listAgents(businessId: string): OfficeAgent[];
};

const SEED: readonly Omit<OfficeAgent, "business_id">[] = [
  {
    id: "laporan-harian",
    name: "Laporan Harian",
    room: "founder",
    status: "working",
    current_task: "Menyusun ringkasan omzet dan aktivitas hari ini",
    color: "#2DD4BF",
  },
  {
    id: "monitor-sales",
    name: "Monitor Sales",
    room: "sales",
    status: "idle",
    current_task: null,
    color: "#A78BFA",
  },
  {
    id: "stok-produksi",
    name: "Stok & Produksi",
    room: "ops",
    status: "error",
    current_task: "Gagal membaca stok produksi",
    color: "#F59E0B",
  },
];

export const officeRepository: OfficeRepository = {
  listAgents(businessId) {
    return SEED.map((agent) => ({ ...agent, business_id: businessId }));
  },
};
