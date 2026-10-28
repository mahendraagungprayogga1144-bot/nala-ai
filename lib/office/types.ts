export type AgentStatus = "idle" | "working" | "error";

export type OfficeRoomId = "sales" | "ops" | "founder" | "pantry";

export type WorkRoomId = Exclude<OfficeRoomId, "pantry">;

export type OfficeViewMode = "2d" | "3d";

export type OfficeAgent = {
  id: string;
  business_id: string;
  name: string;
  room: WorkRoomId;
  status: AgentStatus;
  current_task: string | null;
  color: string;
};

export type OfficeSnapshot = {
  business_id: string;
  agents: OfficeAgent[];
  crew_active: number;
  crew_total: number;
  tasks_running: number;
};
