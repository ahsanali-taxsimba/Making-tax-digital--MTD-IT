import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID } from "class-validator";

export class HmrcOAuthStartQueryDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiPropertyOptional({ enum: ["sandbox", "live", "dev"] })
  @IsOptional()
  @IsIn(["sandbox", "live", "dev", "development", "SANDBOX", "LIVE"])
  environment?: string;

  @ApiPropertyOptional({ description: "When true, 302-redirect to the HMRC authorise URL" })
  @IsOptional()
  @IsIn(["true", "false"])
  redirect?: string;
}

export class HmrcOAuthStatusQueryDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiPropertyOptional({ enum: ["sandbox", "live"] })
  @IsOptional()
  @IsIn(["sandbox", "live", "dev", "development", "SANDBOX", "LIVE"])
  environment?: string;
}

export class HmrcOAuthDisconnectDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiPropertyOptional({ enum: ["sandbox", "live"] })
  @IsOptional()
  @IsIn(["sandbox", "live", "dev", "development", "SANDBOX", "LIVE"])
  environment?: string;
}

export class HmrcOAuthCallbackQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  environment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  redirect_uri?: string;

  @ApiPropertyOptional()
  @IsOptional()
  error?: string;

  @ApiPropertyOptional()
  @IsOptional()
  error_description?: string;
}
