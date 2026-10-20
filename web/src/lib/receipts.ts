import { apiFetch } from "./api";

export interface ReceiptRecord {
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
  uploadedAt: string;
  tags: string[];
  ocrText?: string | null;
  ocrMerchant?: string | null;
  ocrAmount?: number | null;
  ocrDate?: string | null;
  status: "uploaded" | "processed";
  proofAvailable: boolean;
}

export interface ReceiptEvidence {
  receiptsAttached: number;
  vat: { box4: { items: number; withProof: number; proofAttached: boolean } };
  itsa: { attached: number; allowableExpenses: number; allowableExpensesWithReceipt: number };
}

export function listReceipts(clientId: string) {
  return apiFetch<{ receipts: ReceiptRecord[]; count: number }>(`/receipts?clientId=${clientId}`);
}

export function listBankTransactionReceipts(id: string) {
  return apiFetch<{ receipts: ReceiptRecord[]; count: number }>(`/bank-transactions/${id}/receipts`);
}

export function listInvoiceReceipts(id: string) {
  return apiFetch<{ receipts: ReceiptRecord[]; count: number }>(`/invoices/${id}/receipts`);
}

export function listBillReceipts(id: string) {
  return apiFetch<{ receipts: ReceiptRecord[]; count: number }>(`/bills/${id}/receipts`);
}

export function receiptEvidence(clientId: string) {
  return apiFetch<ReceiptEvidence>(`/receipts/evidence?clientId=${clientId}`);
}

export function uploadReceipt(input: {
  clientId: string;
  fileName: string;
  content: string;
  mimeType?: string;
  bankTransactionId?: string;
  invoiceId?: string;
  billId?: string;
  journalEntryId?: string;
  tags?: string[];
}) {
  return apiFetch<ReceiptRecord>("/receipts/upload", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function detachReceipt(id: string) {
  return apiFetch<ReceiptRecord>(`/receipts/${id}/detach`, { method: "POST" });
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.slice(value.indexOf(",") + 1) : value);
    };
    reader.onerror = () => reject(new Error("Unable to read receipt file"));
    reader.readAsDataURL(file);
  });
}

export function receiptKindLabel(fileType: string): string {
  return fileType === "pdf" ? "PDF" : fileType.toUpperCase();
}
