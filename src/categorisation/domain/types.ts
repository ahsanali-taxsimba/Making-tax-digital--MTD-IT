import { ChartProfile, TaxCodeKind } from "@prisma/client";
import { LedgerSnapshot, TaxCodeSnapshot } from "../../bookkeeping/domain/journal.rules";
import { MatchableDocument } from "../../yapily/domain/invoice-match";

export type CategoryKey =
  | "fuel"
  | "groceries"
  | "restaurants"
  | "advertising"
  | "bank_charges"
  | "sales"
  | "subscriptions"
  | "travel"
  | "insurance"
  | "professional"
  | "telecom"
  | "software"
  | "office"
  | "rent"
  | "utilities"
  | "entertainment"
  | "wages";

export type TransactionDirection = "CREDIT" | "DEBIT";

export interface MerchantRule {
  merchantKey: string;
  merchantName: string;
  aliases: string[];
  categoryKey: CategoryKey;
  ledgerCode: number;
  taxCodeKind: TaxCodeKind;
  itsaCategory?: string | null;
  confidence: number;
}

export interface MccRule {
  mcc: string;
  industry: string;
  categoryKey: CategoryKey;
  ledgerCode: number;
  taxCodeKind: TaxCodeKind;
  vatable: boolean;
  itsaCategory?: string | null;
  confidence: number;
}

export interface ClassifyInput {
  date: Date | string;
  amount: number;
  type: TransactionDirection;
  description: string;
  merchantName?: string | null;
  merchantCategoryCode?: string | null;
  transactionCategory?: string | null;
  category?: string | null;
  location?: string | null;
  labels?: string[];
}

export interface ClassifyContext {
  profile: ChartProfile;
  ledgers: LedgerSnapshot[];
  taxCodes: TaxCodeSnapshot[];
  siblings?: Array<{ merchantName?: string | null; amount: number; description: string }>;
  documents?: MatchableDocument[];
  merchantRules: MerchantRule[];
  mccRules: MccRule[];
}

export interface ClassifySignal {
  name: string;
  ledgerCode: number;
  categoryKey?: CategoryKey;
  taxCodeKind?: TaxCodeKind;
  confidence: number;
  detail?: string;
}

export interface SuggestedJournalLine {
  ledgerAccountId: string;
  ledgerCode: number;
  ledgerName: string;
  debit: number;
  credit: number;
  taxCodeId?: string | null;
  taxCode?: string | null;
  description?: string;
}

export interface SuggestedJournal {
  date: string;
  description: string;
  source: "BANK_FEED";
  reference?: string;
  lines: SuggestedJournalLine[];
}

export interface Classification {
  ledgerCode: number;
  ledgerAccountId: string | null;
  ledgerName: string;
  taxCodeKind: TaxCodeKind;
  taxCodeId: string | null;
  taxCode: string | null;
  taxRate: number;
  itsaCategory: string | null;
  itsaBucket: string | null;
  itsaHmrcKey: string | null;
  includedInQuarterlyUpdate: boolean | null;
  vatBoxes: string[];
  confidence: number;
  reasons: string[];
  draftJournal: SuggestedJournal;
}
