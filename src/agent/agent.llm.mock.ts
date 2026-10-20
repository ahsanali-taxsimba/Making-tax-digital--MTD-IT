import { Injectable } from "@nestjs/common";
import { detectIntent, toolsForIntent } from "./agent.planner";
import { AgentChatMessage, AgentLlm, AgentLlmResult, AgentToolCall, AgentToolSpec } from "./agent.types";

@Injectable()
export class MockAgentLlm implements AgentLlm {
  readonly name = "mock";

  async complete(messages: AgentChatMessage[], _tools: AgentToolSpec[]): Promise<AgentLlmResult> {
    const lastUser = [...messages].reverse().find((row) => row.role === "user")?.content ?? "";
    const toolResults = messages.filter((row) => row.role === "tool");
    if (!toolResults.length) {
      const intent = detectIntent(lastUser);
      const calls = toolsForIntent(intent, lastUser).map((call, index) => ({
        id: `call_mock_${index}`,
        name: call.name,
        arguments: call.arguments,
      }));
      return { content: "", toolCalls: calls };
    }
    const parsed = toolResults.map((row) => ({ name: row.name ?? "tool", data: parseJson(row.content) }));
    if (parsed.some((row) => row.name === "propose_action")) {
      return {
        content: composeReply(lastUser, parsed.filter((row) => row.name !== "propose_action")),
        toolCalls: [],
      };
    }
    return {
      content: composeReply(lastUser, parsed),
      toolCalls: proposeCalls(parsed),
    };
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function proposeCalls(results: Array<{ name: string; data: unknown }>): AgentToolCall[] {
  const calls: AgentToolCall[] = [];
  for (const row of results) {
    if (row.name === "suggest_categories") {
      const suggestions = asArray(pick(row.data, "suggestions"));
      suggestions.slice(0, 5).forEach((item, index) => {
        const suggestion = item as Record<string, unknown>;
        const ledger = (suggestion.suggestedLedger as Record<string, unknown> | undefined) ?? {};
        calls.push({
          id: `call_propose_cat_${index}`,
          name: "propose_action",
          arguments: {
            kind: "APPLY_CATEGORY",
            title: `Code ${String(suggestion.merchantName ?? suggestion.bankTransactionId ?? "bank line")}`,
            summary: `Post ${String(ledger.code ?? "")} ${String(ledger.name ?? "suggested ledger")} at ${Math.round(Number(suggestion.confidence ?? 0) * 100)}% confidence.`,
            clientId: suggestion.clientId,
            payload: JSON.stringify({
              suggestionId: suggestion.id,
              bankTransactionId: suggestion.bankTransactionId,
            }),
          },
        });
      });
    }
    if (row.name === "list_unmatched_bank") {
      const suggestions = asArray(pick(row.data, "matches") ?? pick(row.data, "suggestions"));
      suggestions.slice(0, 5).forEach((item, index) => {
        const suggestion = item as Record<string, unknown>;
        calls.push({
          id: `call_propose_match_${index}`,
          name: "propose_action",
          arguments: {
            kind: "APPLY_MATCH",
            title: `Match ${String(suggestion.description ?? suggestion.bankTransactionId ?? "bank line")}`,
            summary: `Settle against ${String(suggestion.documentReference ?? suggestion.partyName ?? "the suggested document")}.`,
            clientId: suggestion.clientId,
            payload: JSON.stringify({
              suggestionId: suggestion.id,
              bankTransactionId: suggestion.bankTransactionId,
            }),
          },
        });
      });
    }
  }
  return calls;
}

function composeReply(question: string, results: Array<{ name: string; data: unknown }>): string {
  const overview = results.find((row) => row.name === "practice_overview")?.data as Record<string, unknown> | undefined;
  if (overview) {
    return [
      "Here is what needs attention across the practice:",
      `• ${Number(overview.unmatchedBank ?? 0)} unmatched bank lines`,
      `• ${Number(overview.overdueInvoices ?? 0)} overdue sales invoices`,
      `• ${Number(overview.openVat ?? 0)} open VAT obligations`,
      `• ${Number(overview.openItsa ?? 0)} open ITSA obligations`,
      `• ${Number(overview.openTasks ?? 0)} open tasks`,
      "Ask me to categorise the bank, match invoices, or walk through VAT and I will queue confirmable actions — nothing posts until you apply it.",
    ].join("\n");
  }
  const categories = results.find((row) => row.name === "suggest_categories")?.data as { suggestions?: unknown[] } | undefined;
  if (categories?.suggestions?.length) {
    return `I have coded ${categories.suggestions.length} unmatched bank line(s). Review the suggested ledger, VAT rate and ITSA bucket, then apply each card to post a draft journal.`;
  }
  const uncategorised = results.find((row) => row.name === "list_uncategorised_bank")?.data as { transactions?: unknown[] } | undefined;
  if (uncategorised?.transactions) {
    if (!uncategorised.transactions.length) return "Every unmatched bank line already has a posted category.";
    return `There are ${uncategorised.transactions.length} uncategorised bank line(s). I can queue ledger/VAT/ITSA cards for you to confirm.`;
  }
  const unmatched = results.find((row) => row.name === "list_unmatched_bank")?.data as { unmatched?: unknown[]; matches?: unknown[] } | undefined;
  if (unmatched) {
    return `There are ${Number((unmatched.unmatched ?? unmatched.matches ?? []).length)} unmatched bank line(s). Match cards settle the line against a sales invoice or purchase bill.`;
  }
  const invoices = results.find((row) => row.name === "list_overdue_invoices")?.data as { invoices?: Array<Record<string, unknown>> } | undefined;
  if (invoices) {
    if (!invoices.invoices?.length) return "No overdue posted sales invoices on this firm.";
    const lines = invoices.invoices.slice(0, 8).map((row) => `• ${row.clientName} — ${row.customerName ?? "customer"} due ${row.dueDate} (${gbp(Number(row.grossTotalPence ?? 0))})`);
    return `Overdue sales invoices:\n${lines.join("\n")}`;
  }
  const vat = results.find((row) => row.name === "vat_position")?.data as { obligations?: Array<Record<string, unknown>> } | undefined;
  if (vat) {
    if (!vat.obligations?.length) return "No open VAT obligations.";
    const lines = vat.obligations.slice(0, 8).map((row) => `• ${row.clientName} period ${row.periodKey} due ${row.due}`);
    return `Open VAT obligations:\n${lines.join("\n")}\nI cannot submit to HMRC from chat — use the VAT workspace once the digital-link evidence is in place.`;
  }
  const itsa = results.find((row) => row.name === "itsa_position")?.data as { obligations?: Array<Record<string, unknown>> } | undefined;
  if (itsa) {
    if (!itsa.obligations?.length) return "No open ITSA obligations.";
    const lines = itsa.obligations.slice(0, 8).map((row) => `• ${row.clientName} ${row.type} ${row.taxYear} due ${row.due}`);
    return `Open ITSA obligations:\n${lines.join("\n")}`;
  }
  const cash = results.find((row) => row.name === "cash_position")?.data as { accounts?: Array<Record<string, unknown>> } | undefined;
  if (cash) {
    if (!cash.accounts?.length) return "No bank accounts on this firm yet.";
    const lines = cash.accounts.map((row) => `• ${row.clientName} / ${row.name}: ${gbp(Number(row.balancePence ?? 0))}`);
    return `Cash in the bank:\n${lines.join("\n")}`;
  }
  const tasks = results.find((row) => row.name === "list_open_tasks")?.data as { tasks?: Array<Record<string, unknown>> } | undefined;
  if (tasks) {
    if (!tasks.tasks?.length) return "No open practice tasks.";
    const lines = tasks.tasks.slice(0, 8).map((row) => `• ${row.clientName} — ${row.title} (${row.status})`);
    return `Open tasks:\n${lines.join("\n")}`;
  }
  const search = results.find((row) => row.name === "search_transactions")?.data as { transactions?: Array<Record<string, unknown>> } | undefined;
  if (search) {
    if (!search.transactions?.length) return `No bank lines matched “${question.trim()}”.`;
    const lines = search.transactions.slice(0, 8).map((row) => `• ${row.clientName} ${row.merchantName ?? row.description} ${gbp(Number(row.amountPence ?? 0))}`);
    return `Matching bank lines:\n${lines.join("\n")}`;
  }
  return `I looked across the ledger for “${question.trim()}”. Ask about categorisation, invoice matching, VAT, ITSA, cash or overdue invoices and I will pull the live figures for this firm only.`;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pick(data: unknown, key: string): unknown {
  if (data && typeof data === "object" && key in (data as Record<string, unknown>)) {
    return (data as Record<string, unknown>)[key];
  }
  return undefined;
}

function gbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}
