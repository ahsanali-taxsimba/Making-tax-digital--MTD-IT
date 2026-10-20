import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import { DOCUMENT_KINDS } from "../domain/document.types";

export class UploadDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiProperty({ example: "hmrc-letter.pdf" })
  @IsString()
  fileName!: string;

  @ApiProperty({ description: "Base64-encoded JPG, PNG, or PDF" })
  @IsString()
  content!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ enum: DOCUMENT_KINDS })
  @IsOptional()
  @IsIn([...DOCUMENT_KINDS])
  type?: (typeof DOCUMENT_KINDS)[number];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vatReturnId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itsaSubmissionId?: string;
}

export class DocumentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ enum: DOCUMENT_KINDS })
  @IsOptional()
  @IsIn([...DOCUMENT_KINDS])
  type?: (typeof DOCUMENT_KINDS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tag?: string;
}

export class DocumentSearchQueryDto {
  @ApiProperty()
  @IsString()
  q!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ enum: DOCUMENT_KINDS })
  @IsOptional()
  @IsIn([...DOCUMENT_KINDS])
  type?: (typeof DOCUMENT_KINDS)[number];
}

export class AttachDocumentDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vatReturnId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itsaSubmissionId?: string;
}

export class DetachDocumentDto {
  @ApiPropertyOptional({ enum: ["bankTransaction", "invoice", "bill", "journal", "vatReturn", "itsaSubmission", "all"] })
  @IsOptional()
  @IsIn(["bankTransaction", "invoice", "bill", "journal", "vatReturn", "itsaSubmission", "all"])
  target?: "bankTransaction" | "invoice" | "bill" | "journal" | "vatReturn" | "itsaSubmission" | "all";
}

export class UpdateDocumentTagsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  tags!: string[];
}
