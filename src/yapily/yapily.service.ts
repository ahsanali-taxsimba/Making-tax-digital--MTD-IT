import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BankTxnStatus, JournalSource, Prisma, YapilyConsentStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { BookkeepingRepository } from "../bookkeeping/bookkeeping.repository";
import { defaultProfileForClientType } from "../ledger/chart-of-accounts.catalog";
import { BankService } from "../bookkeeping/bank.service";
import { JournalService } from "../bookkeeping/journal.service";
import { ClientsService } from "../clients/clients.service";
import { TokenCryptoService } from "../common/crypto/token-crypto.service";
import { AuthUser } from "../common/types";
import { controlCodes, requireAccount, bankPaymentLines, bankReceiptLines } from "../bookkeeping/domain/posting";
import { LedgerSnapshot } from "../bookkeeping/domain/journal.rules";
import { parseDate } from "../bookkeeping/domain/money";
import { enrichBankLine } from "./domain/enrichment";
import { MatchableDocument, suggestDocumentMatch } from "./domain/invoice-match";
import { YAPILY_ERR, YapilyError } from "./yapily.errors";
import { YapilyRepository } from "./yapily.repository";
import { YAPILY_GATEWAY } from "./yapily.tokens";
import { YapilyGateway } from "./yapily.types";

@Injectable()
export class YapilyService {
  constructor(
    private readonly repo: YapilyRepository,
    private readonly clients: ClientsService,
    private readonly crypto: TokenCryptoService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly books: BookkeepingRepository,
    private readonly journals: JournalService,
    private readonly bank: BankService,
    @Inject(YAPILY_GATEWAY) private readonly gateway: YapilyGateway,
  ) {}

