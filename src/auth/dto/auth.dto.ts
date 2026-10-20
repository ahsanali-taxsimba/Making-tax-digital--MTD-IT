import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "marco.r@example.org" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "PracticeAdmin123!" })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class MfaChallengeDto {
  @ApiProperty()
  @IsString()
  mfaChallengeToken!: string;
}

export class MfaVerifyDto {
  @ApiProperty()
  @IsString()
  mfaChallengeToken!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @MinLength(6)
  code!: string;
}
