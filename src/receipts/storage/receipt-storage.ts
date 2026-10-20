export interface ReceiptStorage {
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

export const RECEIPT_STORAGE = "RECEIPT_STORAGE";
