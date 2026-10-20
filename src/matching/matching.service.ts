import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BankTxnStatus, ClientType, MatchingDocumentKind, MatchingStatus, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { BillLookupService } from "./bill-lookup.service";
import { ConfidenceScoringService } from "./confidence-scoring.service";
import { BankMatchTxn, MatchableDocument, MIN_SUGGEST_CONFIDENCE, ScoredDocumentMatch, SiblingTxn } from "./domain/types";
import { MatchingApplyDto, MatchingRejectDto, MatchingSuggestionsQueryDto } from "./dto/matching.dto";
import { InvoiceLookupService } from "./invoice-lookup.service";
import { JournalPostingService } from "./journal-posting.service";
import { MATCH_ERR, MatchingError } from "./matching.errors";
import { MatchingRepository } from "./matching.repository";

type LoadedTxn = {
  id: string;
  date: Date;
  amount: unknown;
  type: "CREDIT" | "DEBIT";
  description: string;
  merchantName?: string | null;
  merchantCategoryCode?: string | null;
  status: BankTxnStatus;
  bankAccount: { id: string; clientId: string; ledgerId?: string | null };
  matching?: { id: string; status: MatchingStatus; journalEntryId?: string | null } | null;
};

@Injectable()
export class MatchingService {
  constructor(
    private readonly repo: MatchingRepository,
    private readonly clients: ClientsService,
    private readonly invoices: InvoiceLookupService,
    private readonly bills: BillLookupService,
    private readonly scoring: ConfidenceScoringService,
    private readonly posting: JournalPostingService,
    private readonly audit: AuditService,
  ) {}

  async suggestions(user: AuthUser, query: MatchingSuggestionsQueryDto) {
    const persist = query.persist !== false;
    const minConfidence = query.minConfidence ?? MIN_SUGGEST_CONFIDENCE;
    const targets = await this.resolveTargets(user, query);
    const suggestions = [];
    for (const target of targets) {
      if (target.txn.status !== BankTxnStatus.UNMATCHED) {
        continue;
      }
      if (target.txn.matching?.status === MatchingStatus.REJECTED || target.txn.matching?.status === MatchingStatus.APPLIED) {
        continue;
      }
      const scored = this.scoring.best(this.toTxn(target.txn), target.documents, target.siblings, minConfidence);
      if (!scored) {
        continue;
      }
      const saved = persist
        ? await this.repo.upsertSuggestion({
            bankTransactionId: target.txn.id,
            clientId: target.client.id,
            firmId: target.client.firmId,
            documentKind: scored.kind as MatchingDocumentKind,
            documentId: scored.documentId,
            documentReference: scored.documentReference,
            partyName: scored.partyName,
            amountGap: scored.signals.amountGap,
            dateGapDays: scored.signals.dateGapDays,
            confidence: scored.confidence,
            reasons: scored.reasons as Prisma.InputJsonValue,
            signals: scored.signals as unknown as Prisma.InputJsonValue,
          })
        : null;
      suggestions.push(
        this.publicSuggestion(
          saved?.id ?? target.txn.matching?.id ?? null,
          target.txn,
          target.client.id,
          scored,
          saved?.status ?? "SUGGESTED",
          saved?.journalEntryId ?? null,
        ),
      );
    }
    if (persist && suggestions.length) {
      await this.audit.record({
        actor: user,
        clientId: targets[0]?.client.id,
        actionType: "matching.suggested",
        metadata: {
          count: suggestions.length,
          clientId: query.clientId,
          bankAccountId: query.bankAccountId,
          bankTransactionId: query.bankTransactionId,
        },
      });
    }
    return { suggestions, count: suggestions.length };
  }

