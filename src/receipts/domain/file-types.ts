export const RECEIPT_TYPES = {
  jpg: { ext: "jpg", mime: "image/jpeg" },
  jpeg: { ext: "jpg", mime: "image/jpeg" },
  png: { ext: "png", mime: "image/png" },
  pdf: { ext: "pdf", mime: "application/pdf" },
} as const;

export const MAX_RECEIPT_BYTES = 12 * 1024 * 1024;

export type ReceiptFileType = "jpg" | "png" | "pdf";

export function detectReceiptType(fileName: string, contentType?: string, sniff?: Buffer): ReceiptFileType | null {
  const name = fileName.trim().toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  if (ext === "jpg" || ext === "jpeg") {
    return "jpg";
  }
  if (ext === "png" || ext === "pdf") {
    return ext;
  }
  const mime = (contentType ?? "").toLowerCase();
  if (mime === "image/jpeg") {
    return "jpg";
  }
  if (mime === "image/png") {
    return "png";
  }
  if (mime === "application/pdf") {
    return "pdf";
  }
  if (sniff && sniff.length >= 4) {
    if (sniff[0] === 0xff && sniff[1] === 0xd8) {
      return "jpg";
    }
    if (sniff[0] === 0x89 && sniff[1] === 0x50 && sniff[2] === 0x4e && sniff[3] === 0x47) {
      return "png";
    }
    if (sniff.subarray(0, 4).toString("ascii") === "%PDF") {
      return "pdf";
    }
  }
  return null;
}

export function mimeFor(type: ReceiptFileType): string {
  return RECEIPT_TYPES[type].mime;
}

export function decodeUploadContent(raw: string): Buffer {
  const cleaned = raw.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  return Buffer.from(cleaned, "base64");
}
