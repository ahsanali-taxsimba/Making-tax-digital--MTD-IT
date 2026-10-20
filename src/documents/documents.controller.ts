import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { resolveScopedClientId } from "../common/tenancy";
import { AuthUser } from "../common/types";
import { DocumentsService } from "./documents.service";
import {
  AttachDocumentDto,
  DetachDocumentDto,
  DocumentsQueryDto,
  DocumentSearchQueryDto,
  UpdateDocumentTagsDto,
  UploadDocumentDto,
} from "./dto/documents.dto";

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

const StaffAndClient = [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT, UserRole.CLIENT] as const;

@ApiTags("documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...StaffAndClient)
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post("upload")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: "Upload a JPG, PNG, or PDF document, store it, and run OCR" })
  upload(@CurrentUser() user: AuthUser, @Body() dto: UploadDocumentDto) {
    return this.documents.upload(user, dto);
  }

  @Get("search")
  @ApiOperation({ summary: "Search documents by OCR text, file name, merchant, or tags" })
  search(@CurrentUser() user: AuthUser, @Query() query: DocumentSearchQueryDto) {
    return this.documents.search(user, query);
  }

  @Get("tags")
  @ApiOperation({ summary: "Document tag catalog" })
  tags() {
    return this.documents.listTags();
  }

  @Get()
  @ApiOperation({ summary: "List documents in the client library" })
  listLibrary(@CurrentUser() user: AuthUser, @Query() query: DocumentsQueryDto) {
    return this.documents.listLibrary(user, { ...query, clientId: resolveScopedClientId(user, query.clientId) });
  }

  @Post()
  @ApiOperation({ summary: "Register a pending supporting-document metadata record" })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentDto) {
    return this.documents.create(user, resolveScopedClientId(user, dto.clientId), dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a document, OCR text, tags, and attachments" })
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.documents.get(user, id);
  }

  @Get(":id/file")
  @ApiOperation({ summary: "Preview or download the stored document" })
  async file(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const file = await this.documents.preview(user, id);
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `inline; filename="${file.fileName}"`);
    response.send(file.buffer);
  }

  @Post(":id/attach")
  @ApiOperation({ summary: "Attach a document to a bank line, invoice, bill, journal, VAT return, or ITSA submission" })
  attach(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: AttachDocumentDto) {
    return this.documents.attach(user, id, dto);
  }

  @Post(":id/detach")
  @ApiOperation({ summary: "Detach a document from bookkeeping records" })
  detach(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: DetachDocumentDto) {
    return this.documents.detach(user, id, dto.target);
  }

  @Patch(":id/tags")
  @ApiOperation({ summary: "Replace document tags" })
  updateTags(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentTagsDto) {
    return this.documents.updateTags(user, id, dto);
  }

  @Post(":id/ocr/reprocess")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: "Re-run OCR extraction on a stored document" })
  reprocess(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.documents.reprocessOcr(user, id);
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
