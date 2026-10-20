import { ApiPropertyOptional } from "@nestjs/swagger";
import { BillingStatus, PlanType } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";

export class UpdateFirmDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ enum: PlanType })
  @IsOptional()
  @IsEnum(PlanType)
  planType?: PlanType;

  @ApiPropertyOptional({ enum: BillingStatus })
  @IsOptional()
  @IsEnum(BillingStatus)
  billingStatus?: BillingStatus;
}
