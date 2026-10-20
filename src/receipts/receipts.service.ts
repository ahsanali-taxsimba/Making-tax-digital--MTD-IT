import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AuditService } from "../audit/audit.service";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { decodeUploadContent, detectReceiptType, MAX_RECEIPT_BYTES, mimeFor } from "./domain/file-types";
import { scoreReceiptAgainstTxn } from "./domain/ocr";
import { ReceiptEvidenceQueryDto, ReceiptsQueryDto, UpdateReceiptTagsDto, UploadReceiptDto } from "./dto/receipts.dto";
import { OCRService } from "./ocr.service";
import { ReceiptAttachmentService } from "./receipt-attachment.service";
import { RECEIPT_ERR, ReceiptError } from "./receipts.errors";
import { ReceiptsRepository } from "./receipts.repository";
import { RECEIPT_STORAGE, ReceiptStorage } from "./storage/receipt-storage";

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly repo: ReceiptsRepository,
    private readonly clients: ClientsService,
    private readonly ocr: OCRService,
    private readonly attachments: ReceiptAttachmentService,
    private readonly audit: AuditService,
    @Inject(RECEIPT_STORAGE) private readonly storage: ReceiptStorage,
  ) {}

  async upload(user: AuthUser, dto: UploadReceiptDto) {
    const client = await this.clients.get(user, dto.clientId ?? user.clientId ?? "");
    const buffer = decodeUploadContent(dto.content);
    if (!buffer.length) {
      throw new ReceiptError(RECEIPT_ERR.EMPTY_FILE, "Receipt file is empty");
    }
    if (buffer.length > MAX_RECEIPT_BYTES) {
      throw new ReceiptError(RECEIPT_ERR.FILE_TOO_LARGE, "Receipt must be 12MB or smaller");
    }
    const fileType = detectReceiptType(dto.fileName, dto.mimeType, buffer);
    if (!fileType) {
      throw new ReceiptError(RECEIPT_ERR.FILE_TYPE, "Only JPG, PNG, and PDF receipts are supported");
    }
    const id = randomUUID();
    const storageKey = `clients/${client.id}/receipts/${id}/file.${fileType}`;
    let storageUrl: string;
    try {
      storageUrl = await this.storage.put(storageKey, buffer, mimeFor(fileType));
    } catch (error) {
      throw new ReceiptError(RECEIPT_ERR.STORAGE_FAILED, error instanceof Error ? error.message : "Unable to store receipt");
    }
    const extracted = this.ocr.extract({ fileType, buffer, hint: dto.ocrText, fileName: dto.fileName });
    const tags = dto.tags ?? [];
    const tagRows = tags.length ? await this.repo.ensureTags(tags) : [];
    let saved = await this.repo.create({
      id,
      firm: { connect: { id: client.firmId } },
      client: { connect: { id: client.id } },
      fileName: dto.fileName,
      fileType,
      fileSize: buffer.length,
      storageKey,
      storageUrl,
      uploadedBy: { connect: { id: user.id } },
      tags,
      status: "UPLOADED",
    });
    saved = await this.repo.markProcessed(saved.id, extracted);
    if (tagRows.length) {
      await this.repo.setTagLinks(saved.id, tagRows.map((tag) => tag.id));
      saved = (await this.repo.find(saved.id)) ?? saved;
    }
    if (dto.bankTransactionId) {
      saved = await this.attachments.attachToBankTransaction(user, saved.id, dto.bankTransactionId);
    }
    if (dto.invoiceId) {
      saved = await this.attachments.attachToInvoice(user, saved.id, dto.invoiceId);
    }
    if (dto.billId) {
      saved = await this.attachments.attachToBill(user, saved.id, dto.billId);
    }
    if (dto.journalEntryId) {
      saved = await this.attachments.attachToJournal(user, saved.id, dto.journalEntryId);
    }
    saved = (await this.repo.find(saved.id)) ?? saved;
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "receipt.uploaded",
      metadata: { receiptId: saved.id, fileType, attached: Boolean(dto.bankTransactionId || dto.invoiceId || dto.billId || dto.journalEntryId) },
    });
    return this.publicReceipt(saved);
  }

  async list(user: AuthUser, query: ReceiptsQueryDto) {
    await this.clients.get(user, query.clientId);
    const rows = await this.repo.list(query.clientId);
    return { receipts: rows.map((row) => this.publicReceipt(row)), count: rows.length };
  }

  async get(user: AuthUser, id: string) {
    return this.publicReceipt(await this.require(user, id));
  }

  async file(user: AuthUser, id: string) {
    const receipt = await this.require(user, id);
    const buffer = await this.storage.get(receipt.storageKey);
    return { buffer, contentType: mimeFor(receipt.fileType as "jpg" | "png" | "pdf"), fileName: receipt.fileName };
  }

  listForBankTransaction(user: AuthUser, id: string) {
    return this.listTarget(user, () => this.repo.listForBankTransaction(id), async () => {
      const txn = await this.repo.findBankTransaction(id);
      if (!txn) {
        throw new ReceiptError(RECEIPT_ERR.TARGET_NOT_FOUND, "Bank transaction not found", undefined, 404);
      }
      return txn.bankAccount.clientId;
    });
  }

  listForInvoice(user: AuthUser, id: string) {
    return this.listTarget(user, () => this.repo.listForInvoice(id), async () => {
      const invoice = await this.repo.findInvoice(id);
      if (!invoice) {
        throw new ReceiptError(RECEIPT_ERR.TARGET_NOT_FOUND, "Invoice not found", undefined, 404);
      }
      return invoice.clientId;
    });
  }

  listForBill(user: AuthUser, id: string) {
    return this.listTarget(user, () => this.repo.listForBill(id), async () => {
      const bill = await this.repo.findBill(id);
      if (!bill) {
        throw new ReceiptError(RECEIPT_ERR.TARGET_NOT_FOUND, "Bill not found", undefined, 404);
      }
      return bill.clientId;
    });
  }

  listForJournal(user: AuthUser, id: string) {
    return this.listTarget(user, () => this.repo.listForJournal(id), async () => {
      const journal = await this.repo.findJournal(id);
      if (!journal) {
        throw new ReceiptError(RECEIPT_ERR.TARGET_NOT_FOUND, "Journal entry not found", undefined, 404);
      }
      return journal.clientId;
    });
  }

  async suggestions(user: AuthUser, receiptId: string) {
    const receipt = await this.require(user, receiptId);
    const txns = await this.repo.listClientBankTransactions(receipt.clientId);
    const ranked = txns
      .map((txn) => ({
        bankTransactionId: txn.id,
        description: txn.description,
        merchantName: txn.merchantName,
        amount: Number(txn.amount),
        date: txn.date,
        ...scoreReceiptAgainstTxn(
          {
            merchantName: receipt.ocrMerchant,
            amount: receipt.ocrAmount != null ? Number(receipt.ocrAmount) : null,
            date: receipt.ocrDate ? receipt.ocrDate.toISOString().slice(0, 10) : null,
          },
          { merchantName: txn.merchantName, description: txn.description, amount: Number(txn.amount), date: txn.date },
        ),
      }))
      .filter((row) => row.score >= 0.3)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);
    return { suggestions: ranked, count: ranked.length };
  }

  async evidence(user: AuthUser, query: ReceiptEvidenceQueryDto) {
    await this.clients.get(user, query.clientId);
    return this.evidenceForClient(query.clientId);
  }

  async evidenceForClient(clientId: string) {
    const loaded = await this.repo.evidence(clientId);
    const attachedIds = new Set(
      loaded.receipts.flatMap((row) => [row.journalEntryId, row.billId, row.bankTransactionId, row.invoiceId]).filter(Boolean),
    );
    const expenseJournals = loaded.journals.filter((journal) =>
      journal.lines.some((line) => String(line.ledger.type).toUpperCase() === "EXPENSE" && Number(line.debit) > 0),
    );
    const box4Bills = loaded.bills.filter((bill) => Number(bill.vatTotal) > 0);
    const box4Items = expenseJournals.length + box4Bills.length;
    const box4WithProof =
      expenseJournals.filter((journal) => attachedIds.has(journal.id) || box4Bills.some((bill) => bill.journalId === journal.id && attachedIds.has(bill.id))).length +
      box4Bills.filter((bill) => attachedIds.has(bill.id)).length;
    const allowable = expenseJournals.length;
    const allowableWithReceipt = expenseJournals.filter((journal) => attachedIds.has(journal.id)).length;
    return {
      receiptsAttached: loaded.receipts.length,
      vat: {
        box4: {
          items: box4Items,
          withProof: box4WithProof,
          proofAttached: box4WithProof > 0,
        },
      },
      itsa: {
        attached: loaded.receipts.length,
        allowableExpenses: allowable,
        allowableExpensesWithReceipt: allowableWithReceipt,
      },
    };
  }

  async tags() {
    return { tags: await this.repo.listTags() };
  }

  async updateTags(user: AuthUser, id: string, dto: UpdateReceiptTagsDto) {
    const receipt = await this.require(user, id);
    const names = [...new Set(dto.tags.map((tag) => tag.trim()).filter(Boolean))];
    const tagRows = names.length ? await this.repo.ensureTags(names) : [];
    await this.repo.setTagLinks(receipt.id, tagRows.map((tag) => tag.id));
    const saved = await this.repo.update(receipt.id, { tags: names });
    await this.audit.record({
      actor: user,
      clientId: receipt.clientId,
      actionType: "receipt.tagged",
      metadata: { receiptId: receipt.id, tags: names },
    });
    return this.publicReceipt((await this.repo.find(saved.id)) ?? saved);
  }

  private async listTarget(
    user: AuthUser,
    load: () => Promise<Array<Parameters<ReceiptsService["publicReceipt"]>[0]>>,
    clientIdOf: () => Promise<string>,
  ) {
    await this.clients.get(user, await clientIdOf());
    const rows = await load();
    return { receipts: rows.map((row) => this.publicReceipt(row)), count: rows.length };
  }

  private async require(user: AuthUser, id: string) {
    const receipt = await this.repo.find(id);
    if (!receipt) {
      throw new ReceiptError(RECEIPT_ERR.NOT_FOUND, "Receipt not found", undefined, 404);
    }
    await this.clients.get(user, receipt.clientId);
    return receipt;
  }

  publicReceipt(row: {
    id: string;
    clientId: string;
    bankTransactionId?: string | null;
    invoiceId?: string | null;
    billId?: string | null;
    journalEntryId?: string | null;
    fileName: string;
    fileType: string;
    fileSize: number;
    storageUrl: string;
    uploadedByUserId: string;
    uploadedAt: Date;
    tags?: unknown;
    ocrText?: string | null;
    ocrMerchant?: string | null;
    ocrAmount?: unknown;
    ocrDate?: Date | null;
    status: string;
    tagLinks?: Array<{ tag: { name: string } }>;
  }) {
    const tagNames = [
      ...((Array.isArray(row.tags) ? row.tags : []) as string[]),
      ...(row.tagLinks ?? []).map((link) => link.tag.name),
    ];
    return {
      id: row.id,
      clientId: row.clientId,
      bankTransactionId: row.bankTransactionId ?? null,
      invoiceId: row.invoiceId ?? null,
      billId: row.billId ?? null,
      journalEntryId: row.journalEntryId ?? null,
      fileName: row.fileName,
      fileType: row.fileType,
      fileSize: row.fileSize,
      storageUrl: row.storageUrl,
      uploadedByUserId: row.uploadedByUserId,
      uploadedAt: row.uploadedAt,
      tags: [...new Set(tagNames)],
      ocrText: row.ocrText ?? null,
      ocrMerchant: row.ocrMerchant ?? null,
      ocrAmount: row.ocrAmount != null ? Number(row.ocrAmount) : null,
      ocrDate: row.ocrDate ?? null,
      status: String(row.status).toLowerCase() as "uploaded" | "processed",
      proofAvailable: Boolean(row.bankTransactionId || row.invoiceId || row.billId || row.journalEntryId),
    };
  }
}
