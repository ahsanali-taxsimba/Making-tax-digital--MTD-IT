import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsObject, IsOptional, IsString, ValidateIf } from "class-validator";

export class SubmitItsaUpdateDto {
  @ApiProperty()
  @IsString()
  businessId!: string;

  @ApiProperty()
  @IsString()
  taxYear!: string;

  @ApiProperty()
  @IsString()
  periodId!: string;

  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fromLedger?: boolean;

  @ApiPropertyOptional({ type: "object", additionalProperties: { type: "number" } })
  @ValidateIf((dto: SubmitItsaUpdateDto) => !dto.fromLedger)
  @IsObject()
  incomes?: Record<string, number>;

  @ApiPropertyOptional({ type: "object", additionalProperties: { type: "number" } })
  @ValidateIf((dto: SubmitItsaUpdateDto) => !dto.fromLedger)
  @IsObject()
  expenses?: Record<string, number>;
}

export class PreviewItsaUpdateDto {
  @ApiProperty()
  @IsString()
  businessId!: string;

  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;
}

export class SubmitEopsDto {
  @ApiProperty()
  @IsString()
  businessId!: string;

  @ApiProperty()
  @IsString()
  taxYear!: string;

  @ApiProperty()
  @IsString()
  typeOfBusiness!: string;

  @ApiProperty()
  @IsDateString()
  accountingPeriodStart!: string;

  @ApiProperty()
  @IsDateString()
  accountingPeriodEnd!: string;

  @ApiProperty()
  @IsBoolean()
  finalised!: boolean;
}

export class SubmitFinalDeclarationDto {
  @ApiProperty()
  @IsString()
  taxYear!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  calculationId?: string;

  @ApiProperty()
  @IsBoolean()
  finalised!: boolean;
}

export class CreateBusinessDto {
  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty()
  @IsString()
  tradingName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hmrcBusinessId?: string;
}