  async apply(user: AuthUser, dto: MatchingApplyDto) {
    if (!dto.suggestionId && !dto.bankTransactionId) {
      throw new BadRequestException("suggestionId or bankTransactionId is required");
    }
    const existing = dto.suggestionId
      ? await this.repo.findSuggestion(dto.suggestionId)
      : await this.repo.findSuggestionByTransaction(dto.bankTransactionId!);
    const txn = (existing?.bankTransaction ??
      (dto.bankTransactionId ? await this.repo.findTransaction(dto.bankTransactionId) : null)) as LoadedTxn | null;
    if (!txn) {
      throw new MatchingError(MATCH_ERR.TRANSACTION_NOT_FOUND, "Bank transaction not found", undefined, 404);
    }
    const client = await this.clients.get(user, txn.bankAccount.clientId);
    if (existing?.status === MatchingStatus.APPLIED && existing.journalEntryId) {
      return {
        suggestion: this.publicSuggestion(existing.id, txn, client.id, this.scoredFromRow(existing), "APPLIED", existing.journalEntryId),
        journalId: existing.journalEntryId,
        alreadyApplied: true,
      };
    }
    if (txn.status === BankTxnStatus.MATCHED && txn.bankAccount) {
      if (existing?.journalEntryId) {
        return {
          suggestion: this.publicSuggestion(existing.id, txn, client.id, this.scoredFromRow(existing), "APPLIED", existing.journalEntryId),
          journalId: existing.journalEntryId,
          alreadyApplied: true,
        };
      }
      throw new MatchingError(MATCH_ERR.ALREADY_MATCHED, "Bank transaction is already matched to a journal");
    }

    const document = await this.resolveDocument(client.id, dto, existing);
    if (!document) {
      throw new MatchingError(MATCH_ERR.DOCUMENT_NOT_FOUND, "Invoice or bill was not found", undefined, 404);
    }
    const expected = txn.type === "CREDIT" ? "invoice" : "bill";
    if (document.kind !== expected) {
      throw new MatchingError(MATCH_ERR.KIND_MISMATCH, `A ${txn.type} bank line can only match a ${expected}`);
    }

    const siblings = (await this.repo.listTransactionsForAccount(txn.bankAccount.id)).map((row) => this.toSibling(row as LoadedTxn));
    const scored =
      this.scoring.score(this.toTxn(txn), document, siblings) ??
      ({
        documentId: document.id,
        kind: document.kind,
        journalId: document.journalId ?? null,
        documentReference: document.reference ?? null,
        partyName: document.partyName ?? null,
        confidence: 0,
        reasons: ["manual"],
        signals: {
          exactAmount: false,
          amountTolerance: false,
          amountGap: 0,
          dateProximity: false,
          dateGapDays: 0,
          merchantSimilarity: 0,
          invoiceReference: false,
          recurring: false,
          mccAlignment: false,
        },
      } satisfies ScoredDocumentMatch);

    const journal = await this.posting.postSettlement(user, {
      client,
      txn: { date: txn.date, amount: Number(txn.amount), type: txn.type, description: txn.description },
      document,
      bankLedgerId: txn.bankAccount.ledgerId,
    });
    const suggestion = await this.repo.upsertSuggestion({
      bankTransactionId: txn.id,
      clientId: client.id,
      firmId: client.firmId,
      documentKind: document.kind as MatchingDocumentKind,
      documentId: document.id,
      documentReference: document.reference,
      partyName: document.partyName,
      amountGap: scored.signals.amountGap,
      dateGapDays: scored.signals.dateGapDays,
      confidence: scored.confidence,
      reasons: scored.reasons as Prisma.InputJsonValue,
      signals: scored.signals as unknown as Prisma.InputJsonValue,
      status: MatchingStatus.APPLIED,
      journalEntryId: journal.id,
    });
    await this.repo.markTransactionMatched(txn.id, journal.id);
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "matching.applied",
      metadata: {
        suggestionId: suggestion.id,
        journalId: journal.id,
        bankTransactionId: txn.id,
        documentId: document.id,
        documentKind: document.kind,
      },
    });
    return {
      suggestion: this.publicSuggestion(suggestion.id, txn, client.id, scored, "APPLIED", journal.id),
      journal,
      alreadyApplied: false,
    };
  }

  async reject(user: AuthUser, dto: MatchingRejectDto) {
    if (!dto.suggestionId && !dto.bankTransactionId) {
      throw new BadRequestException("suggestionId or bankTransactionId is required");
    }
    const existing = dto.suggestionId
      ? await this.repo.findSuggestion(dto.suggestionId)
      : await this.repo.findSuggestionByTransaction(dto.bankTransactionId!);
    if (!existing) {
      throw new MatchingError(MATCH_ERR.SUGGESTION_NOT_FOUND, "Matching suggestion not found", undefined, 404);
    }
    if (existing.status === MatchingStatus.APPLIED) {
      throw new MatchingError(MATCH_ERR.ALREADY_APPLIED, "An applied match cannot be rejected");
    }
    const client = await this.clients.get(user, existing.clientId);
    const rejected =
      existing.status === MatchingStatus.REJECTED ? existing : await this.repo.markRejected(existing.id);
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "matching.rejected",
      metadata: { suggestionId: rejected.id, bankTransactionId: existing.bankTransactionId, reason: dto.reason },
    });
    return {
      suggestion: this.publicSuggestion(
        rejected.id,
        existing.bankTransaction as LoadedTxn,
        client.id,
        this.scoredFromRow(rejected),
        "REJECTED",
        null,
      ),
    };
  }

  private async resolveTargets(user: AuthUser, query: MatchingSuggestionsQueryDto) {
    if (query.bankTransactionId) {
      const txn = await this.repo.findTransaction(query.bankTransactionId);
      if (!txn) {
        throw new MatchingError(MATCH_ERR.TRANSACTION_NOT_FOUND, "Bank transaction not found", undefined, 404);
      }
      const client = await this.clients.get(user, txn.bankAccount.clientId);
      return this.hydrateAll(client, [txn as LoadedTxn]);
    }
    if (query.bankAccountId) {
      const account = await this.repo.findBankAccount(query.bankAccountId);
      if (!account) {
        throw new NotFoundException("Bank account not found");
      }
      const client = await this.clients.get(user, account.clientId);
      const rows = await this.repo.listTransactionsForAccount(account.id);
      return this.hydrateAll(client, rows as LoadedTxn[]);
    }
    if (!query.clientId) {
      throw new BadRequestException("clientId, bankAccountId or bankTransactionId is required");
    }
    const client = await this.clients.get(user, query.clientId);
    const rows = await this.repo.listTransactionsForClient(client.id);
    return this.hydrateAll(client, rows as LoadedTxn[]);
  }

  private async hydrateAll(client: { id: string; firmId: string; type: ClientType }, rows: LoadedTxn[]) {
    const applied = await this.repo.listAppliedDocumentIds(client.id);
    const invoiceExclude = applied.filter((row) => row.documentKind === "invoice").map((row) => row.documentId);
    const billExclude = applied.filter((row) => row.documentKind === "bill").map((row) => row.documentId);
    const [invoices, bills] = await Promise.all([
      this.invoices.list(client.id, invoiceExclude),
      this.bills.list(client.id, billExclude),
    ]);
    const documents = [...invoices, ...bills];
    const accountIds = [...new Set(rows.map((row) => row.bankAccount.id))];
    const siblingRows = await Promise.all(accountIds.map((id) => this.repo.listTransactionsForAccount(id)));
    const siblingsByAccount = new Map(
      accountIds.map((id, index) => [id, siblingRows[index].map((row) => this.toSibling(row as LoadedTxn))]),
    );
    return rows.map((txn) => ({
      txn,
      client,
      documents,
      siblings: siblingsByAccount.get(txn.bankAccount.id) ?? [this.toSibling(txn)],
    }));
  }

  private toSibling(row: LoadedTxn): SiblingTxn {
    return {
      id: row.id,
      merchantName: row.merchantName,
      amount: Number(row.amount),
      description: row.description,
    };
  }

  private async resolveDocument(
    clientId: string,
    dto: MatchingApplyDto,
    existing: { documentId: string; documentKind: MatchingDocumentKind } | null,
  ): Promise<MatchableDocument | null> {
    const kind = dto.documentKind ?? existing?.documentKind;
    const id = dto.documentId ?? existing?.documentId;
    if (!kind || !id) {
      throw new MatchingError(MATCH_ERR.NO_CANDIDATE, "documentId and documentKind are required when no suggestion exists");
    }
    return kind === MatchingDocumentKind.invoice ? this.invoices.get(clientId, id) : this.bills.get(clientId, id);
  }

  private toTxn(txn: LoadedTxn): BankMatchTxn {
    return {
      id: txn.id,
      date: txn.date,
      amount: Number(txn.amount),
      type: txn.type,
      description: txn.description,
      merchantName: txn.merchantName,
      merchantCategoryCode: txn.merchantCategoryCode,
    };
  }

  private scoredFromRow(row: {
    documentId: string;
    documentKind: MatchingDocumentKind;
    documentReference?: string | null;
    partyName?: string | null;
    confidence: unknown;
    reasons: unknown;
    signals?: unknown;
    journalEntryId?: string | null;
    amountGap?: unknown;
    dateGapDays?: number;
  }): ScoredDocumentMatch {
    const signals = (row.signals ?? {}) as ScoredDocumentMatch["signals"];
    return {
      documentId: row.documentId,
      kind: row.documentKind,
      journalId: row.journalEntryId ?? null,
      documentReference: row.documentReference ?? null,
      partyName: row.partyName ?? null,
      confidence: Number(row.confidence),
      reasons: Array.isArray(row.reasons) ? (row.reasons as string[]) : [],
      signals: {
        exactAmount: Boolean(signals.exactAmount),
        amountTolerance: Boolean(signals.amountTolerance),
        amountGap: Number(signals.amountGap ?? row.amountGap ?? 0),
        dateProximity: Boolean(signals.dateProximity),
        dateGapDays: Number(signals.dateGapDays ?? row.dateGapDays ?? 0),
        merchantSimilarity: Number(signals.merchantSimilarity ?? 0),
        invoiceReference: Boolean(signals.invoiceReference),
        recurring: Boolean(signals.recurring),
        mccAlignment: Boolean(signals.mccAlignment),
      },
    };
  }

  private publicSuggestion(
    id: string | null,
    txn: { id: string; date: Date; amount: unknown; type: string; description: string; merchantName?: string | null },
    clientId: string,
    scored: ScoredDocumentMatch,
    status: string,
    journalEntryId: string | null = null,
  ) {
    return {
      id,
      clientId,
      bankTransactionId: txn.id,
      bankTransaction: {
        id: txn.id,
        date: txn.date,
        amount: Number(txn.amount),
        type: txn.type,
        description: txn.description,
        merchantName: txn.merchantName ?? null,
      },
      documentKind: scored.kind,
      documentId: scored.documentId,
      documentReference: scored.documentReference,
      partyName: scored.partyName,
      documentJournalId: scored.journalId,
      journalEntryId,
      journalId: journalEntryId ?? scored.journalId,
      confidence: scored.confidence,
      reasons: scored.reasons,
      signals: scored.signals,
      status,
    };
  }
}
