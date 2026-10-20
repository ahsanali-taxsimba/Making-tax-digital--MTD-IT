import { Injectable, NotFoundException } from "@nestjs/common";
import { JournalSource } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { toChartProfile } from "../ledger/chart-of-accounts.catalog";
import { BookkeepingRepository } from "./bookkeeping.repository";
import { CreateJournalDto } from "./dto/bookkeeping.dto";
import {
  assertBalancedJournal,
  assertPeriodOpen,
  assertValidAccounts,
  DraftJournalLine,
  LedgerSnapshot,
  signedMovement,
  toTaxSnapshot,
} from "./domain/journal.rules";
import { financialYearBounds, parseDate } from "./domain/money";
import { assertJournalTaxCodes } from "./domain/tax.rules";

@Injectable()
export class JournalService {
  constructor(
    private readonly repo: BookkeepingRepository,
    private readonly clients: ClientsService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: { clientId: string; periodStart?: string; periodEnd?: string; financialYear?: string; source?: string }) {
    await this.clients.get(user, query.clientId);
    const period = this.resolvePeriod(query);
    return this.repo.listJournals(
      query.clientId,
      period.start ? parseDate(period.start) : undefined,
      period.end ? parseDate(period.end) : undefined,
      query.source as JournalSource | undefined,
    );
  }

  async get(user: AuthUser, id: string) {
    const entry = await this.repo.findJournal(id);
    if (!entry) {
      throw new NotFoundException("Journal not found");
    }
    await this.clients.get(user, entry.clientId);
    return entry;
  }

  async create(user: AuthUser, dto: CreateJournalDto) {
    const client = await this.clients.get(user, dto.clientId);
    const posted = await this.post(user, {
      clientId: client.id,
      firmId: client.firmId,
      date: dto.date,
      description: dto.description,
      reference: dto.reference,
      source: dto.source ?? JournalSource.MANUAL,
      lines: dto.lines,
    });
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "bookkeeping.journal.posted",
      metadata: { journalId: posted.id, source: posted.source },
    });
    return posted;
  }

  async post(
    user: AuthUser | null,
    input: {
      clientId: string;
      firmId: string;
      date: string;
      description: string;
      reference?: string;
      source: JournalSource;
      lines: DraftJournalLine[];
      profile?: string;
    },
  ) {
    const lines = input.lines.map((line) => ({
      ...line,
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0),
    }));
    assertBalancedJournal(lines);

    const profile = input.profile ? toChartProfile(input.profile) : undefined;
    const [accounts, taxCodes, periods] = await Promise.all([
      this.repo.listLedgers(input.clientId, profile),
      this.repo.listTaxCodes(),
      this.repo.listPeriods(input.clientId),
    ]);
    const used = assertValidAccounts(lines, accounts as LedgerSnapshot[], input.clientId);
    assertJournalTaxCodes(lines, used, taxCodes.map(toTaxSnapshot));
    assertPeriodOpen(input.date, periods);

    const accountById = new Map(used.map((account) => [account.id, account]));
    const movements = lines.map((line) => ({
      ledgerAccountId: line.ledgerAccountId,
      delta: signedMovement(accountById.get(line.ledgerAccountId)!, line.debit, line.credit),
    }));
    const dualWrites = lines.map((line) => ({
      ledgerAccountId: line.ledgerAccountId,
      amount: signedMovement(accountById.get(line.ledgerAccountId)!, line.debit, line.credit),
      description: line.description || input.description,
    }));

    return this.repo.createJournal({
      firmId: input.firmId,
      clientId: input.clientId,
      date: parseDate(input.date),
      reference: input.reference,
      description: input.description,
      source: input.source,
      createdByUserId: user?.id,
      lines,
      movements,
      dualWrites,
    });
  }

  resolvePeriod(query: { periodStart?: string; periodEnd?: string; financialYear?: string }) {
    if (query.periodStart && query.periodEnd) {
      return { start: query.periodStart, end: query.periodEnd };
    }
    if (query.financialYear) {
      return financialYearBounds(query.financialYear);
    }
    return { start: undefined, end: undefined };
  }
}
