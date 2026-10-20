import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, ValidateIf } from "class-validator";

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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box1?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box3?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box4?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box5?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box6?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box7?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box8?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box9?: number;
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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box1?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box3?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box4?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box5?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box6?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box7?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box8?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box9?: number;
}

export class VatClientQueryDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;
}

export class VatEngineSubmitDto extends SubmitVatReturnDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;
}

export class VatValidateQueryDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  fromLedger?: boolean;

  @ApiPropertyOptional({ enum: ["GB", "NI"] })
  @IsOptional()
  @IsIn(["GB", "NI"])
  region?: "GB" | "NI";

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box1?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box3?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box4?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box5?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box6?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box7?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box8?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  box9?: number;
}
