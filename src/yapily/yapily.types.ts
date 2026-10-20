export interface YapilyAuthRequest {
  authorisationUrl: string;
  consentId: string;
  applicationUserId: string;
  institutionId: string;
  mode: "mock" | "live";
}

export interface YapilyAccount {
  id: string;
  name: string;
  sortCode?: string | null;
  accountNumber?: string | null;
  currency: string;
  balance: number;
  type?: string;
}

export interface YapilyTransaction {
  id: string;
  date: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  description: string;
  merchantName?: string | null;
  category?: string | null;
  merchantCategoryCode?: string | null;
  transactionCategory?: string | null;
  location?: string | null;
  labels?: string[];
  enrichment?: Record<string, unknown> | null;
  transactionType?: string | null;
}

export interface YapilyBalance {
  accountId: string;
  currency: string;
  balance: number;
  type?: string;
}

export interface YapilyGateway {
  createAuthRequest(input: {
    applicationUserId: string;
    institutionId: string;
    callback: string;
  }): Promise<YapilyAuthRequest>;
  listAccounts(consentToken: string): Promise<YapilyAccount[]>;
  listTransactions(
    consentToken: string,
    accountId: string,
    from?: string,
    to?: string,
  ): Promise<YapilyTransaction[]>;
  getBalance(consentToken: string, accountId: string): Promise<YapilyBalance>;
}
