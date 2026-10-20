import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { LoginDto, LogoutDto, MfaChallengeDto, MfaVerifyDto, RefreshDto } from "./dto/auth.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Password login for firm staff and client portal users" })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post("refresh")
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Post("mfa/setup")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Start TOTP enrollment for a privileged login challenge" })
  setupMfa(@Body() dto: MfaChallengeDto) {
    return this.auth.setupMfa(dto.mfaChallengeToken);
  }

  @Post("mfa/confirm")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Confirm TOTP enrollment and issue tokens" })
  confirmMfa(@Body() dto: MfaVerifyDto) {
    return this.auth.confirmMfa(dto.mfaChallengeToken, dto.code);
  }

  @Post("mfa/verify")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Verify TOTP for a privileged login challenge" })
  verifyMfa(@Body() dto: MfaVerifyDto) {
    return this.auth.verifyMfa(dto.mfaChallengeToken, dto.code);
  }

  @Get("sso/providers")
  ssoProviders() {
    return this.auth.ssoProviders();
  }

  @Post("sso/callback")
  @HttpCode(501)
  ssoCallback() {
    return {
      data: null,
      error: { code: "SSO_NOT_CONFIGURED", message: "OAuth2 / SSO is a reserved placeholder" },
    };
  }
}
