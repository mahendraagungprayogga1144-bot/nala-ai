import { roomById } from "./layout";
import type { AgentStatus, OfficeAgent } from "./types";

export const STATUS_LABEL: Record<AgentStatus, string> = {
  working: "Sedang kerja",
  idle: "Istirahat",
  error: "Tugas gagal",
};

export function taskLine(agent: OfficeAgent) {
  return agent.current_task ?? "Tidak ada tugas.";
}

export function placeLine(agent: OfficeAgent) {
  const home = roomById(agent.room).label;
  if (agent.status === "idle") return `Sekarang di Pantry. Meja asalnya ${home}.`;
  if (agent.status === "error") return `Masih duduk di ${home}.`;
  return `Duduk di meja ${home}.`;
}

export function statusMeaning(status: AgentStatus) {
  if (status === "working") return "Orang ini sedang mengerjakan tugas, jadi dia masuk hitungan sedang kerja.";
  if (status === "idle") return "Tidak ada tugas. Dia jalan ke Pantry dan mejanya dikosongkan.";
  return "Tugas contoh ini gagal. Halaman kantor tetap normal. Orang lain tetap kelihatan.";
}
