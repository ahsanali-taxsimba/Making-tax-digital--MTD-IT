import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsObject, IsOptional, IsUUID, ValidateNested } from "class-validator";

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
  @ValidateNested()
  @Type(() => CategorisationApplyOverrideDto)
  @IsObject()
  override?: CategorisationApplyOverrideDto;
}
