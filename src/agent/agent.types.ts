export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: AgentToolCall[];
}

export interface AgentLlmResult {
  content: string;
  toolCalls: AgentToolCall[];
}

export interface AgentToolSpec {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export interface AgentLlm {
  readonly name: string;
  complete(messages: AgentChatMessage[], tools: AgentToolSpec[]): Promise<AgentLlmResult>;
}

export const AGENT_TOOLS: AgentToolSpec[] = [
  {
    name: "practice_overview",
    description: "Open VAT/ITSA obligations, unmatched bank lines, overdue invoices and open tasks for the signed-in firm.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_uncategorised_bank",
    description: "Unmatched bank transactions that still need a chart-of-accounts / VAT / ITSA code.",
    parameters: { type: "object", properties: { clientId: { type: "string" } } },
  },
  {
    name: "suggest_categories",
    description: "Run the categorisation engine on unmatched bank lines and return ledger, VAT and ITSA suggestions.",
    parameters: { type: "object", properties: { clientId: { type: "string" }, bankTransactionId: { type: "string" } } },
  },
  {
    name: "list_unmatched_bank",
    description: "Unmatched bank lines with invoice/bill match suggestions.",
    parameters: { type: "object", properties: { clientId: { type: "string" } } },
  },
  {
    name: "list_overdue_invoices",
    description: "Posted sales invoices whose due date has passed.",
    parameters: { type: "object", properties: { clientId: { type: "string" } } },
  },
  {
    name: "vat_position",
    description: "Open VAT obligations across the firm's clients.",
    parameters: { type: "object", properties: { clientId: { type: "string" } } },
  },
  {
    name: "itsa_position",
    description: "Open ITSA quarterly, EOPS and final-declaration obligations.",
    parameters: { type: "object", properties: { clientId: { type: "string" } } },
  },
  {
    name: "cash_position",
    description: "Bank account balances for the firm.",
    parameters: { type: "object", properties: { clientId: { type: "string" } } },
  },
  {
    name: "list_open_tasks",
    description: "Open practice tasks still on the board.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "search_transactions",
    description: "Search bank lines by merchant or description.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Merchant or narrative" }, clientId: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "propose_action",
    description: "Queue a confirmable bookkeeping action. Never post journals yourself — the accountant must apply it.",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", description: "APPLY_CATEGORY | APPLY_MATCH | CREATE_TASK | DRAFT_INVOICE" },
        title: { type: "string" },
        summary: { type: "string" },
        clientId: { type: "string" },
        payload: { type: "string", description: "JSON payload for the action" },
      },
      required: ["kind", "title", "summary", "payload"],
    },
  },
];
