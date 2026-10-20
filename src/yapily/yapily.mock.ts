import { Injectable } from "@nestjs/common";
import {
  YapilyAccount,
  YapilyAuthRequest,
  YapilyBalance,
  YapilyGateway,
  YapilyTransaction,
} from "./yapily.types";

export const MOCK_YAPILY_ACCOUNTS: YapilyAccount[] = [
  {
    id: "yapily-acc-starling-1",
    name: "Hartley Studio current account",
    sortCode: "20-45-67",
    accountNumber: "12345678",
    currency: "GBP",
    balance: 4120,
    type: "CURRENT",
  },
];

export const MOCK_YAPILY_TRANSACTIONS: YapilyTransaction[] = [
  {
    id: "yapily-txn-inv-1001",
    date: "2026-01-15",
    amount: 7200,
    type: "CREDIT",
    description: "Brighton Gallery Ltd INV-1001",
    merchantName: "Brighton Gallery Ltd",
    category: "sales",
    transactionType: "CREDIT",
  },
  {
    id: "yapily-txn-bill-88",
    date: "2026-02-10",
    amount: 1200,
    type: "DEBIT",
    description: "North Ads Agency BILL-88",
    merchantName: "North Ads Agency",
    category: "advertising",
    transactionType: "DEBIT",
  },
  {
    id: "yapily-txn-receipts",
    date: "2026-04-20",
    amount: 5000,
    type: "CREDIT",
    description: "Banked studio receipts",
    merchantName: "Brighton Gallery Ltd",
    category: "sales",
    transactionType: "CREDIT",
  },
  {
    id: "yapily-txn-fee",
    date: "2026-03-18",
    amount: 40,
    type: "DEBIT",
    description: "Unmatched bank fee",
    merchantName: "Starling",
    category: "bank_charges",
    transactionType: "DEBIT",
  },
  {
    id: "yapily-txn-ads",
    date: "2026-05-12",
    amount: 250,
    type: "DEBIT",
    description: "Advertising spend",
    merchantName: "North Ads Agency",
    category: "advertising",
    transactionType: "DEBIT",
  },
];

@Injectable()
export class MockYapilyGateway implements YapilyGateway {
  async createAuthRequest(input: {
    applicationUserId: string;
    institutionId: string;
    callback: string;
  }): Promise<YapilyAuthRequest> {
    const consentId = `mock-consent-${input.applicationUserId.slice(0, 8)}`;
    const url = new URL("https://mock-yapily.local/auth");
    url.searchParams.set("institutionId", input.institutionId);
    url.searchParams.set("applicationUserId", input.applicationUserId);
    url.searchParams.set("callback", input.callback);
    url.searchParams.set("consentId", consentId);
    return {
      authorisationUrl: url.toString(),
      consentId,
      applicationUserId: input.applicationUserId,
      institutionId: input.institutionId,
      mode: "mock",
    };
  }

  async listAccounts(_consentToken: string): Promise<YapilyAccount[]> {
    return MOCK_YAPILY_ACCOUNTS;
  }

  async listTransactions(
    _consentToken: string,
    accountId: string,
    from?: string,
    to?: string,
  ): Promise<YapilyTransaction[]> {
    return MOCK_YAPILY_TRANSACTIONS.filter((row) => {
      if (accountId && accountId !== "yapily-acc-starling-1") {
        return false;
      }
      if (from && row.date < from) {
        return false;
      }
      if (to && row.date > to) {
        return false;
      }
      return true;
    });
  }

  async getBalance(_consentToken: string, accountId: string): Promise<YapilyBalance> {
    const account = MOCK_YAPILY_ACCOUNTS.find((item) => item.id === accountId) ?? MOCK_YAPILY_ACCOUNTS[0];
    return { accountId: account.id, currency: account.currency, balance: account.balance, type: "CLOSING_AVAILABLE" };
  }
}
