import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClientsModule } from "../clients/clients.module";
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
    OCRService,
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
  exports: [ReceiptsService, ReceiptAttachmentService, OCRService],
})
export class ReceiptsModule {}
