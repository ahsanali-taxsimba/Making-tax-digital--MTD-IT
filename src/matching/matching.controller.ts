import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { MatchingApplyDto, MatchingRejectDto, MatchingSuggestionsQueryDto } from "./dto/matching.dto";
import { MatchingService } from "./matching.service";

@ApiTags("matching")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
@Controller("matching")
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Get("suggestions")
  @ApiOperation({ summary: "Suggest invoice/bill matches for unmatched Yapily bank lines" })
  suggestions(@CurrentUser() user: AuthUser, @Query() query: MatchingSuggestionsQueryDto) {
    return this.matching.suggestions(user, query);
  }

  @Post("apply")
  @ApiOperation({ summary: "Apply a match and post a bank settlement journal" })
  apply(@CurrentUser() user: AuthUser, @Body() dto: MatchingApplyDto) {
    return this.matching.apply(user, dto);
  }

  @Post("reject")
  @ApiOperation({ summary: "Reject a suggested invoice or bill match" })
  reject(@CurrentUser() user: AuthUser, @Body() dto: MatchingRejectDto) {
    return this.matching.reject(user, dto);
  }
}
