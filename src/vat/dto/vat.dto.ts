import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, ValidateIf } from "class-validator";

export class SubmitVatReturnDto {
  @ApiProperty()
  @IsString()
  periodKey!: string;

  @ApiPropertyOptional({ enum: ["GB", "NI"] })
  @IsOptional()
  @IsIn(["GB", "NI"])
  region?: "GB" | "NI";

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fromLedger?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: SubmitVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  vatDueSales?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: SubmitVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  vatDueAcquisitions?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: SubmitVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  totalVatDue?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: SubmitVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  vatReclaimedCurrPeriod?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: SubmitVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  netVatDue?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: SubmitVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  totalValueSalesExVAT?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: SubmitVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  totalValuePurchasesExVAT?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: SubmitVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  totalValueGoodsSuppliedExVAT?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: SubmitVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  totalAcquisitionsExVAT?: number;

  @ApiProperty()
  @IsBoolean()
  finalised!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  obligationId?: string;
}

export class PreviewVatReturnDto {
  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodKey?: string;

  @ApiPropertyOptional({ enum: ["GB", "NI"] })
  @IsOptional()
  @IsIn(["GB", "NI"])
  region?: "GB" | "NI";
}

export class ValidateVatReturnDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fromLedger?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional({ enum: ["GB", "NI"] })
  @IsOptional()
  @IsIn(["GB", "NI"])
  region?: "GB" | "NI";

  @ApiPropertyOptional()
  @ValidateIf((dto: ValidateVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  vatDueSales?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: ValidateVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  vatDueAcquisitions?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: ValidateVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  totalVatDue?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: ValidateVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  vatReclaimedCurrPeriod?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: ValidateVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  netVatDue?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: ValidateVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  totalValueSalesExVAT?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: ValidateVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  totalValuePurchasesExVAT?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: ValidateVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  totalValueGoodsSuppliedExVAT?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: ValidateVatReturnDto) => !dto.fromLedger)
  @IsNumber()
  totalAcquisitionsExVAT?: number;
}
