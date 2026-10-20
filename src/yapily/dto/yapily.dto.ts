import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID } from "class-validator";

export class YapilyConsentStartDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiPropertyOptional({ example: "modelo-sandbox" })
  @IsOptional()
  @IsString()
  institutionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  callback?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  redirect?: boolean;
}

export class YapilyConsentStatusQueryDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;
}

export class YapilyConsentCallbackQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  consent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  institutionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error_description?: string;
}

export class YapilyAccountsQueryDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;
}

export class YapilyTransactionsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: "Create draft bank-feed journals and match invoices/bills" })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  autoPost?: boolean;
}
