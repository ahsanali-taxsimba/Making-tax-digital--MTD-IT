import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { BillingService } from "./billing.service";
import { CheckoutDto, CompleteCheckoutDto, PortalDto } from "./dto/billing.dto";

@ApiTags("billing")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("plans")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
  @ApiOperation({ summary: "List enabled commercial plans from the billing catalog" })
  plans() {
    return this.billing.listPlans(true);
  }

  @Get("subscription")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
  @ApiOperation({ summary: "Current firm subscription, entitlements and active-client quantity" })
  subscription(@CurrentUser() user: AuthUser) {
    return this.billing.subscription(user);
  }

  @Get("invoices")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "VAT invoices for the signed-in firm" })
  invoices(@CurrentUser() user: AuthUser) {
    return this.billing.invoices(user);
  }

  @Post("checkout")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Start Stripe Checkout for a catalog plan" })
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.billing.checkout(user, dto);
  }

  @Post("checkout/complete")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Finalise Checkout after redirect (mock and live)" })
  complete(@CurrentUser() user: AuthUser, @Body() dto: CompleteCheckoutDto) {
    return this.billing.completeCheckout(user, dto.sessionId);
  }

  @Post("portal")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Open the Stripe Customer Portal for payment methods and invoices" })
  portal(@CurrentUser() user: AuthUser, @Body() dto: PortalDto) {
    return this.billing.portal(user, dto.returnUrl);
  }

  @Post("usage/sync")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Push the current active-client quantity to Stripe" })
  usage(@CurrentUser() user: AuthUser) {
    return this.billing.syncUsage(user.firmId).then((updated) => ({ updated }));
  }
}
