import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";

export class CategorisationSuggestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bankTransactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  receiptId?: string;

  @ApiPropertyOptional({ description: "Raw OCR text to classify without a stored receipt" })
  @IsOptional()
  @IsString()
  ocrText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  merchantName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  merchantCategoryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ enum: ["CREDIT", "DEBIT"] })
  @IsOptional()
  @IsIn(["CREDIT", "DEBIT"])
  type?: "CREDIT" | "DEBIT";

  @ApiPropertyOptional({ description: "Persist suggestions (default true)" })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  persist?: boolean;
}

export class CategorisationApplyOverrideDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ledgerAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taxCodeId?: string;
}

export class CategorisationApplyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  suggestionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bankTransactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  receiptId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CategorisationApplyOverrideDto)
  @IsObject()
  override?: CategorisationApplyOverrideDto;
}
