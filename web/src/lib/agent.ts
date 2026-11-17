import { apiFetch } from "./api";

export type AgentActionKind = "APPLY_CATEGORY" | "APPLY_MATCH" | "CREATE_TASK" | "DRAFT_INVOICE" | string;
export type AgentActionStatus = "PROPOSED" | "APPLIED" | "DISMISSED" | "FAILED" | string;

export interface AgentConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
  messageCount: number;
  actionCount: number;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  createdAt: string;
}

export interface AgentAction {
  id: string;
  kind: AgentActionKind;
  status: AgentActionStatus;
  title: string;
  summary: string;
  clientId: string | null;
  payload: unknown;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AgentConversation {
  id: string;
  title: string | null;
  updatedAt: string;
  llm: string;
  messages: AgentMessage[];
  actions: AgentAction[];
  prompts: string[];
}

export const DEFAULT_AGENT_PROMPTS = [
  "What needs my attention?",
  "Categorise unmatched bank lines",
  "Match invoices and bills",
  "Who owes us money?",
  "VAT position this quarter",
  "ITSA obligations due",
];

export function listAgentConversations() {
  return apiFetch<AgentConversationSummary[]>("/agent/conversations");
}

export function createAgentConversation(title?: string) {
  return apiFetch<AgentConversation>("/agent/conversations", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function getAgentConversation(id: string) {
  return apiFetch<AgentConversation>(`/agent/conversations/${id}`);
}

export function askAgent(content: string, conversationId?: string) {
  const path = conversationId ? `/agent/conversations/${conversationId}/messages` : "/agent/messages";
  return apiFetch<AgentConversation>(path, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function applyAgentAction(id: string) {
  return apiFetch<AgentConversation>(`/agent/actions/${id}/apply`, { method: "POST" });
}

export function dismissAgentAction(id: string) {
  return apiFetch<AgentConversation>(`/agent/actions/${id}/dismiss`, { method: "POST" });
}

export function agentActionKindLabel(kind?: string | null): string {
  switch (String(kind ?? "").toUpperCase()) {
    case "APPLY_CATEGORY":
      return "Categorise";
    case "APPLY_MATCH":
      return "Match";
    case "CREATE_TASK":
      return "Task";
    case "DRAFT_INVOICE":
      return "Invoice";
    default:
      return kind ? kind.replace(/[_-]+/g, " ") : "Action";
  }
}

export function agentActionStatusLabel(status?: string | null): string {
  switch (String(status ?? "").toUpperCase()) {
    case "PROPOSED":
      return "Needs confirmation";
    case "APPLIED":
      return "Posted";
    case "DISMISSED":
      return "Dismissed";
    case "FAILED":
      return "Failed";
    default:
      return status ?? "—";
  }
}

export function canApplyAgentActions(role?: string | null): boolean {
  return role === "firm_admin" || role === "firm_accountant" || role === "ADMIN" || role === "ACCOUNTANT";
}

export function isAgentUpgradeError(error: { errorCode?: string; message?: string } | null | undefined): boolean {
  if (!error) {
    return false;
  }
  return error.errorCode === "BILLING_FEATURE_REQUIRED" || /bookkeeping agent/i.test(error.message ?? "");
}
