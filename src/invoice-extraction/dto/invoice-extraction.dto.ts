import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";

export class ExtractInvoiceQueryDto {
  @ApiPropertyOptional({ enum: ["sales", "purchase"] })
  @IsOptional()
  @IsIn(["sales", "purchase"])
  direction?: "sales" | "purchase";
}

export class ExtractedLineOverrideDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  net?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  vat?: number;
}

export class ConfirmExtractionDto {
  @ApiPropertyOptional({ enum: ["sales", "purchase"] })
  @IsOptional()
  @IsIn(["sales", "purchase"])
  direction?: "sales" | "purchase";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ type: [ExtractedLineOverrideDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedLineOverrideDto)
  lines?: ExtractedLineOverrideDto[];
}
