import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { resolveScopedClientId } from "../common/tenancy";
import { AuthUser } from "../common/types";
import { DocumentsService } from "./documents.service";

class CreateDocumentDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  category?: string;
}

class DocumentClientQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;
}

@ApiTags("documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: DocumentClientQueryDto) {
    return this.documents.list(user, resolveScopedClientId(user, query.clientId));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentDto) {
    return this.documents.create(user, resolveScopedClientId(user, dto.clientId), dto);
  }
}

@ApiTags("documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("clients/:id/documents")
export class ClientDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.documents.list(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateDocumentDto) {
    return this.documents.create(user, id, dto);
  }
}
