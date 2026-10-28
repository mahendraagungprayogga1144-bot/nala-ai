import { officeRepository } from "./repository";
import type { OfficeSnapshot } from "./types";

export function loadOfficeSnapshot(businessId: string): OfficeSnapshot {
  const id = businessId.trim();
  if (!id) throw new Error("active_business_id kosong.");

  const agents = officeRepository.listAgents(id);
  const working = agents.filter((agent) => agent.status === "working");

  return {
    business_id: id,
    agents,
    crew_active: working.length,
    crew_total: agents.length,
    tasks_running: working.filter((agent) => agent.current_task).length,
  };
}
