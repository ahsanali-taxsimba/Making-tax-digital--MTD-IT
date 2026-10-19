import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class SubmitVatReturnDto {
  @ApiProperty()
  @IsString()
  periodKey!: string;

  @ApiProperty()
  @IsNumber()
  vatDueSales!: number;

  @ApiProperty()
  @IsNumber()
  vatDueAcquisitions!: number;

  @ApiProperty()
  @IsNumber()
  totalVatDue!: number;

  @ApiProperty()
  @IsNumber()
  vatReclaimedCurrPeriod!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  netVatDue!: number;

  @ApiProperty()
  @IsNumber()
  totalValueSalesExVAT!: number;

  @ApiProperty()
  @IsNumber()
  totalValuePurchasesExVAT!: number;

  @ApiProperty()
  @IsNumber()
  totalValueGoodsSuppliedExVAT!: number;

  @ApiProperty()
  @IsNumber()
  totalAcquisitionsExVAT!: number;

  @ApiProperty()
  @IsBoolean()
  finalised!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  obligationId?: string;
}
