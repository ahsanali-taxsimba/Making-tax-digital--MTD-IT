import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Min, ValidateIf } from "class-validator";

export class SubmitVatReturnDto {
  @ApiProperty()
  @IsString()
  periodKey!: string;

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
  @Min(0)
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
}
