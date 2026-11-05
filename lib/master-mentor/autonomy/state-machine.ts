import type { TaskStatus } from "./types";
import { MentorValidationError } from "../types";

/** Valid transitions for Phase 7 autonomous tasks. */
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["planning", "cancelled", "expired"],
  planning: ["waiting_approval", "approved", "executing", "failed", "cancelled", "paused"],
  waiting_approval: ["approved", "rejected", "cancelled", "expired", "paused"],
  approved: ["executing", "cancelled", "paused", "expired"],
  executing: ["verifying", "waiting_approval", "failed", "cancelled", "paused"],
  verifying: ["completed", "failed", "cancelled"],
  completed: [],
  rejected: [],
  failed: ["pending"], // safe retry restart
  cancelled: [],
  paused: ["pending", "executing", "cancelled", "expired"],
  expired: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: TaskStatus, to: TaskStatus) {
  if (!canTransition(from, to)) {
    throw new MentorValidationError(`Transisi status tidak valid: ${from} → ${to}`);
  }
}

export const TERMINAL_STATUSES: TaskStatus[] = [
  "completed",
  "rejected",
  "failed",
  "cancelled",
  "expired",
];

export function isTerminal(status: TaskStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
