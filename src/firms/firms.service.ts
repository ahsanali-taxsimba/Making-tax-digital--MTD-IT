import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/types";
import { UpdateFirmDto } from "./dto/firm.dto";

@Injectable()
export class FirmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async me(user: AuthUser) {
    const firm = await this.prisma.firm.findUnique({ where: { id: user.firmId } });
    if (!firm) {
      throw new NotFoundException("Firm not found");
    }
    return this.publicFirm(firm);
  }

  async updateMe(user: AuthUser, dto: UpdateFirmDto) {
    const firm = await this.prisma.firm.update({
      where: { id: user.firmId },
      data: dto,
    });
    await this.audit.record({ actor: user, actionType: "firm.updated", metadata: { ...dto } });
    return this.publicFirm(firm);
  }

  private publicFirm(firm: { webhookSecret: string } & Record<string, unknown>) {
    const { webhookSecret: _secret, ...rest } = firm;
    return rest;
  }
}
