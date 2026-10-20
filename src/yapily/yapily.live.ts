import { Injectable } from "@nestjs/common";
import { YapilyHttpClient } from "./yapily.http";
import {
  YapilyAccount,
  YapilyAuthRequest,
  YapilyBalance,
  YapilyGateway,
  YapilyTransaction,
} from "./yapily.types";

@Injectable()
export class LiveYapilyGateway implements YapilyGateway {
  constructor(private readonly http: YapilyHttpClient) {}

  async createAuthRequest(input: {
    applicationUserId: string;
    institutionId: string;
    callback: string;
  }): Promise<YapilyAuthRequest> {
    const body = await this.http.request<{
      data?: { id?: string; authorisationUrl?: string; institutionId?: string; applicationUserId?: string };
    }>("/account-auth-requests", {
      method: "POST",
      body: JSON.stringify({
        applicationUserId: input.applicationUserId,
        institutionId: input.institutionId,
        callback: input.callback,
      }),
    });
    const data = body.data ?? {};
    return {
      authorisationUrl: data.authorisationUrl ?? "",
      consentId: data.id ?? "",
      applicationUserId: data.applicationUserId ?? input.applicationUserId,
      institutionId: data.institutionId ?? input.institutionId,
      mode: "live",
    };
  }

  async listAccounts(consentToken: string): Promise<YapilyAccount[]> {
    const body = await this.http.request<{ data?: RawAccount[] }>("/accounts", { consentToken });
    return (body.data ?? []).map(mapAccount);
  }

  async listTransactions(
    consentToken: string,
    accountId: string,
    from?: string,
    to?: string,
  ): Promise<YapilyTransaction[]> {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("before", to);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const body = await this.http.request<{ data?: RawTransaction[] }>(`/accounts/${accountId}/transactions${suffix}`, {
      consentToken,
    });
    return (body.data ?? []).map(mapTransaction);
  }

  async getBalance(consentToken: string, accountId: string): Promise<YapilyBalance> {
    const body = await this.http.request<{ data?: RawBalance[] }>(`/accounts/${accountId}/balances`, { consentToken });
    const preferred =
      body.data?.find((row) => row.type === "CLOSING_AVAILABLE" || row.type === "INTERIM_AVAILABLE") ?? body.data?.[0];
    return {
      accountId,
      currency: preferred?.balanceAmount?.currency ?? "GBP",
      balance: Number(preferred?.balanceAmount?.amount ?? 0),
      type: preferred?.type,
    };
  }
}

interface RawAccount {
  id?: string;
  accountId?: string;
  type?: string;
  currency?: string;
  nickname?: string;
  accountNames?: Array<{ name?: string }>;
  accountIdentifications?: Array<{ type?: string; identification?: string }>;
  accountBalances?: Array<{ balanceAmount?: { amount?: number; currency?: string }; type?: string }>;
}

interface RawTransaction {
  id?: string;
  bookingDateTime?: string;
  valueDateTime?: string;
  amount?: number;
  currency?: string;
  status?: string;
  transactionInformation?: string;
  description?: string;
  proprietaryBankTransactionCode?: { issuer?: string; code?: string };
  enrichment?: {
    merchant?: { merchantName?: string; name?: string; merchantCategoryCode?: string };
    transaction?: { transactionCategory?: string };
    location?: { town?: string; city?: string; country?: string };
    labels?: string[];
  };
}

interface RawBalance {
  type?: string;
  balanceAmount?: { amount?: number; currency?: string };
}

function mapAccount(row: RawAccount): YapilyAccount {
  const ids = row.accountIdentifications ?? [];
  const sort = ids.find((item) => /SORT/i.test(item.type ?? ""))?.identification;
  const number = ids.find((item) => /ACCOUNT_NUMBER|ACC/i.test(item.type ?? ""))?.identification;
  const balance = row.accountBalances?.[0]?.balanceAmount;
  return {
    id: row.id ?? row.accountId ?? "",
    name: row.accountNames?.[0]?.name ?? row.nickname ?? "Current account",
    sortCode: sort ? formatSortCode(sort) : null,
    accountNumber: number ?? null,
    currency: row.currency ?? balance?.currency ?? "GBP",
    balance: Number(balance?.amount ?? 0),
    type: row.type,
  };
}

function mapTransaction(row: RawTransaction): YapilyTransaction {
  const amount = Number(row.amount ?? 0);
  const type: "CREDIT" | "DEBIT" = amount < 0 ? "DEBIT" : "CREDIT";
  const location = [row.enrichment?.location?.town, row.enrichment?.location?.city, row.enrichment?.location?.country]
    .filter(Boolean)
    .join(", ");
  return {
    id: row.id ?? "",
    date: (row.bookingDateTime ?? row.valueDateTime ?? new Date().toISOString()).slice(0, 10),
    amount: Math.abs(amount),
    type,
    description: row.description ?? row.transactionInformation ?? "Bank transaction",
    merchantName: row.enrichment?.merchant?.merchantName ?? row.enrichment?.merchant?.name ?? null,
    category: row.enrichment?.transaction?.transactionCategory ?? row.proprietaryBankTransactionCode?.code ?? null,
    merchantCategoryCode: row.enrichment?.merchant?.merchantCategoryCode ?? null,
    transactionCategory: row.enrichment?.transaction?.transactionCategory ?? null,
    location: location || null,
    labels: row.enrichment?.labels ?? [],
    enrichment: row.enrichment ?? null,
    transactionType: type,
  };
}

function formatSortCode(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 6) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  }
  return value;
}
