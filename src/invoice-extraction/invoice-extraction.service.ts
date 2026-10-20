import { Inject, Injectable } from "@nestjs/common";
import { DocumentKind, ExtractionStatus, PartyKind, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { BookkeepingRepository } from "../bookkeeping/bookkeeping.repository";
import { money } from "../bookkeeping/domain/money";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { defaultProfileForClientType } from "../ledger/chart-of-accounts.catalog";
import { OCRService } from "../receipts/ocr.service";
import { RECEIPT_STORAGE, ReceiptStorage } from "../receipts/storage/receipt-storage";
import { ConfirmExtractionDto } from "./dto/invoice-extraction.dto";
import { extractInvoiceFromText } from "./domain/extract";
import { ExtractedInvoice, InvoiceDirection } from "./domain/types";
import { EXTRACT_ERR, InvoiceExtractionError } from "./invoice-extraction.errors";
import { InvoiceExtractionRepository } from "./invoice-extraction.repository";

@Injectable()
export class InvoiceExtractionService {
  constructor(
    private readonly repo: InvoiceExtractionRepository,
    private readonly clients: ClientsService,
    private readonly books: BookkeepingRepository,
    private readonly ocr: OCRService,
    @Inject(RECEIPT_STORAGE) private readonly storage: ReceiptStorage,
    private readonly audit: AuditService,
  ) {}

  async extractFromDocument(user: AuthUser, documentId: string, direction?: InvoiceDirection) {
    const document = await this.requireDocument(user, documentId);
    await this.repo.markStatus(document.id, ExtractionStatus.IN_PROGRESS);
    try {
      const text = await this.resolveText(document);
      const profile = defaultProfileForClientType((await this.clients.get(user, document.clientId)).type);
      const parties = await this.books.listParties(document.clientId, direction === "sales" ? PartyKind.CUSTOMER : PartyKind.SUPPLIER);
      const extracted = extractInvoiceFromText(text, {
        direction,
        profile,
        parties,
        source: document.ocrText ? "hint" : "ocr",
      });
      await this.repo.writeExtraction(document.id, {
        extractedData: extracted as unknown as Prisma.InputJsonValue,
        extractionConfidence: extracted.confidence,
        status: ExtractionStatus.COMPLETED,
      });
      await this.repo.log({
        document: { connect: { id: document.id } },
        status: ExtractionStatus.COMPLETED,
        confidence: extracted.confidence,
        extractedData: extracted as unknown as Prisma.InputJsonValue,
        warnings: extracted.issues as unknown as Prisma.InputJsonValue,
      });
      if (!document.ocrText && text) {
        await this.repo.markStatus(document.id, ExtractionStatus.COMPLETED, { ocrText: text });
      }
      await this.audit.record({
        actor: user,
        clientId: document.clientId,
        actionType: "invoice.extraction.completed",
        metadata: { documentId: document.id, confidence: extracted.confidence, invoiceNumber: extracted.invoiceNumber },
      });
      return this.present(document, extracted, ExtractionStatus.COMPLETED);
    } catch (error) {
      await this.repo.writeExtraction(document.id, {
        extractedData: { error: error instanceof Error ? error.message : "extraction_failed" } as Prisma.InputJsonValue,
        extractionConfidence: 0,
        status: ExtractionStatus.FAILED,
      });
      await this.repo.log({
        document: { connect: { id: document.id } },
        status: ExtractionStatus.FAILED,
        confidence: 0,
        extractedData: { error: error instanceof Error ? error.message : "extraction_failed" } as Prisma.InputJsonValue,
      });
      throw error;
    }
  }

  async getExtraction(user: AuthUser, documentId: string) {
    const document = await this.requireDocument(user, documentId);
    const extracted = document.extractedData
      ? (document.extractedData as unknown as ExtractedInvoice)
      : emptyExtracted();
    return this.present(
      document,
      extracted,
      document.extractionStatus,
      Number(document.extractionConfidence ?? extracted.confidence ?? 0),
    );
  }

  async listExtractions(user: AuthUser, clientId?: string) {
    const client = await this.clients.get(user, clientId ?? user.clientId ?? "");
    const rows = await this.repo.listForClient(client.id);
    return {
      clientId: client.id,
      count: rows.length,
      documents: rows.map((row) => ({
        documentId: row.id,
        clientId: row.clientId,
        fileName: row.fileName,
        fileType: row.fileType,
        previewUrl: `/documents/${row.id}/file`,
        type: row.type,
        invoiceNumber: row.ocrInvoiceNumber,
        supplierName: (row.extractedData as { supplierName?: string } | null)?.supplierName ?? row.ocrMerchant,
        status: this.publicStatus(row.extractionStatus),
        reviewStatus: this.reviewStatus(row),
        confidence: Number(row.extractionConfidence ?? 0),
        invoiceId: row.invoiceId,
        billId: row.billId,
        uploadedAt: row.uploadedAt,
      })),
    };
  }

  async listAudit(user: AuthUser, documentId: string) {
    const document = await this.requireDocument(user, documentId);
    const client = await this.clients.get(user, document.clientId);
    const [audit, logs] = await Promise.all([
      this.repo.listAudit({
        firmId: client.firmId,
        clientId: document.clientId,
        documentId: document.id,
        invoiceId: document.invoiceId ?? undefined,
        billId: document.billId ?? undefined,
      }),
      this.repo.listLogs(document.id),
    ]);
    return this.mergeAudit(audit, logs);
  }

  async saveDraft(user: AuthUser, documentId: string, dto: ConfirmExtractionDto) {
    const document = await this.requireDocument(user, documentId);
    const current = (document.extractedData as ExtractedInvoice | null) ?? emptyExtracted();
    const merged = { ...current, ...this.overrides(dto), confidence: current.confidence ?? 0 };
    await this.repo.writeExtraction(document.id, {
      extractedData: merged as unknown as Prisma.InputJsonValue,
      extractionConfidence: merged.confidence ?? Number(document.extractionConfidence ?? 0),
      status: ExtractionStatus.COMPLETED,
    });
    await this.repo.log({
      document: { connect: { id: document.id } },
      status: ExtractionStatus.COMPLETED,
      confidence: merged.confidence,
      extractedData: merged as unknown as Prisma.InputJsonValue,
      warnings: (merged.issues ?? []) as unknown as Prisma.InputJsonValue,
    });
    await this.audit.record({
      actor: user,
      clientId: document.clientId,
      actionType: "invoice.extraction.draft_saved",
      metadata: { documentId: document.id, invoiceNumber: merged.invoiceNumber },
    });
    return this.present({ ...document, extractionStatus: ExtractionStatus.COMPLETED }, merged, ExtractionStatus.COMPLETED);
  }

  async reject(user: AuthUser, documentId: string, reason?: string) {
    const document = await this.requireDocument(user, documentId);
    if (document.invoiceId || document.billId) {
      throw new InvoiceExtractionError(EXTRACT_ERR.ALREADY_CONFIRMED, "Document is already attached to an invoice or bill");
    }
    await this.repo.markStatus(document.id, ExtractionStatus.REJECTED);
    await this.repo.log({
      document: { connect: { id: document.id } },
      status: ExtractionStatus.REJECTED,
      confidence: Number(document.extractionConfidence ?? 0),
      extractedData: (document.extractedData ?? {}) as Prisma.InputJsonValue,
      warnings: [reason ?? "Extraction rejected"] as unknown as Prisma.InputJsonValue,
    });
    await this.audit.record({
      actor: user,
      clientId: document.clientId,
      actionType: "invoice.extraction.rejected",
      metadata: { documentId: document.id, reason: reason ?? "rejected" },
    });
    const extracted = (document.extractedData as ExtractedInvoice | null) ?? emptyExtracted();
    return this.present({ ...document, extractionStatus: ExtractionStatus.REJECTED }, extracted, ExtractionStatus.REJECTED);
  }

  reprocess(user: AuthUser, documentId: string, direction?: InvoiceDirection) {
    return this.extractFromDocument(user, documentId, direction);
  }

  async confirm(user: AuthUser, documentId: string, dto: ConfirmExtractionDto) {
    const document = await this.requireDocument(user, documentId);
    if (document.invoiceId || document.billId) {
      throw new InvoiceExtractionError(EXTRACT_ERR.ALREADY_CONFIRMED, "Document is already attached to an invoice or bill");
    }
    const extracted = document.extractedData
      ? ({ ...(document.extractedData as object), ...this.overrides(dto) } as ExtractedInvoice)
      : (await this.extractFromDocument(user, documentId, dto.direction)).extracted;
    const merged = { ...extracted, ...this.overrides(dto) };
    if (!merged.invoiceDate || (!merged.lineItems?.length && merged.grandTotal == null && merged.subtotal == null)) {
      throw new InvoiceExtractionError(EXTRACT_ERR.MISSING_FIELDS, "Invoice date and at least one amount or line item are required");
    }
    const client = await this.clients.get(user, document.clientId);
    const direction = dto.direction ?? merged.direction ?? "purchase";
    const date = merged.invoiceDate;
    const dueDate = merged.dueDate ?? addDays(date, 14);
    const lines = this.confirmLines(merged);
    const netTotal = money(lines.reduce((sum, line) => sum + line.net, 0));
    const vatTotal = money(lines.reduce((sum, line) => sum + line.vat, 0));
    const grossTotal = money(netTotal + vatTotal);
    const taxes = await this.books.listTaxCodes();
    const tax = taxes.find((item) => item.type === (vatTotal > 0 ? "VAT_STANDARD" : "NO_VAT")) ?? taxes[0];

    if (direction === "sales") {
      const customer =
        (merged.supplierId ? await this.books.ensureParty(client.id, PartyKind.CUSTOMER, merged.supplierId) : null) ??
        (await this.books.findPartyByName(client.id, PartyKind.CUSTOMER, merged.supplierName ?? "Customer")) ??
        (await this.books.ensureParty(client.id, PartyKind.CUSTOMER, undefined, merged.supplierName ?? "Customer"));
      const invoice = await this.books.createInvoice({
        client: { connect: { id: client.id } },
        customer: { connect: { id: customer!.id } },
        date: this.books.toDate(date!),
        dueDate: this.books.toDate(dueDate),
        status: "DRAFT",
        invoiceNumber: merged.invoiceNumber,
        netTotal,
        vatTotal,
        grossTotal,
        lines: {
          create: lines.map((line) => ({
            description: line.description,
            net: line.net,
            vat: line.vat,
            taxCodeId: tax?.id,
          })),
        },
      });
      await this.repo.attachInvoice(document.id, invoice.id);
      await this.attachSupporting(document, "sales", invoice.id);
      await this.audit.record({
        actor: user,
        clientId: client.id,
        actionType: "invoice.extraction.confirmed",
        metadata: { documentId: document.id, invoiceId: invoice.id, status: "draft_extracted" },
      });
      return { status: "draft_extracted", direction, invoice, bill: null, extracted: merged };
    }

    const supplier =
      (merged.supplierId ? await this.books.ensureParty(client.id, PartyKind.SUPPLIER, merged.supplierId) : null) ??
      (await this.books.findPartyByName(client.id, PartyKind.SUPPLIER, merged.supplierName ?? "Supplier")) ??
      (await this.books.ensureParty(client.id, PartyKind.SUPPLIER, undefined, merged.supplierName ?? "Supplier"));
    const bill = await this.books.createBill({
      client: { connect: { id: client.id } },
      supplier: { connect: { id: supplier!.id } },
      date: this.books.toDate(date!),
      dueDate: this.books.toDate(dueDate),
      status: "DRAFT",
      invoiceNumber: merged.invoiceNumber,
      netTotal,
      vatTotal,
      grossTotal,
      lines: {
        create: lines.map((line) => ({
          description: line.description,
          net: line.net,
          vat: line.vat,
          taxCodeId: tax?.id,
        })),
      },
    });
    await this.repo.attachBill(document.id, bill.id);
    await this.attachSupporting(document, "purchase", bill.id);
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "invoice.extraction.confirmed",
      metadata: { documentId: document.id, billId: bill.id, status: "draft_extracted" },
    });
    return { status: "draft_extracted", direction, invoice: null, bill, extracted: merged };
  }

  private async resolveText(document: { ocrText?: string | null; fileType: string; fileName: string; storageKey: string }) {
    if (document.ocrText && document.ocrText.trim().length > 20) {
      return document.ocrText;
    }
    const buffer = await this.storage.get(document.storageKey);
    const extracted = await this.ocr.extract({
      fileType: document.fileType as "jpg" | "png" | "pdf",
      buffer,
      hint: document.ocrText ?? undefined,
      fileName: document.fileName,
    });
    return extracted.text || document.ocrText || "";
  }

  private async requireDocument(user: AuthUser, id: string) {
    const document = await this.repo.findDocument(id);
    if (!document) {
      throw new InvoiceExtractionError(EXTRACT_ERR.DOCUMENT_NOT_FOUND, "Document not found", undefined, 404);
    }
    await this.clients.get(user, document.clientId);
    if (document.type !== DocumentKind.INVOICE && document.type !== DocumentKind.RECEIPT && document.type !== DocumentKind.BILL) {
      // still allowed — extraction can run on invoice-like files
    }
    return document;
  }

  private overrides(dto: ConfirmExtractionDto): Partial<ExtractedInvoice> {
    return {
      ...(dto.direction ? { direction: dto.direction } : {}),
      ...(dto.supplierName ? { supplierName: dto.supplierName } : {}),
      ...(dto.invoiceNumber ? { invoiceNumber: dto.invoiceNumber } : {}),
      ...(dto.invoiceDate ? { invoiceDate: dto.invoiceDate } : {}),
      ...(dto.dueDate ? { dueDate: dto.dueDate } : {}),
      ...(dto.lines
        ? {
            lineItems: dto.lines.map((line) => ({
              description: line.description ?? "Extracted line",
              quantity: line.quantity ?? 1,
              unitPrice: line.net ?? null,
              net: line.net ?? 0,
              vat: line.vat ?? 0,
              vatRate: line.net && line.vat ? money((line.vat / line.net) * 100) : 20,
              gross: money((line.net ?? 0) + (line.vat ?? 0)),
              confidence: 0.99,
            })),
          }
        : {}),
    };
  }

  private confirmLines(extracted: ExtractedInvoice) {
    if (extracted.lineItems?.length) {
      return extracted.lineItems.map((line) => ({
        description: line.description,
        net: line.net ?? 0,
        vat: line.vat ?? 0,
      }));
    }
    const net = extracted.subtotal ?? (extracted.grandTotal != null && extracted.vatTotal != null ? money(extracted.grandTotal - extracted.vatTotal) : extracted.grandTotal ?? 0);
    const vat = extracted.vatTotal ?? 0;
    return [{ description: extracted.invoiceNumber ? `Invoice ${extracted.invoiceNumber}` : "Extracted invoice", net, vat }];
  }

  private async attachSupporting(document: { id: string; clientId: string }, direction: InvoiceDirection, targetId: string) {
    const extras = this.repo.listSupporting ? await this.repo.listSupporting(document.clientId, document.id) : [];
    const ids = extras.map((row) => row.id);
    if (direction === "sales") {
      await this.repo.attachManyToInvoice?.(ids, targetId);
    } else {
      await this.repo.attachManyToBill?.(ids, targetId);
    }
  }

  private async present(
    document: {
      id: string;
      clientId: string;
      fileName?: string;
      fileType?: string;
      invoiceId?: string | null;
      billId?: string | null;
      extractionStatus?: ExtractionStatus;
      firmId?: string;
    },
    extracted: ExtractedInvoice,
    status: ExtractionStatus,
    confidence = extracted.confidence,
  ) {
    const audit = this.repo.listAudit
      ? await this.repo.listAudit({
          firmId: document.firmId ?? "",
          clientId: document.clientId,
          documentId: document.id,
          invoiceId: document.invoiceId ?? undefined,
          billId: document.billId ?? undefined,
        }).catch(() => [])
      : [];
    const logs = this.repo.listLogs ? await this.repo.listLogs(document.id).catch(() => []) : [];
    return {
      documentId: document.id,
      clientId: document.clientId,
      fileName: document.fileName ?? "invoice",
      fileType: document.fileType ?? "pdf",
      previewUrl: `/documents/${document.id}/file`,
      invoiceId: document.invoiceId ?? null,
      billId: document.billId ?? null,
      status: this.publicStatus(status),
      reviewStatus: this.reviewStatus({ ...document, extractionStatus: status }),
      confidence,
      extracted,
      audit: this.mergeAudit(audit, logs),
    };
  }

  private publicStatus(status: ExtractionStatus) {
    if (status === ExtractionStatus.COMPLETED) {
      return "completed";
    }
    if (status === ExtractionStatus.FAILED) {
      return "failed";
    }
    if (status === ExtractionStatus.IN_PROGRESS) {
      return "in_progress";
    }
    if (status === ExtractionStatus.REJECTED) {
      return "rejected";
    }
    return "not_started";
  }

  private reviewStatus(document: { invoiceId?: string | null; billId?: string | null; extractionStatus?: ExtractionStatus | null }) {
    if (document.invoiceId || document.billId) {
      return "approved";
    }
    return this.publicStatus(document.extractionStatus ?? ExtractionStatus.NOT_STARTED);
  }

  private mergeAudit(
    audit: Array<{
      id: string;
      actionType: string;
      createdAt: Date;
      actor?: { name?: string | null; email?: string | null } | null;
      metadata?: unknown;
    }>,
    logs: Array<{ id: string; status: ExtractionStatus; createdAt: Date; warnings?: unknown; confidence?: unknown }>,
  ) {
    const fromAudit = audit.map((row) => ({
      id: row.id,
      action: row.actionType,
      userName: row.actor?.name || row.actor?.email || "System",
      createdAt: row.createdAt,
      metadata: row.metadata ?? {},
    }));
    const fromLogs = logs.map((row) => ({
      id: `log-${row.id}`,
      action: `invoice.extraction.${this.publicStatus(row.status)}`,
      userName: "Extraction engine",
      createdAt: row.createdAt,
      metadata: { confidence: row.confidence != null ? Number(row.confidence) : null, warnings: row.warnings },
    }));
    return [...fromAudit, ...fromLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private publicExtraction(documentId: string, extracted: ExtractedInvoice, status: ExtractionStatus, confidence = extracted.confidence) {
    return {
      documentId,
      status: this.publicStatus(status),
      confidence,
      extracted,
    };
  }
}

function emptyExtracted(): ExtractedInvoice {
  return {
    supplierName: null,
    supplierAddress: null,
    supplierId: null,
    customerName: null,
    invoiceNumber: null,
    invoiceDate: null,
    dueDate: null,
    currency: "GBP",
    lineItems: [],
    subtotal: null,
    vatTotal: null,
    grandTotal: null,
    direction: "purchase",
    vatBoxes: [],
    itsaCategory: null,
    itsaBucket: null,
    issues: [],
    fieldConfidence: {
      supplierName: 0,
      supplierAddress: 0,
      invoiceNumber: 0,
      invoiceDate: 0,
      dueDate: 0,
      lineItems: 0,
      subtotal: 0,
      vatTotal: 0,
      grandTotal: 0,
    },
    confidence: 0,
    source: "ocr",
  };
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