  async startConsent(
    user: AuthUser,
    input: { clientId: string; institutionId?: string; callback?: string },
  ) {
    const client = await this.clients.get(user, input.clientId);
    const institutionId = input.institutionId || this.config.get<string>("yapily.defaultInstitution") || "modelo-sandbox";
    const callback = input.callback || this.config.get<string>("yapily.callbackUrl") || "http://localhost:3000/yapily/consent/callback";
    const applicationUserId = `${client.firmId}:${client.id}`;
    const started = await this.gateway.createAuthRequest({ applicationUserId, institutionId, callback });
    const connection = await this.repo.upsertConnection({
      clientId: client.id,
      institutionId,
      applicationUserId,
      consentId: started.consentId,
      status: YapilyConsentStatus.PENDING,
    });
    const authorizationUrl = this.appendState(started.authorisationUrl, connection.id, client.id, institutionId);
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "yapily.consent.started",
      metadata: { institutionId, consentId: started.consentId, mode: started.mode },
    });
    return {
      authorizationUrl,
      redirectUrl: authorizationUrl,
      consentId: started.consentId,
      institutionId,
      clientId: client.id,
      mode: started.mode,
    };
  }

  async handleCallback(query: {
    consent?: string;
    clientId?: string;
    institutionId?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }) {
    if (query.error) {
      throw new YapilyError(YAPILY_ERR.CONSENT_FAILED, query.error_description || query.error);
    }
    const connection = query.state
      ? await this.repo.findConnectionById(query.state)
      : query.clientId
        ? await this.repo.findConnection(query.clientId, query.institutionId)
        : null;
    if (!connection) {
      throw new YapilyError(YAPILY_ERR.CONSENT_MISSING, "Yapily consent was not found for this callback");
    }
    const token = query.consent || (this.isMock() ? `mock-consent-${connection.id}` : "");
    if (!token) {
      throw new YapilyError(YAPILY_ERR.CONSENT_FAILED, "Yapily did not return a consent token");
    }
    const updated = await this.repo.upsertConnection({
      clientId: connection.clientId,
      institutionId: connection.institutionId,
      applicationUserId: connection.applicationUserId ?? undefined,
      consentId: connection.consentId ?? undefined,
      consentTokenEnc: this.crypto.encrypt(token),
      status: YapilyConsentStatus.AUTHORISED,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });
    await this.audit.record({
      clientId: connection.clientId,
      actionType: "yapily.consent.authorised",
      metadata: { institutionId: connection.institutionId },
    });
    return this.publicConnection(updated);
  }

  async status(user: AuthUser, clientId: string) {
    await this.clients.get(user, clientId);
    const connection = await this.repo.findConnection(clientId);
    if (!connection) {
      return { connected: false, clientId, status: "MISSING" };
    }
    const expired = connection.expiresAt && connection.expiresAt.getTime() < Date.now();
    return {
      ...this.publicConnection(connection),
      connected: connection.status === YapilyConsentStatus.AUTHORISED && !expired,
      expired: Boolean(expired),
    };
  }

  async syncAccounts(user: AuthUser, clientId: string) {
    const client = await this.clients.get(user, clientId);
    const token = await this.requireToken(client.id);
    const remote = await this.gateway.listAccounts(token);
    const saved = [];
    for (const account of remote) {
      const existing =
        (await this.repo.findBankAccount(client.id, account.id)) ??
        (await this.repo.findBankAccountByNumbers(client.id, account.sortCode, account.accountNumber));
      const data = {
        name: account.name,
        sortCode: account.sortCode,
        accountNumber: account.accountNumber,
        provider: "yapily",
        externalId: account.id,
        currency: account.currency,
        balance: account.balance,
      };
      saved.push(
        existing
          ? await this.repo.updateBankAccount(existing.id, data)
          : await this.repo.createBankAccount({
              firm: { connect: { id: client.firmId } },
              client: { connect: { id: client.id } },
              ...data,
            }),
      );
    }
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "yapily.accounts.synced",
      metadata: { count: saved.length },
    });
    return saved.map(this.publicAccount);
  }

  async syncTransactions(
    user: AuthUser,
    bankAccountId: string,
    query: { from?: string; to?: string; autoPost?: boolean },
  ) {
    const account = await this.requireYapilyAccount(user, bankAccountId);
    const token = await this.requireToken(account.clientId);
    const remote = await this.gateway.listTransactions(token, account.externalId ?? account.id, query.from, query.to);
    const rows = [];
    for (const item of remote) {
      const enriched = enrichBankLine(item);
      const existing = item.id ? await this.repo.findTransaction(account.id, item.id) : null;
      const payload = {
        date: parseDate(item.date),
        amount: item.amount,
        type: item.type,
        description: item.description,
        externalRef: item.id,
        merchantName: enriched.merchantName,
        category: enriched.category,
        merchantCategoryCode: item.merchantCategoryCode ?? null,
        transactionCategory: item.transactionCategory ?? enriched.category,
        location: item.location ?? null,
        labels: item.labels ?? [],
        enrichment: {
          merchantName: enriched.merchantName,
          category: enriched.category,
          merchantCategoryCode: item.merchantCategoryCode ?? null,
          transactionCategory: item.transactionCategory ?? null,
          location: item.location ?? null,
          labels: item.labels ?? [],
          vatHint: enriched.vatHint,
          itsaBucket: enriched.itsaBucket,
          raw: item.enrichment ?? null,
        } as Prisma.InputJsonValue,
      };
      rows.push(
        existing
          ? await this.repo.updateTransaction(existing.id, payload)
          : await this.repo.createTransaction({
              bankAccount: { connect: { id: account.id } },
              ...payload,
            }),
      );
    }

    let posted = 0;
    let matched = 0;
    if (query.autoPost) {
      const result = await this.autoPost(user, account.id);
      posted = result.posted;
      matched = result.matched;
      const refreshed = await this.repo.listTransactions(
        account.id,
        query.from ? parseDate(query.from) : undefined,
        query.to ? parseDate(query.to) : undefined,
      );
      rows.splice(0, rows.length, ...refreshed);
    }

    const reconciliation = await this.bank.transactions(user, account.id);
    await this.audit.record({
      actor: user,
      clientId: account.clientId,
      actionType: "yapily.transactions.synced",
      metadata: { bankAccountId: account.id, count: rows.length, autoPost: Boolean(query.autoPost), posted, matched },
    });
    return {
      account: this.publicAccount(account),
      transactions: rows.map(this.publicTransaction),
      suggestions: reconciliation.suggestions,
      autoPost: query.autoPost ? { posted, matched } : undefined,
    };
  }

  async syncBalance(user: AuthUser, bankAccountId: string) {
    const account = await this.requireYapilyAccount(user, bankAccountId);
    const token = await this.requireToken(account.clientId);
    const remote = await this.gateway.getBalance(token, account.externalId ?? account.id);
    const updated = await this.repo.updateBankAccount(account.id, {
      balance: remote.balance,
      currency: remote.currency,
    });
    await this.audit.record({
      actor: user,
      clientId: account.clientId,
      actionType: "yapily.balance.synced",
      metadata: { bankAccountId: account.id, balance: remote.balance },
    });
    return { ...this.publicAccount(updated), balanceType: remote.type };
  }

  async reconciliation(user: AuthUser, bankAccountId: string) {
    const account = await this.requireYapilyAccount(user, bankAccountId);
    const feed = await this.bank.transactions(user, account.id);
    return {
      account: this.publicAccount(account),
      unmatched: feed.transactions.filter((row) => String(row.status).toUpperCase() === "UNMATCHED"),
      suggestions: feed.suggestions,
    };
  }

  private async autoPost(user: AuthUser, bankAccountId: string) {
    const account = await this.requireYapilyAccount(user, bankAccountId);
    const client = await this.clients.get(user, account.clientId);
    const [open, invoices, bills, ledgers] = await Promise.all([
      this.repo.listTransactions(account.id),
      this.books.listInvoices(client.id),
      this.books.listBills(client.id),
      this.books.listLedgers(client.id),
    ]);
    const documents: MatchableDocument[] = [
      ...invoices.map((row) => ({
        id: row.id,
        kind: "invoice" as const,
        date: row.date,
        description: row.customer?.name ?? "Sales invoice",
        reference: row.id,
        grossTotal: Number(row.grossTotal),
        journalId: row.journalId,
      })),
      ...bills.map((row) => ({
        id: row.id,
        kind: "bill" as const,
        date: row.date,
        description: row.supplier?.name ?? "Purchase bill",
        reference: row.id,
        grossTotal: Number(row.grossTotal),
        journalId: row.journalId,
      })),
    ];
    const profile = defaultProfileForClientType(client.type);
    const bankLedger = account.ledgerId
      ? (ledgers.find((item) => item.id === account.ledgerId) as LedgerSnapshot | undefined)
      : requireAccount(ledgers as LedgerSnapshot[], controlCodes(profile).bank, profile);
    if (!bankLedger) {
      throw new YapilyError(YAPILY_ERR.ACCOUNT_NOT_FOUND, "Bank ledger account is missing");
    }
    const income = requireAccount(ledgers as LedgerSnapshot[], controlCodes(profile).defaultIncome, profile);
    const expense = requireAccount(ledgers as LedgerSnapshot[], controlCodes(profile).defaultExpense, profile);
    let posted = 0;
    let matched = 0;
    for (const txn of open.filter((row) => row.status === BankTxnStatus.UNMATCHED)) {
      const document = suggestDocumentMatch(
        {
          date: txn.date,
          amount: Number(txn.amount),
          type: txn.type,
          description: txn.description,
          merchantName: txn.merchantName,
        },
        documents,
      );
      if (document?.journalId) {
        await this.repo.updateTransaction(txn.id, {
          matchedJournal: { connect: { id: document.journalId } },
          status: BankTxnStatus.MATCHED,
        });
        matched += 1;
        continue;
      }
      const counterpart = txn.type === "CREDIT" ? income : expense;
      const lines =
        txn.type === "CREDIT"
          ? bankReceiptLines(bankLedger, counterpart, Number(txn.amount), txn.description)
          : bankPaymentLines(bankLedger, counterpart, Number(txn.amount), txn.description);
      const journal = await this.journals.post(user, {
        clientId: client.id,
        firmId: client.firmId,
        date: txn.date.toISOString().slice(0, 10),
        description: txn.description,
        source: JournalSource.BANK_FEED,
        lines,
        profile,
      });
      await this.repo.updateTransaction(txn.id, {
        matchedJournal: { connect: { id: journal.id } },
        status: BankTxnStatus.MATCHED,
      });
      posted += 1;
    }
    return { posted, matched };
  }

  private async requireYapilyAccount(user: AuthUser, id: string) {
    const account = await this.repo.findBankAccountById(id);
    if (!account) {
      throw new NotFoundException("Bank account not found");
    }
    await this.clients.get(user, account.clientId);
    return account;
  }

  private async requireToken(clientId: string): Promise<string> {
    const connection = await this.repo.findConnection(clientId);
    if (!connection || connection.status !== YapilyConsentStatus.AUTHORISED || !connection.consentTokenEnc) {
      throw new YapilyError(YAPILY_ERR.CONSENT_MISSING, "Client is not connected to Yapily");
    }
    if (connection.expiresAt && connection.expiresAt.getTime() < Date.now()) {
      await this.repo.upsertConnection({
        clientId: connection.clientId,
        institutionId: connection.institutionId,
        status: YapilyConsentStatus.EXPIRED,
        consentTokenEnc: connection.consentTokenEnc,
      });
      throw new YapilyError(YAPILY_ERR.CONSENT_EXPIRED, "Yapily consent has expired");
    }
    return this.crypto.decrypt(connection.consentTokenEnc);
  }

  private publicConnection(connection: {
    id: string;
    clientId: string;
    institutionId: string;
    status: YapilyConsentStatus;
    expiresAt: Date | null;
    consentId?: string | null;
    createdAt: Date;
    updatedAt: Date;
    consentTokenEnc?: string | null;
  }) {
    return {
      id: connection.id,
      clientId: connection.clientId,
      institutionId: connection.institutionId,
      status: connection.status,
      expiresAt: connection.expiresAt,
      consentId: connection.consentId ?? null,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }

  private publicAccount(account: {
    id: string;
    clientId: string;
    name: string;
    sortCode?: string | null;
    accountNumber?: string | null;
    provider?: string | null;
    externalId?: string | null;
    currency?: string | null;
    balance?: unknown;
    createdAt: Date;
    updatedAt?: Date;
  }) {
    return {
      id: account.id,
      clientId: account.clientId,
      provider: account.provider ?? "yapily",
      externalAccountId: account.externalId,
      name: account.name,
      sortCode: account.sortCode,
      accountNumber: account.accountNumber,
      currency: account.currency ?? "GBP",
      balance: Number(account.balance ?? 0),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private publicTransaction(row: {
    id: string;
    bankAccountId: string;
    date: Date;
    amount: unknown;
    type: string;
    description: string;
    externalRef?: string | null;
    merchantName?: string | null;
    category?: string | null;
    merchantCategoryCode?: string | null;
    transactionCategory?: string | null;
    location?: string | null;
    labels?: string[];
    enrichment?: unknown;
    status: string;
    matchedJournalEntryId?: string | null;
    createdAt: Date;
    updatedAt?: Date;
  }) {
    return {
      id: row.id,
      bankAccountId: row.bankAccountId,
      externalTransactionId: row.externalRef,
      date: row.date,
      amount: Number(row.amount),
      type: row.type.toLowerCase() === "credit" ? "credit" : "debit",
      description: row.description,
      merchantName: row.merchantName ?? null,
      category: row.category ?? null,
      merchantCategoryCode: row.merchantCategoryCode ?? null,
      transactionCategory: row.transactionCategory ?? null,
      location: row.location ?? null,
      labels: row.labels ?? [],
      enrichment: row.enrichment ?? null,
      status: row.status.toLowerCase(),
      matchedJournalEntryId: row.matchedJournalEntryId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private appendState(url: string, state: string, clientId: string, institutionId: string): string {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set("state", state);
      parsed.searchParams.set("clientId", clientId);
      parsed.searchParams.set("institutionId", institutionId);
      return parsed.toString();
    } catch {
      return url;
    }
  }

  private isMock(): boolean {
    return this.config.get<string>("yapily.mode") !== "live";
  }
}
