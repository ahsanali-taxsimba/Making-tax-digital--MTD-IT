import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuthUser } from "../../common/types";
import { HmrcSandboxService } from "./hmrc-sandbox.service";
import { HmrcTestUserService } from "./hmrc-test-user.service";

class SwitchHmrcEnvironmentDto {
  @IsOptional()
  @IsBoolean()
  sandbox?: boolean;

  @IsOptional()
  @IsIn(["sandbox", "live", "SANDBOX", "LIVE"])
  environment?: string;
}

class CreateSandboxTestUserDto {
  @IsIn(["organisation", "individual"])
  type!: "organisation" | "individual";

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services?: string[];

  @IsOptional()
  @IsUUID()
  clientId?: string;
}

@ApiTags("hmrc-sandbox")
@Controller("hmrc")
export class HmrcSandboxController {
  constructor(
    private readonly sandbox: HmrcSandboxService,
    private readonly testUsers: HmrcTestUserService,
  ) {}

  @Get("environment")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: "HMRC sandbox vs live environment switcher and URL catalog" })
  environment() {
    return this.sandbox.status();
  }

  @Post("environment")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Switch HMRC calls between sandbox and live (`sandbox=true` forces test-api URLs)" })
  switchEnvironment(@Body() dto: SwitchHmrcEnvironmentDto) {
    return this.sandbox.switchTo(dto);
  }

  @Get("sandbox/status")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: "API Gateway sandbox mode flag and active HMRC hosts" })
  sandboxStatus() {
    return this.sandbox.status();
  }

  @Get("sandbox/test-users")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "List stored HMRC sandbox test users" })
  listTestUsers() {
    return this.testUsers.list();
  }

  @Post("sandbox/test-users")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: "Create an HMRC sandbox organisation (VAT) or individual (ITSA) test user" })
  createTestUser(@CurrentUser() user: AuthUser, @Body() dto: CreateSandboxTestUserDto) {
    return this.testUsers.create(user, dto);
  }

  @Get("sandbox/test-users/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  getTestUser(@Param("id", ParseUUIDPipe) id: string, @Query("reveal") reveal?: string) {
    return this.testUsers.get(id, reveal === "true");
  }

  @Post("sandbox/test-users/:id/login")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Return sandbox test-user credentials and the HMRC grant URL" })
  login(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { clientId?: string },
  ) {
    return this.testUsers.loginHint(user, id, body.clientId);
  }
}
