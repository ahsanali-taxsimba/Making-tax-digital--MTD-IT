import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthUser } from "../common/types";
import { PlatformAuthGuard } from "../authorization/platform-auth.guard";
import { BillingAdminService } from "./billing-admin.service";
import { CreatePlanDto, UpsertPlanDto } from "./dto/billing.dto";

@ApiTags("admin-billing")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAuthGuard)
@Controller("admin/billing")
export class BillingAdminController {
  constructor(private readonly admin: BillingAdminService) {}

  @Get("metrics")
  @ApiOperation({ summary: "MRR, recognised revenue, VAT collected and active subscribers" })
  metrics(@CurrentUser() user: AuthUser) {
    return this.admin.metrics(user);
  }

  @Get("subscribers")
  @ApiOperation({ summary: "Active billing subscribers (firm name and plan only — no client records)" })
  subscribers(@CurrentUser() user: AuthUser) {
    return this.admin.subscribers(user);
  }

  @Get("plans")
  @ApiOperation({ summary: "Full plan catalog including disabled rows" })
  plans(@CurrentUser() user: AuthUser) {
    return this.admin.listPlans(user);
  }

  @Post("plans")
  @ApiOperation({ summary: "Add a commercial plan without a code change" })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePlanDto) {
    return this.admin.createPlan(user, dto);
  }

  @Patch("plans/:id")
  @ApiOperation({ summary: "Edit price, features or enable/disable a plan" })
  update(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: UpsertPlanDto) {
    return this.admin.updatePlan(user, id, dto);
  }
}
