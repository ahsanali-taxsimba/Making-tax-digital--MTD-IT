export type AgentIntent =
  | "overview"
  | "categorise"
  | "match"
  | "invoices"
  | "vat"
  | "itsa"
  | "cash"
  | "tasks"
  | "search";

export function detectIntent(message: string): AgentIntent {
  const text = message.toLowerCase();
  if (/\b(uncategoris|categoris|code this|auto-?code|bookkeep|ledger code)/.test(text)) return "categorise";
  if (/\b(match|reconcil|unmatch|settle)\b/.test(text)) return "match";
  if (/\b(owe|overdue|who owes|aged debt|sales invoice)\b/.test(text)) return "invoices";
  if (/\b(vat|box\s*[1-9]|notice 700)\b/.test(text)) return "vat";
  if (/\b(itsa|quarterly update|eops|self[- ]assessment)\b/.test(text)) return "itsa";
  if (/\b(cash|bank balance|cashflow|how much in the bank)\b/.test(text)) return "cash";
  if (/\b(task|workload|to-?do)\b/.test(text)) return "tasks";
  if (/\b(find|search|look up|merchant)\b/.test(text)) return "search";
  return "overview";
}

export function toolsForIntent(intent: AgentIntent, message: string): Array<{ name: string; arguments: Record<string, unknown> }> {
  switch (intent) {
    case "categorise":
      return [{ name: "list_uncategorised_bank", arguments: {} }, { name: "suggest_categories", arguments: {} }];
    case "match":
      return [{ name: "list_unmatched_bank", arguments: {} }];
    case "invoices":
      return [{ name: "list_overdue_invoices", arguments: {} }];
    case "vat":
      return [{ name: "vat_position", arguments: {} }];
    case "itsa":
      return [{ name: "itsa_position", arguments: {} }];
    case "cash":
      return [{ name: "cash_position", arguments: {} }];
    case "tasks":
      return [{ name: "list_open_tasks", arguments: {} }];
    case "search":
      return [{ name: "search_transactions", arguments: { query: extractSearch(message) } }];
    default:
      return [{ name: "practice_overview", arguments: {} }];
  }
}

function extractSearch(message: string): string {
  const quoted = message.match(/["“](.+?)["”]/);
  if (quoted?.[1]) return quoted[1];
  const cleaned = message.replace(/\b(find|search|look up|merchant|for|the)\b/gi, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 80) || message.slice(0, 80);
}
