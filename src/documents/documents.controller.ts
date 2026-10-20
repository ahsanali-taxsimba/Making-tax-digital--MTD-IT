import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsInt, IsString, Min } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthUser } from "../common/types";
import { DocumentsService } from "./documents.service";

class CreateDocumentDto {
  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

@ApiTags("documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("clients/:id/documents")
export class DocumentsController {
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
