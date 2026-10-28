export type AgentStatus = "idle" | "working" | "error";

export type OfficeRoomId = "sales" | "ops" | "founder" | "pantry";

export type WorkRoomId = Exclude<OfficeRoomId, "pantry">;

export type OfficeViewMode = "2d" | "3d";

export const LAPORAN_AGENT_ID = "laporan-harian";
export const SALES_AGENT_ID = "monitor-sales";
export const STOK_AGENT_ID = "stok-produksi";
export const WA_AGENT_ID = "balas-wa";

export type OfficeAgent = {
  id: string;
  business_id: string;
  name: string;
  room: WorkRoomId;
  /** hall = berdiri di selasar, bukan duduk di meja ruangnya. */
  place: "desk" | "hall";
  status: AgentStatus;
  /** True only when Monitor Sales has nobody in the field and walks to Pantry. */
  at_pantry: boolean;
  current_task: string | null;
  color: string;
};

export type OfficeProductBrief = {
  id: string;
  name: string;
  stock: number;
  min_stock: number;
  unit: string | null;
};

export type OfficeSnapshot = {
  business_id: string;
  agents: OfficeAgent[];
  crew_active: number;
  crew_total: number;
  tasks_running: number;
  /** Kosong kalau semua sumber terbaca. Kalau satu sumber gagal, hanya sumber itu yang disebut. */
  notices: string[];
  products: OfficeProductBrief[];
  /** Path publik `/w/...`. Kosong kalau tautan belum bisa dibuat. */
  wa_path: string | null;
};
