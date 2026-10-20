import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsOptional, IsString, IsUUID } from "class-validator";

export class UploadReceiptDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiProperty({ example: "bp-fuel.pdf" })
  @IsString()
  fileName!: string;

  @ApiProperty({ description: "Base64-encoded JPG, PNG, or PDF" })
  @IsString()
  content!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: "Optional OCR hint or extracted text" })
  @IsOptional()
  @IsString()
  ocrText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bankTransactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  billId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  journalEntryId?: string;
}

export class ReceiptsQueryDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;
}

export class ReceiptEvidenceQueryDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodEnd?: string;
}

export class UpdateReceiptTagsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  tags!: string[];
}

export class OptionalClientQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  preview?: boolean;
}
