import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { ClientsService } from "../clients/clients.service";
import { FirmsService } from "./firms.service";

@ApiTags("firm-workspace")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("firm")
export class FirmWorkspaceController {
  constructor(
    private readonly firms: FirmsService,
    private readonly clients: ClientsService,
  ) {}

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.firms.me(user);
  }

  @Get("clients")
  clientsList(@CurrentUser() user: AuthUser) {
    return this.clients.list(user);
  }

  @Get("clients/:id")
  client(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.clients.get(user, id);
  }

  @Get("documents")
  documents(@CurrentUser() user: AuthUser) {
    return this.firms.workspaceDocuments(user);
  }

  @Get("vat/returns")
  vatReturns(@CurrentUser() user: AuthUser) {
    return this.firms.workspaceVatReturns(user);
  }

  @Get("itsa/submissions")
  itsaSubmissions(@CurrentUser() user: AuthUser) {
    return this.firms.workspaceItsaSubmissions(user);
  }
}
