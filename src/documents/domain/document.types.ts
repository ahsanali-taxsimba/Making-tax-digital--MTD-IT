import { DocumentKind } from "@prisma/client";

export const DOCUMENT_KINDS = ["receipt", "invoice", "bill", "contract", "statement", "hmrc_letter"] as const;
export type PublicDocumentKind = (typeof DOCUMENT_KINDS)[number];

export const KIND_TO_PRISMA: Record<PublicDocumentKind, DocumentKind> = {
  receipt: DocumentKind.RECEIPT,
  invoice: DocumentKind.INVOICE,
  bill: DocumentKind.BILL,
  contract: DocumentKind.CONTRACT,
  statement: DocumentKind.STATEMENT,
  hmrc_letter: DocumentKind.HMRC_LETTER,
};

export const PRISMA_TO_KIND: Record<DocumentKind, PublicDocumentKind> = {
  RECEIPT: "receipt",
  INVOICE: "invoice",
  BILL: "bill",
  CONTRACT: "contract",
  STATEMENT: "statement",
  HMRC_LETTER: "hmrc_letter",
};

export interface DocumentAttachmentMap {
  clientId: string;
  bankTransactionId?: string | null;
  invoiceId?: string | null;
  billId?: string | null;
  journalEntryId?: string | null;
  vatReturnId?: string | null;
  itsaSubmissionId?: string | null;
}

export interface DocumentSearchHit {
  id: string;
  fileName: string;
  type: PublicDocumentKind;
  ocrText?: string | null;
  tags: string[];
  ocrMerchant?: string | null;
  score: number;
}

export function parseDocumentKind(value?: string | null): DocumentKind | null {
  if (!value) {
    return null;
  }
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_") as PublicDocumentKind;
  return KIND_TO_PRISMA[key] ?? null;
}

export function publicKind(value: DocumentKind): PublicDocumentKind {
  return PRISMA_TO_KIND[value];
}

export function buildAttachedTo(input: DocumentAttachmentMap): DocumentAttachmentMap {
  return {
    clientId: input.clientId,
    bankTransactionId: input.bankTransactionId ?? null,
    invoiceId: input.invoiceId ?? null,
    billId: input.billId ?? null,
    journalEntryId: input.journalEntryId ?? null,
    vatReturnId: input.vatReturnId ?? null,
    itsaSubmissionId: input.itsaSubmissionId ?? null,
  };
}
