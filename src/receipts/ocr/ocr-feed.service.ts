import { Injectable, Logger } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { Prisma } from "@prisma/client";
import { CategorisationService } from "../../categorisation/categorisation.service";
import { AuthUser } from "../../common/types";
import { MatchingService } from "../../matching/matching.service";
import { OcrExtraction } from "./ocr.types";
import { ReceiptsRepository } from "../receipts.repository";

@Injectable()
export class OcrFeedService {
  private readonly logger = new Logger(OcrFeedService.name);

  constructor(
    private readonly repo: ReceiptsRepository,
    private readonly moduleRef: ModuleRef,
  ) {}

  async afterOcr(
    user: AuthUser,
    receipt: {
      id: string;
      clientId: string;
      bankTransactionId?: string | null;
    },
    extraction: OcrExtraction,
  ) {
    if (receipt.bankTransactionId) {
      await this.enrichBankTransaction(receipt.bankTransactionId, extraction);
      await this.refreshEngines(user, receipt.bankTransactionId);
    }
  }

  private async enrichBankTransaction(bankTransactionId: string, extraction: OcrExtraction) {
    const txn = await this.repo.findBankTransaction(bankTransactionId);
    if (!txn) {
      return;
    }
    const previous = ((txn as { enrichment?: Record<string, unknown> }).enrichment ?? {}) as Record<string, unknown>;
    const data: { merchantName?: string; enrichment: Prisma.InputJsonValue } = {
      enrichment: {
        ...previous,
        receiptOcr: {
          text: extraction.text,
          merchantName: extraction.merchantName,
          supplierName: extraction.supplierName,
          amount: extraction.amount,
          netAmount: extraction.netAmount,
          vatAmount: extraction.vatAmount,
          vatRate: extraction.vatRate,
          date: extraction.date,
          invoiceNumber: extraction.invoiceNumber,
        },
      },
    };
    if (extraction.merchantName && !txn.merchantName) {
      data.merchantName = extraction.merchantName;
    }
    await this.repo.updateBankTransaction(bankTransactionId, data);
  }

  private async refreshEngines(user: AuthUser, bankTransactionId: string) {
    try {
      const categorisation = this.moduleRef.get(CategorisationService, { strict: false });
      await categorisation.suggest(user, { bankTransactionId, persist: true });
    } catch (error) {
      this.logger.debug(`Categorisation feed skipped: ${error instanceof Error ? error.message : error}`);
    }
    try {
      const matching = this.moduleRef.get(MatchingService, { strict: false });
      await matching.suggestions(user, { bankTransactionId, persist: true });
    } catch (error) {
      this.logger.debug(`Matching feed skipped: ${error instanceof Error ? error.message : error}`);
    }
  }
}
