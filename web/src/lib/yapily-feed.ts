import { apiFetch } from "./api";

export function syncBankFeed(input: { clientId: string; bankAccountId?: string; autoPost?: boolean }) {
  return apiFetch<{
    steps: string[];
    journals?: { posted: number };
    matching?: { count: number; applied?: unknown[] };
    categorisation?: { count: number; applied?: unknown[] };
    enrichment?: { enriched: number };
    vat?: { boxes?: { box1: number; box4: number; box6: number; box7: number } };
  }>(`/yapily/transactions/sync`, {
    method: "POST",
    body: JSON.stringify({
      clientId: input.clientId,
      bankAccountId: input.bankAccountId,
      autoPost: Boolean(input.autoPost),
      autoMatch: true,
      autoCategorise: true,
    }),
  });
}
