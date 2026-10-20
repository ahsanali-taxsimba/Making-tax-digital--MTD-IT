import { Injectable, NotFoundException } from "@nestjs/common";
import { ManualStatementStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { BookkeepingRepository } from "../bookkeeping/bookkeeping.repository";
import { parseDate } from "../bookkeeping/domain/money";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { BankFeedPipelineService } from "../yapily/bank-feed-pipeline.service";
import { CsvHealthCheckService } from "./csv-health-check.service";
import { healthCheckStatement } from "./domain/health";
import {
  BulkManualUploadDto,
  ManualHealthCheckDto,
  ManualParseDto,
  ManualUploadDto,
  ManualUploadsQueryDto,
} from "./dto/manual-statements.dto";
import { EnrichmentService } from "./enrichment.service";
import { MANUAL_ERR, ManualStatementError } from "./manual-statements.errors";
import { ManualStatementsRepository } from "./manual-statements.repository";
import { StatementCSVParserService } from "./statement-csv-parser.service";

@Injectable()
export class ManualStatementsService {
  constructor(
    private readonly repo: ManualStatementsRepository,
    private readonly books: BookkeepingRepository,
    private readonly clients: ClientsService,
    private readonly parser: StatementCSVParserService,
    private readonly health: CsvHealthCheckService,
    private readonly enrichment: EnrichmentService,
    private readonly pipeline: BankFeedPipelineService,
    private readonly audit: AuditService,
  ) {}

  profiles() {
    return { profiles: this.parser.profiles() };
  }

  healthCheck(dto: ManualHealthCheckDto) {
    return this.health.inspect(dto.fileName, dto.csv);
  }

  async list(user: AuthUser, query: ManualUploadsQueryDto) {
    await this.clients.get(user, query.clientId);
    const uploads = await this.repo.list(query.clientId, query.bankAccountId);
    return { uploads: uploads.map((row) => this.publicUpload(row)), count: uploads.length };
  }

  async upload(user: AuthUser, dto: ManualUploadDto) {
    this.parser.assertCsv(dto.fileName, dto.csv);
    const account = await this.requireAccount(user, dto.bankAccountId, dto.clientId);
    const created = await this.repo.create({
      firm: { connect: { id: account.firmId } },
      client: { connect: { id: account.clientId } },
      bankAccount: { connect: { id: account.id } },
      fileName: dto.fileName,
      fileType: "csv",
      content: dto.csv,
      uploadedBy: { connect: { id: user.id } },
      status: ManualStatementStatus.UPLOADED,
    });
    await this.audit.record({
      actor: user,
      clientId: account.clientId,
      actionType: "bank.manual.uploaded",
      metadata: { uploadId: created.id, bankAccountId: account.id, fileName: dto.fileName },
    });
    if (dto.autoParse === false) {
      return { upload: this.publicUpload(created), parsed: false as const };
    }
    return this.parse(user, created.id, dto);
  }

  async uploadBulk(user: AuthUser, dto: BulkManualUploadDto) {
    const results = [];
    for (const file of dto.files) {
      results.push(
        await this.upload(user, {
          clientId: dto.clientId,
          bankAccountId: file.bankAccountId ?? dto.bankAccountId ?? "",
          fileName: file.fileName,
          csv: file.csv,
          autoParse: dto.autoParse,
          autoPost: dto.autoPost,
        }),
      );
    }
    return { uploads: results, count: results.length };
  }

  async parse(user: AuthUser, uploadId: string, dto: ManualParseDto = {}) {
    const upload = await this.repo.find(uploadId);
    if (!upload) {
      throw new ManualStatementError(MANUAL_ERR.UPLOAD_NOT_FOUND, "Manual statement upload was not found", undefined, 404);
    }
    await this.clients.get(user, upload.clientId);

    try {
      const parsed = this.parser.parse(upload.fileName, upload.content);
      const health = healthCheckStatement(parsed);
      const existing = await this.books.listExternalRefs(upload.bankAccountId);
      const known = new Set(existing.map((row) => row.externalRef).filter(Boolean) as string[]);
      const seen = new Set<string>();
      const incoming = [];
      let duplicates = 0;

      for (const row of parsed.rows) {
        const externalRef = `csv:${row.externalTransactionId}`;
        if (known.has(externalRef) || seen.has(externalRef)) {
          duplicates += 1;
          continue;
        }
        seen.add(externalRef);
        const enriched = this.enrichment.enrich({ description: row.description, type: row.type });
        incoming.push({
          date: parseDate(row.date),
          amount: row.amount,
          type: row.type,
          description: enriched.description,
          externalRef,
          merchantName: enriched.merchantName,
          category: enriched.category,
          merchantCategoryCode: enriched.merchantCategoryCode,
          transactionCategory: enriched.transactionCategory,
          enrichment: {
            merchantName: enriched.merchantName,
            category: enriched.category,
            merchantCategoryCode: enriched.merchantCategoryCode,
            transactionCategory: enriched.transactionCategory,
            vatHint: enriched.vatHint,
            itsaBucket: enriched.itsaBucket,
            source: "manual_csv",
            uploadId,
          },
        });
      }

      if (incoming.length) {
        await this.books.createBankTransactions(upload.bankAccountId, incoming);
      }

      const dates = parsed.rows.map((row) => row.date).sort();
      const saved = await this.repo.mark(upload.id, ManualStatementStatus.PARSED, {
        parsedAt: new Date(),
        profile: parsed.profile.id,
        rowCount: parsed.rows.length,
        importedCount: incoming.length,
        duplicateCount: duplicates,
        health: health as never,
        errorMessage: null,
      });

      const pipeline = await this.pipeline.processIngestedFeed(user, {
        clientId: upload.clientId,
        accounts: [{ id: upload.bankAccountId }],
        bankAccountId: upload.bankAccountId,
        from: dates[0],
        to: dates[dates.length - 1],
        autoMatch: dto.autoMatch,
        autoCategorise: dto.autoCategorise,
        autoPost: dto.autoPost,
        source: "manual_csv",
      });

      await this.audit.record({
        actor: user,
        clientId: upload.clientId,
        actionType: "bank.manual.parsed",
        metadata: {
          uploadId: upload.id,
          imported: incoming.length,
          duplicates,
          profile: parsed.profile.id,
        },
      });

      return {
        upload: this.publicUpload(saved),
        parsed: true as const,
        profile: parsed.profile.id,
        health,
        imported: incoming.length,
        duplicates,
        transactions: incoming.map((row) => ({
          date: row.date.toISOString().slice(0, 10),
          amount: row.amount,
          type: row.type,
          description: row.description,
          externalRef: row.externalRef,
          merchantName: row.merchantName,
          category: row.category,
          merchantCategoryCode: row.merchantCategoryCode,
        })),
        pipeline,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "CSV parse failed";
      await this.repo.mark(upload.id, ManualStatementStatus.FAILED, {
        parsedAt: new Date(),
        errorMessage: message,
      });
      throw error;
    }
  }

  private async requireAccount(user: AuthUser, bankAccountId: string, clientId?: string) {
    if (!bankAccountId) {
      throw new ManualStatementError(MANUAL_ERR.ACCOUNT_MISMATCH, "bankAccountId is required");
    }
    const account = await this.books.findBankAccount(bankAccountId);
    if (!account) {
      throw new NotFoundException("Bank account not found");
    }
    if (clientId && clientId !== account.clientId) {
      throw new ManualStatementError(MANUAL_ERR.ACCOUNT_MISMATCH, "Bank account does not belong to this client");
    }
    await this.clients.get(user, account.clientId);
    return account;
  }

  private publicUpload(row: {
    id: string;
    clientId: string;
    bankAccountId: string;
    fileName: string;
    fileType: string;
    uploadedByUserId: string;
    uploadedAt: Date;
    parsedAt?: Date | null;
    status: ManualStatementStatus | string;
    profile?: string | null;
    rowCount?: number;
    importedCount?: number;
    duplicateCount?: number;
    health?: unknown;
    errorMessage?: string | null;
  }) {
    return {
      id: row.id,
      clientId: row.clientId,
      bankAccountId: row.bankAccountId,
      fileName: row.fileName,
      fileType: "csv" as const,
      uploadedByUserId: row.uploadedByUserId,
      uploadedAt: row.uploadedAt,
      parsedAt: row.parsedAt ?? null,
      status: String(row.status).toLowerCase() as "uploaded" | "parsed" | "failed",
      profile: row.profile ?? null,
      rowCount: row.rowCount ?? 0,
      importedCount: row.importedCount ?? 0,
      duplicateCount: row.duplicateCount ?? 0,
      health: row.health ?? null,
      errorMessage: row.errorMessage ?? null,
    };
  }
}
