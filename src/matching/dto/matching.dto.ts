import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MatchingDocumentKind } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsUUID, Max, Min } from "class-validator";

export class MatchingSuggestionsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bankTransactionId?: string;

  @ApiPropertyOptional({ description: "Persist suggestions (default true)" })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  persist?: boolean;

  @ApiPropertyOptional({ description: "Minimum confidence 0–1 (default 0.45)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence?: number;
}

export class MatchingApplyDto {
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
  documentId?: string;

  @ApiPropertyOptional({ enum: MatchingDocumentKind })
  @IsOptional()
  @IsEnum(MatchingDocumentKind)
  documentKind?: MatchingDocumentKind;
}

export class MatchingRejectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  suggestionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bankTransactionId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  reason?: string;
}
