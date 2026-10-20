import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClientsModule } from "../clients/clients.module";
import { InvoiceDetectionService } from "./ocr/invoice-detection.service";
import { MerchantDetectionService } from "./ocr/merchant-detection.service";
import { OCRParserService } from "./ocr/ocr-parser.service";
import { OcrFeedService } from "./ocr/ocr-feed.service";
import { VATDetectionService } from "./ocr/vat-detection.service";
import { OCRService } from "./ocr.service";
import { ReceiptAttachmentService } from "./receipt-attachment.service";
import { ReceiptsController } from "./receipts.controller";
import { ReceiptsRepository } from "./receipts.repository";
import { ReceiptsService } from "./receipts.service";
import { LocalReceiptStorage } from "./storage/local-receipt-storage";
import { RECEIPT_STORAGE, ReceiptStorage } from "./storage/receipt-storage";
import { S3ReceiptStorage } from "./storage/s3-receipt-storage";

@Module({
  imports: [ClientsModule],
  controllers: [ReceiptsController],
  providers: [
    ReceiptsRepository,
    OCRParserService,
    MerchantDetectionService,
    VATDetectionService,
    InvoiceDetectionService,
    OCRService,
    OcrFeedService,
    ReceiptAttachmentService,
    ReceiptsService,
    LocalReceiptStorage,
    S3ReceiptStorage,
    {
      provide: RECEIPT_STORAGE,
      inject: [ConfigService, LocalReceiptStorage, S3ReceiptStorage],
      useFactory: (config: ConfigService, local: LocalReceiptStorage, s3: S3ReceiptStorage): ReceiptStorage =>
        config.get("receipts.driver") === "s3" ? s3 : local,
    },
  ],
  exports: [ReceiptsService, ReceiptAttachmentService, OCRService, OcrFeedService, RECEIPT_STORAGE],
})
export class ReceiptsModule {}
