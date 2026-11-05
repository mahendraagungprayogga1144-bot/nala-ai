import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutonomyLevel } from "./types";

export type ToolRisk = "low" | "medium" | "high" | "critical";

export type ToolContext = {
  db: SupabaseClient;
  ownerUserId: string;
  businessId?: string | null;
  taskId?: string | null;
  stepId?: string | null;
};

export type ToolDefinition = {
  name: string;
  description: string;
  permissionLevel: AutonomyLevel;
  risk: ToolRisk;
  requiresApproval: boolean;
  businessScoped: boolean;
  inputSchema: Record<string, string>;
  outputSchema: Record<string, string>;
  handler: (ctx: ToolContext, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const registry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition) {
  if (registry.has(tool.name)) {
    throw new Error(`Tool already registered: ${tool.name}`);
  }
  registry.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | null {
  return registry.get(name) || null;
}

export function listTools(): ToolDefinition[] {
  return Array.from(registry.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function listToolsPublic() {
  return listTools().map((t) => ({
    name: t.name,
    description: t.description,
    permissionLevel: t.permissionLevel,
    risk: t.risk,
    requiresApproval: t.requiresApproval,
    businessScoped: t.businessScoped,
    inputSchema: t.inputSchema,
    outputSchema: t.outputSchema,
  }));
}
