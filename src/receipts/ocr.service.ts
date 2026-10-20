import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { extractPdfText, parseReceiptText } from "./domain/ocr";
import { ReceiptFileType } from "./domain/file-types";
import { extractRawText } from "./ocr/extractors";
import { InvoiceDetectionService } from "./ocr/invoice-detection.service";
import { MerchantDetectionService } from "./ocr/merchant-detection.service";
import { OCRParserService } from "./ocr/ocr-parser.service";
import { OcrExtraction } from "./ocr/ocr.types";
import { VATDetectionService } from "./ocr/vat-detection.service";

@Injectable()
export class OCRService {
  constructor(
    private readonly parser: OCRParserService = new OCRParserService(),
    private readonly merchants: MerchantDetectionService = new MerchantDetectionService(),
    private readonly vat: VATDetectionService = new VATDetectionService(),
    private readonly invoices: InvoiceDetectionService = new InvoiceDetectionService(),
    private readonly config?: ConfigService,
  ) {}

  async extract(input: { fileType: ReceiptFileType; buffer: Buffer; hint?: string; fileName?: string }): Promise<OcrExtraction> {
    const raw = await extractRawText({
      ...input,
      driver: this.config?.get("ocr.driver") ?? "auto",
      endpoint: this.config?.get("ocr.endpoint") ?? "",
      apiKey: this.config?.get("ocr.apiKey") ?? "",
      timeoutMs: this.config?.get("ocr.timeoutMs") ?? 8000,
    });
    return {
      ...parseReceiptText(raw.text, { parser: this.parser, merchants: this.merchants, vat: this.vat, invoices: this.invoices }),
      source: raw.source,
    };
  }

  parse(text: string): OcrExtraction {
    return parseReceiptText(text, { parser: this.parser, merchants: this.merchants, vat: this.vat, invoices: this.invoices });
  }

  pdfText(buffer: Buffer): string {
    return extractPdfText(buffer);
  }
}
