import { Inject, Injectable } from "@nestjs/common";
import { DocumentKind, EvidenceStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { AuditService } from "../audit/audit.service";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { decodeUploadContent, detectReceiptType, MAX_RECEIPT_BYTES, mimeFor } from "../receipts/domain/file-types";
import { OCRService } from "../receipts/ocr.service";
import { RECEIPT_STORAGE, ReceiptStorage } from "../receipts/storage/receipt-storage";
import { DocumentAttachmentService } from "./document-attachment.service";
import { DocumentSearchService } from "./document-search.service";
import { DocumentTagService } from "./document-tag.service";
import { buildAttachedTo, parseDocumentKind, publicKind } from "./domain/document.types";
import { DOC_ERR, DocumentError } from "./documents.errors";
import { DocumentsRepository } from "./documents.repository";
import { AttachDocumentDto, DocumentsQueryDto, DocumentSearchQueryDto, UpdateDocumentTagsDto, UploadDocumentDto } from "./dto/documents.dto";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
    private readonly repo: DocumentsRepository,
    private readonly attachments: DocumentAttachmentService,
    private readonly tags: DocumentTagService,
    private readonly searchEngine: DocumentSearchService,
    private readonly audit: AuditService,
    @Inject(RECEIPT_STORAGE) private readonly storage: ReceiptStorage,
    private readonly ocr: OCRService,
  ) {}

  async list(user: AuthUser, clientId: string) {
    await this.clients.get(user, clientId);
    return this.prisma.supportingDocument.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    user: AuthUser,
    clientId: string,
    dto: { fileName: string; mimeType: string; sizeBytes: number; category?: string },
  ) {
    await this.clients.get(user, clientId);
    return this.prisma.supportingDocument.create({
      data: {
        clientId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        category: dto.category,
        status: EvidenceStatus.PENDING,
        storageKey: `pending/${clientId}/${randomUUID()}/${dto.fileName}`,
        uploadedBy: user.id,
      },
    });
  }

  async upload(user: AuthUser, dto: UploadDocumentDto) {
    const client = await this.clients.get(user, dto.clientId ?? user.clientId ?? "");
    const buffer = decodeUploadContent(dto.content);
    if (!buffer.length) {
      throw new DocumentError(DOC_ERR.EMPTY_FILE, "Document file is empty");
    }
    if (buffer.length > MAX_RECEIPT_BYTES) {
      throw new DocumentError(DOC_ERR.FILE_TOO_LARGE, "Document must be 12MB or smaller");
    }
    const fileType = detectReceiptType(dto.fileName, dto.mimeType, buffer);
    if (!fileType) {
      throw new DocumentError(DOC_ERR.FILE_TYPE, "Only JPG, PNG, and PDF documents are supported");
    }
    const kind = parseDocumentKind(dto.type) ?? inferKind(dto.fileName, dto.tags);
    const id = randomUUID();
    const storageKey = `clients/${client.id}/documents/${id}/file.${fileType}`;
    let storageUrl: string;
    try {
      storageUrl = await this.storage.put(storageKey, buffer, mimeFor(fileType));
    } catch (error) {
      throw new DocumentError(DOC_ERR.STORAGE_FAILED, error instanceof Error ? error.message : "Unable to store document");
    }
    const extracted = await this.ocr.extract({ fileType, buffer, hint: dto.ocrText, fileName: dto.fileName });
    const tagNames = dto.tags ?? [];
    const attachedTo = buildAttachedTo({
      clientId: client.id,
      bankTransactionId: dto.bankTransactionId,
      invoiceId: dto.invoiceId,
      billId: dto.billId,
      journalEntryId: dto.journalEntryId,
      vatReturnId: dto.vatReturnId,
      itsaSubmissionId: dto.itsaSubmissionId,
    });
    let saved = await this.repo.create({
      id,
      firm: { connect: { id: client.firmId } },
      client: { connect: { id: client.id } },
      type: kind,
      fileName: dto.fileName,
      fileType,
      fileSize: buffer.length,
      storageKey,
      storageUrl,
      ocrText: extracted.text || dto.ocrText || null,
      ocrMerchant: extracted.merchantName,
      ocrAmount: extracted.amount,
      ocrDate: extracted.date ? new Date(extracted.date) : null,
      ocrInvoiceNumber: extracted.invoiceNumber,
      tags: tagNames,
      attachedTo: attachedTo as never,
      uploadedBy: { connect: { id: user.id } },
    });
    if (tagNames.length) {
      saved = await this.tags.apply(saved.id, tagNames);
    }
    const attachTargets = {
      bankTransactionId: dto.bankTransactionId,
      invoiceId: dto.invoiceId,
      billId: dto.billId,
      journalEntryId: dto.journalEntryId,
      vatReturnId: dto.vatReturnId,
      itsaSubmissionId: dto.itsaSubmissionId,
    };
    if (Object.values(attachTargets).some(Boolean)) {
      saved = await this.attachments.attach(user, saved.id, attachTargets);
    }
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "document.uploaded",
      metadata: { documentId: saved.id, type: publicKind(kind), fileType },
    });
    return this.publicDocument(saved);
  }

  async listLibrary(user: AuthUser, query: DocumentsQueryDto) {
    const client = await this.clients.get(user, query.clientId ?? user.clientId ?? "");
    const kind = parseDocumentKind(query.type);
    const rows = await this.repo.list(client.id, { type: kind ?? undefined, tag: query.tag });
    return { documents: rows.map((row) => this.publicDocument(row)), count: rows.length };
  }

  async get(user: AuthUser, id: string) {
    return this.publicDocument(await this.require(user, id));
  }

  async preview(user: AuthUser, id: string) {
    const document = await this.require(user, id);
    const buffer = await this.storage.get(document.storageKey);
    return {
      fileName: document.fileName,
      contentType: mimeFor(document.fileType as "jpg" | "png" | "pdf"),
      buffer,
    };
  }

  async search(user: AuthUser, query: DocumentSearchQueryDto) {
    const client = await this.clients.get(user, query.clientId ?? user.clientId ?? "");
    const hits = await this.searchEngine.search(client.id, query.q, parseDocumentKind(query.type) ?? undefined);
    return {
      query: query.q,
      count: hits.length,
      documents: hits.map((hit) => ({ ...this.publicDocument(hit.row), score: hit.score })),
    };
  }

  async attach(user: AuthUser, id: string, dto: AttachDocumentDto) {
    const saved = await this.attachments.attach(user, id, dto);
    return this.publicDocument(saved);
  }

  async detach(
    user: AuthUser,
    id: string,
    target: "bankTransaction" | "invoice" | "bill" | "journal" | "vatReturn" | "itsaSubmission" | "all" = "all",
  ) {
    const saved = await this.attachments.detach(user, id, target);
    return this.publicDocument(saved);
  }

  async updateTags(user: AuthUser, id: string, dto: UpdateDocumentTagsDto) {
    await this.require(user, id);
    const saved = await this.tags.apply(id, dto.tags);
    await this.audit.record({
      actor: user,
      clientId: saved.clientId,
      actionType: "document.tagged",
      metadata: { documentId: id, tags: dto.tags },
    });
    return this.publicDocument(saved);
  }

  listTags() {
    return this.tags.list();
  }

  async reprocessOcr(user: AuthUser, id: string) {
    const document = await this.require(user, id);
    const buffer = await this.storage.get(document.storageKey);
    const extracted = await this.ocr.extract({
      fileType: document.fileType as "jpg" | "png" | "pdf",
      buffer,
      hint: document.ocrText ?? undefined,
      fileName: document.fileName,
    });
    const saved = await this.repo.update(document.id, {
      ocrText: extracted.text,
      ocrMerchant: extracted.merchantName,
      ocrAmount: extracted.amount,
      ocrDate: extracted.date ? new Date(extracted.date) : null,
      ocrInvoiceNumber: extracted.invoiceNumber,
    });
    await this.audit.record({
      actor: user,
      clientId: document.clientId,
      actionType: "document.ocr.reprocessed",
      metadata: { documentId: document.id, merchantName: extracted.merchantName },
    });
    return this.publicDocument(saved);
  }

  publicDocument(row: {
    id: string;
    clientId: string;
    type: DocumentKind;
    fileName: string;
    fileType: string;
    fileSize: number;
    storageUrl: string;
    ocrText?: string | null;
    ocrMerchant?: string | null;
    ocrAmount?: unknown;
    ocrDate?: Date | null;
    ocrInvoiceNumber?: string | null;
    tags: unknown;
    attachedTo: unknown;
    uploadedByUserId: string;
    uploadedAt: Date;
    bankTransactionId?: string | null;
    invoiceId?: string | null;
    billId?: string | null;
    journalEntryId?: string | null;
    vatReturnId?: string | null;
    itsaSubmissionId?: string | null;
    tagLinks?: Array<{ tag: { id: string; name: string; description?: string | null } }>;
  }) {
    return {
      id: row.id,
      clientId: row.clientId,
      type: publicKind(row.type),
      fileName: row.fileName,
      fileType: row.fileType,
      fileSize: row.fileSize,
      storageUrl: row.storageUrl,
      previewUrl: `/documents/${row.id}/file`,
      ocrText: row.ocrText ?? null,
      ocrMerchant: row.ocrMerchant ?? null,
      ocrAmount: row.ocrAmount != null ? Number(row.ocrAmount) : null,
      ocrDate: row.ocrDate ? row.ocrDate.toISOString().slice(0, 10) : null,
      ocrInvoiceNumber: row.ocrInvoiceNumber ?? null,
      tags: Array.isArray(row.tags) ? row.tags : row.tagLinks?.map((link) => link.tag.name) ?? [],
      attachedTo: row.attachedTo ?? this.attachments.syncAttachedTo(row),
      uploadedByUserId: row.uploadedByUserId,
      uploadedAt: row.uploadedAt,
    };
  }

  private async require(user: AuthUser, id: string) {
    const document = await this.repo.find(id);
    if (!document) {
      throw new DocumentError(DOC_ERR.NOT_FOUND, "Document not found", undefined, 404);
    }
    await this.clients.get(user, document.clientId);
    return document;
  }
}

function inferKind(fileName: string, tags: string[] = []): DocumentKind {
  const hay = `${fileName} ${tags.join(" ")}`.toLowerCase();
  if (/hmrc|letter|notice/.test(hay)) {
    return DocumentKind.HMRC_LETTER;
  }
  if (/statement|bank/.test(hay)) {
    return DocumentKind.STATEMENT;
  }
  if (/contract|agreement/.test(hay)) {
    return DocumentKind.CONTRACT;
  }
  if (/bill/.test(hay)) {
    return DocumentKind.BILL;
  }
  if (/invoice/.test(hay)) {
    return DocumentKind.INVOICE;
  }
  return DocumentKind.RECEIPT;
}
