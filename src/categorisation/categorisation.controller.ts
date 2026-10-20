import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { BillingService } from "../billing/billing.service";
import { CategorisationService } from "./categorisation.service";
import { CategorisationApplyDto, CategorisationSuggestDto } from "./dto/categorisation.dto";

@ApiTags("categorisation")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
@Controller("categorisation")
export class CategorisationController {
  constructor(
    private readonly categorisation: CategorisationService,
    private readonly billing: BillingService,
  ) {}

  @Post("suggest")
  @ApiOperation({ summary: "Suggest chart-of-accounts, VAT and ITSA categories from bank lines, receipts, OCR and MCC" })
  async suggest(@CurrentUser() user: AuthUser, @Body() dto: CategorisationSuggestDto) {
    await this.billing.assertFeature(user.firmId, "ai_categorisation");
    return this.categorisation.suggest(user, dto);
  }

  @Post("apply")
  @ApiOperation({ summary: "Apply a categorisation suggestion and post a draft journal" })
  async apply(@CurrentUser() user: AuthUser, @Body() dto: CategorisationApplyDto) {
    await this.billing.assertFeature(user.firmId, "ai_categorisation");
    return this.categorisation.apply(user, dto);
  }

  @Get("rules")
  @ApiOperation({ summary: "Merchant dictionary, MCC mappings, VAT/ITSA rules and Naive Bayes model stats" })
  rules() {
    return this.categorisation.rules();
  }
}
