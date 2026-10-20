import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { buildAttachedTo } from "./domain/document.types";
import { DOC_ERR, DocumentError } from "./documents.errors";
import { DocumentsRepository } from "./documents.repository";

export interface AttachTargets {
  bankTransactionId?: string;
  invoiceId?: string;
  billId?: string;
  journalEntryId?: string;
  vatReturnId?: string;
  itsaSubmissionId?: string;
}

@Injectable()
export class DocumentAttachmentService {
  constructor(
    private readonly repo: DocumentsRepository,
    private readonly clients: ClientsService,
    private readonly audit: AuditService,
  ) {}

  async attach(user: AuthUser, documentId: string, targets: AttachTargets) {
    const document = await this.require(user, documentId);
    const data: Prisma.DocumentFileUpdateInput = {};
    if (targets.bankTransactionId) {
      const txn = await this.repo.findBankTransaction(targets.bankTransactionId);
      if (!txn || txn.bankAccount.clientId !== document.clientId) {
        throw new DocumentError(DOC_ERR.TARGET_NOT_FOUND, "Bank transaction not found", undefined, 404);
      }
      data.bankTransaction = { connect: { id: txn.id } };
    }
    if (targets.invoiceId) {
      const invoice = await this.repo.findInvoice(targets.invoiceId);
      if (!invoice || invoice.clientId !== document.clientId) {
        throw new DocumentError(DOC_ERR.TARGET_NOT_FOUND, "Invoice not found", undefined, 404);
      }
      data.invoice = { connect: { id: invoice.id } };
    }
    if (targets.billId) {
      const bill = await this.repo.findBill(targets.billId);
      if (!bill || bill.clientId !== document.clientId) {
        throw new DocumentError(DOC_ERR.TARGET_NOT_FOUND, "Bill not found", undefined, 404);
      }
      data.bill = { connect: { id: bill.id } };
    }
    if (targets.journalEntryId) {
      const journal = await this.repo.findJournal(targets.journalEntryId);
      if (!journal || journal.clientId !== document.clientId) {
        throw new DocumentError(DOC_ERR.TARGET_NOT_FOUND, "Journal entry not found", undefined, 404);
      }
      data.journal = { connect: { id: journal.id } };
    }
    if (targets.vatReturnId) {
      const vat = await this.repo.findVatReturn(targets.vatReturnId);
      if (!vat || vat.clientId !== document.clientId) {
        throw new DocumentError(DOC_ERR.TARGET_NOT_FOUND, "VAT return not found", undefined, 404);
      }
      data.vatReturn = { connect: { id: vat.id } };
    }
    if (targets.itsaSubmissionId) {
      const itsa = await this.repo.findItsaSubmission(targets.itsaSubmissionId);
      if (!itsa || itsa.clientId !== document.clientId) {
        throw new DocumentError(DOC_ERR.TARGET_NOT_FOUND, "ITSA submission not found", undefined, 404);
      }
      data.itsaSubmission = { connect: { id: itsa.id } };
    }
    const saved = await this.repo.update(document.id, data);
    const attachedTo = this.syncAttachedTo(saved);
    const next = await this.repo.update(saved.id, { attachedTo: attachedTo as unknown as Prisma.InputJsonValue });
    await this.audit.record({
      actor: user,
      clientId: document.clientId,
      actionType: "document.attached",
      resourceType: "document",
      resourceId: document.id,
      beforeData: { attachedTo: document.attachedTo as Record<string, unknown> },
      afterData: { attachedTo },
      metadata: { documentId: document.id, ...targets },
    });
    return next;
  }

  async detach(user: AuthUser, documentId: string, target: "bankTransaction" | "invoice" | "bill" | "journal" | "vatReturn" | "itsaSubmission" | "all" = "all") {
    const document = await this.require(user, documentId);
    const data: Prisma.DocumentFileUpdateInput = {};
    if (target === "all" || target === "bankTransaction") {
      data.bankTransaction = { disconnect: true };
    }
    if (target === "all" || target === "invoice") {
      data.invoice = { disconnect: true };
    }
    if (target === "all" || target === "bill") {
      data.bill = { disconnect: true };
    }
    if (target === "all" || target === "journal") {
      data.journal = { disconnect: true };
    }
    if (target === "all" || target === "vatReturn") {
      data.vatReturn = { disconnect: true };
    }
    if (target === "all" || target === "itsaSubmission") {
      data.itsaSubmission = { disconnect: true };
    }
    const saved = await this.repo.update(document.id, data);
    const next = await this.repo.update(saved.id, { attachedTo: this.syncAttachedTo(saved) as unknown as Prisma.InputJsonValue });
    await this.audit.record({
      actor: user,
      clientId: document.clientId,
      actionType: "document.detached",
      resourceType: "document",
      resourceId: document.id,
      beforeData: { attachedTo: document.attachedTo as Record<string, unknown> },
      afterData: { attachedTo: this.syncAttachedTo(next) },
      metadata: { documentId: document.id, target },
    });
    return next;
  }

  syncAttachedTo(row: {
    clientId: string;
    bankTransactionId?: string | null;
    invoiceId?: string | null;
    billId?: string | null;
    journalEntryId?: string | null;
    vatReturnId?: string | null;
    itsaSubmissionId?: string | null;
  }) {
    return buildAttachedTo({
      clientId: row.clientId,
      bankTransactionId: row.bankTransactionId,
      invoiceId: row.invoiceId,
      billId: row.billId,
      journalEntryId: row.journalEntryId,
      vatReturnId: row.vatReturnId,
      itsaSubmissionId: row.itsaSubmissionId,
    });
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
