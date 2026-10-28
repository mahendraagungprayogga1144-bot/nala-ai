import { roomById } from "./layout";
import { LAPORAN_AGENT_ID, SALES_AGENT_ID, STOK_AGENT_ID, WA_AGENT_ID, type AgentStatus, type OfficeAgent } from "./types";

export const STATUS_LABEL: Record<AgentStatus, string> = {
  working: "Sedang kerja",
  idle: "Istirahat",
  error: "Stok kritis",
};

const SUGGESTIONS: Record<string, readonly string[]> = {
  [LAPORAN_AGENT_ID]: [
    "Berapa laba bersih bulan ini?",
    "Parfum mana yang paling laku?",
    "Siapa yang belum lunas?",
    "Berapa omzet, HPP, dan biaya hari ini?",
  ],
  [SALES_AGENT_ID]: [
    "Siapa yang ada di lapangan hari ini?",
    "Bagaimana rute hari ini?",
    "Target bulan ini sudah berapa?",
    "Follow-up siapa yang belum dikerjakan?",
  ],
  [STOK_AGENT_ID]: [
    "Apa yang perlu diproduksi?",
    "Produk apa yang stoknya kritis?",
    "Daftar produk yang habis.",
    "Produk mana yang stoknya paling rendah?",
  ],
  [WA_AGENT_ID]: [
    "Di mana tautan WA?",
    "Berapa chat hari ini?",
    "Apa balasan otomatisnya?",
    "Produk apa yang disebut ke customer?",
  ],
};

export function suggestionsFor(agentId: string) {
  return SUGGESTIONS[agentId] ?? [];
}

export function taskLine(agent: OfficeAgent) {
  return agent.current_task ?? "Tidak ada tugas.";
}

export function placeLine(agent: OfficeAgent) {
  const home = roomById(agent.room).label;
  if (agent.place === "hall") return "Berdiri di selasar, menjaga tautan WhatsApp.";
  if (agent.at_pantry) return `Sekarang di Pantry. Meja asalnya ${home}.`;
  if (agent.status === "error") return `Masih duduk di ${home}.`;
  return `Duduk di meja ${home}.`;
}

export function statusMeaning(agent: OfficeAgent) {
  if (agent.id === STOK_AGENT_ID && agent.status === "error") return "Ada produk yang harus diproduksi, atau stoknya sudah di batas minimum.";
  if (agent.id === WA_AGENT_ID) return "Henima AI membalas tautan sendiri, termasuk pertanyaan customer dan pelamar kerja.";
  if (agent.status === "working") return "Ada data hari ini yang sedang dia pegang.";
  if (agent.at_pantry) return "Tidak ada yang di lapangan. Dia jalan ke Pantry dan mejanya dikosongkan.";
  if (agent.status === "idle") return "Hari ini belum ada yang perlu dikerjakan di bagian ini.";
  return "Ada produk yang stoknya sudah di batas minimum atau habis. Halaman kantor tetap normal.";
}
