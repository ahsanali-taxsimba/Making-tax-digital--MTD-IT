import { Injectable } from "@nestjs/common";
import { extractPdfText, OcrExtraction, parseReceiptText } from "./domain/ocr";
import { ReceiptFileType } from "./domain/file-types";

@Injectable()
export class OCRService {
  extract(input: { fileType: ReceiptFileType; buffer: Buffer; hint?: string; fileName?: string }): OcrExtraction {
    const parts = [input.hint ?? "", input.fileName ?? ""];
    if (input.fileType === "pdf") {
      parts.push(extractPdfText(input.buffer));
    }
    return parseReceiptText(parts.filter(Boolean).join("\n"));
  }
}
