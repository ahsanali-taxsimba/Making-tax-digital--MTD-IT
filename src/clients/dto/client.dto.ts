import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ClientType } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, Matches } from "class-validator";

export class CreateClientDto {
  @ApiProperty({ enum: ClientType })
  @IsEnum(ClientType)
  type!: ClientType;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{10}$/)
  utr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{9}$/)
  vatRegistrationNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  niNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nino?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

export class UpdateClientDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{10}$/)
  utr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{9}$/)
  vatRegistrationNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  niNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nino?: string;
}
