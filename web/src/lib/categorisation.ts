import { apiFetch } from "./api";
import type { CategorisationSuggestion } from "./reconciliation";

export interface CategorisationRules {
  merchants: Array<{ merchantName: string; categoryKey: string; ledgerCode: number; aliases?: string[] }>;
  mcc: Array<{ mcc: string; industry: string; categoryKey: string; ledgerCode: number; vatable: boolean }>;
  vat: {
    standardCode?: string;
    noVatCode?: string;
    vatableMccs?: string[];
    exemptMccs?: string[];
  };
}

export function suggestClientCategorisation(clientId: string) {
  return apiFetch<{ suggestions: CategorisationSuggestion[]; count: number }>(`/categorisation/suggest`, {
    method: "POST",
    body: JSON.stringify({ clientId, persist: true }),
  });
}

export function applyCategorisationSuggestion(input: {
  suggestionId?: string;
  bankTransactionId?: string;
  override?: { ledgerAccountId?: string; taxCodeId?: string };
}) {
  return apiFetch<{ suggestion: CategorisationSuggestion; journal?: { id: string }; alreadyApplied?: boolean }>(
    `/categorisation/apply`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function listCategorisationRules() {
  return apiFetch<CategorisationRules>(`/categorisation/rules`);
}

export { suggestCategorisation, applyCategorisation } from "./reconciliation";
