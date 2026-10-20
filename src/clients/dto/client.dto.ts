import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ClientType, RiskLevel } from "@prisma/client";
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID, Matches, ValidateIf } from "class-validator";

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

  @ApiPropertyOptional({ enum: ["GB", "NI"] })
  @IsOptional()
  @IsIn(["GB", "NI"])
  vatRegion?: "GB" | "NI";

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

  @ApiPropertyOptional({ enum: RiskLevel })
  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;
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

  @ApiPropertyOptional({ enum: ["GB", "NI"] })
  @IsOptional()
  @IsIn(["GB", "NI"])
  vatRegion?: "GB" | "NI";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  niNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nino?: string;

  @ApiPropertyOptional({ enum: RiskLevel })
  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assignedUserId?: string | null;
}
