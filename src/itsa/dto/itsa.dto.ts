import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsObject, IsOptional, IsString, IsUUID, ValidateIf } from "class-validator";

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

export class ValidateItsaDto {
  @ApiPropertyOptional({ enum: ["quarterly", "eops", "final", "year"] })
  @IsOptional()
  @IsIn(["quarterly", "eops", "final", "year"])
  kind?: "quarterly" | "eops" | "final" | "year";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxYear?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodId?: string;

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

  @ApiPropertyOptional({ type: "object", additionalProperties: { type: "number" } })
  @IsOptional()
  @IsObject()
  incomes?: Record<string, number>;

  @ApiPropertyOptional({ type: "object", additionalProperties: { type: "number" } })
  @IsOptional()
  @IsObject()
  expenses?: Record<string, number>;
}

export class ItsaClientQueryDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;
}

export class ItsaEngineQuarterlyDto extends SubmitItsaUpdateDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;
}

export class ItsaEngineEopsDto extends SubmitEopsDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;
}

export class ItsaEngineFinalDto extends SubmitFinalDeclarationDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;
}

export class ItsaValidateQueryDto extends ValidateItsaDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;
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
