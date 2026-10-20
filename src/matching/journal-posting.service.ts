import { Injectable } from "@nestjs/common";
import { JournalSource } from "@prisma/client";
import { BookkeepingRepository } from "../bookkeeping/bookkeeping.repository";
import { LedgerSnapshot } from "../bookkeeping/domain/journal.rules";
import { toIsoDate } from "../bookkeeping/domain/money";
import { bankPaymentLines, bankReceiptLines, controlCodes, requireAccount } from "../bookkeeping/domain/posting";
import { JournalService } from "../bookkeeping/journal.service";
import { AuthUser } from "../common/types";
import { defaultProfileForClientType } from "../ledger/chart-of-accounts.catalog";
import { MatchableDocument } from "./domain/types";
import { MATCH_ERR, MatchingError } from "./matching.errors";

@Injectable()
export class JournalPostingService {
  constructor(
    private readonly books: BookkeepingRepository,
    private readonly journals: JournalService,
  ) {}

  async postSettlement(
    user: AuthUser,
    input: {
      client: { id: string; firmId: string; type: Parameters<typeof defaultProfileForClientType>[0] };
      txn: { date: Date | string; amount: number; type: "CREDIT" | "DEBIT"; description: string };
      document: MatchableDocument;
      bankLedgerId?: string | null;
    },
  ) {
    const profile = defaultProfileForClientType(input.client.type);
    const ledgers = (await this.books.listLedgers(input.client.id, profile)) as LedgerSnapshot[];
    const controls = controlCodes(profile);
    const bank =
      (input.bankLedgerId ? ledgers.find((item) => item.id === input.bankLedgerId) : undefined) ??
      requireAccount(ledgers, controls.bank, profile);
    if (!bank) {
      throw new MatchingError(MATCH_ERR.MISSING_LEDGER, "Bank ledger account is missing");
    }
    const counterpart =
      input.document.kind === "invoice"
        ? requireAccount(ledgers, controls.debtors, profile)
        : requireAccount(ledgers, controls.creditors, profile);
    const description = this.description(input.txn, input.document);
    const lines =
      input.txn.type === "CREDIT"
        ? bankReceiptLines(bank, counterpart, input.txn.amount, description)
        : bankPaymentLines(bank, counterpart, input.txn.amount, description);
    return this.journals.post(user, {
      clientId: input.client.id,
      firmId: input.client.firmId,
      date: toIsoDate(input.txn.date),
      description,
      reference: this.reference(input.document),
      source: JournalSource.BANK_FEED,
      lines,
      profile,
    });
  }

  description(txn: { description: string }, document: MatchableDocument): string {
    const label = document.kind === "invoice" ? "invoice" : "bill";
    const ref = document.reference ?? document.id.slice(0, 8);
    return `Match ${label} ${ref} ${document.partyName ?? txn.description}`.trim();
  }

  reference(document: MatchableDocument): string {
    return `MATCH-${document.reference ?? document.id.slice(0, 8)}`;
  }
}
