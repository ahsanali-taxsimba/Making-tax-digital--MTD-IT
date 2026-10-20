import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { UserRole, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/types";
import { CreateUserDto, UpdateUserDto } from "./dto/user.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser) {
    const users = await this.prisma.user.findMany({
      where: { firmId: user.firmId },
      orderBy: { createdAt: "asc" },
    });
    return users.map(this.publicUser);
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException("Email already in use");
    }
    if (dto.role === UserRole.CLIENT && !dto.clientId) {
      throw new BadRequestException("Client portal users must be linked to a client");
    }
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : null;
    const created = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        role: dto.role,
        firmId: actor.firmId,
        clientId: dto.clientId,
        passwordHash,
        status: passwordHash ? UserStatus.ACTIVE : UserStatus.INVITED,
      },
    });
    await this.audit.record({ actor, actionType: "user.created", metadata: { userId: created.id, role: created.role } });
    return this.publicUser(created);
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const user = await this.requireFirmUser(actor.firmId, id);
    if (id === actor.id && dto.status && dto.status !== UserStatus.ACTIVE) {
      throw new BadRequestException("You cannot deactivate your own account");
    }
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: dto.name,
        status: dto.status,
        role: dto.role,
        passwordHash,
      },
    });
    await this.audit.record({ actor, actionType: "user.updated", metadata: { userId: id, status: dto.status, role: dto.role } });
    return this.publicUser(updated);
  }

  async remove(actor: AuthUser, id: string) {
    if (id === actor.id) {
      throw new BadRequestException("You cannot delete your own account");
    }
    await this.requireFirmUser(actor.firmId, id);
    await this.prisma.user.delete({ where: { id } });
    await this.audit.record({ actor, actionType: "user.deleted", metadata: { userId: id } });
    return { deleted: true };
  }

  private async requireFirmUser(firmId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, firmId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  private publicUser(user: { passwordHash?: string | null } & Record<string, unknown>) {
    const { passwordHash: _hash, ...rest } = user;
    return rest;
  }
}
