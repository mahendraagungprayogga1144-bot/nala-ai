import type { MentorContextPack } from "../memory-types";
import type { FinanceSnapshot } from "../finance/calculations";
import type { ProviderUsage } from "../providers/types";

export const SPECIALISTS = [
  "chairman",
  "strategy",
  "cfo",
  "growth",
  "operations",
  "risk",
] as const;

export type SpecialistId = (typeof SPECIALISTS)[number];

export type SpecialistBrief = {
  id: SpecialistId;
  label: string;
  ran: boolean;
  summary: string;
  usage?: ProviderUsage;
};

export type AgentRunInput = {
  question: string;
  context: MentorContextPack;
  finance?: FinanceSnapshot | null;
  peerNotes?: string;
  complex: boolean;
};

export type AgentRunOutput = {
  specialist: SpecialistId;
  label: string;
  analysis: string;
  usage: ProviderUsage;
};
