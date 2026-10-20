import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/types";
import { assertClientScope } from "../common/tenancy";
import { ChartOfAccountsService } from "../ledger/chart-of-accounts.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { ClientsRepository } from "./clients.repository";
import { CreateClientDto, UpdateClientDto } from "./dto/client.dto";

@Injectable()
export class ClientsService {
  constructor(
    private readonly repo: ClientsRepository,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
    private readonly charts: ChartOfAccountsService,
  ) {}

  list(user: AuthUser) {
    const scopedId = user.role === UserRole.CLIENT ? user.clientId : undefined;
    return this.repo.list(user.firmId, scopedId);
  }

  async me(user: AuthUser) {
    if (user.clientId) {
      return this.get(user, user.clientId);
    }
    const clients = await this.list(user);
    if (!clients.length) {
      throw new NotFoundException("No client is linked to this account");
    }
    return clients[0];
  }

  async get(user: AuthUser, id: string) {
    const client = await this.repo.findInFirm(user.firmId, id);
    if (!client) {
      throw new NotFoundException("Client not found");
    }
    assertClientScope(user, client);
    return client;
  }

  async create(user: AuthUser, dto: CreateClientDto) {
    const assignedUserId = dto.assignedUserId ? await this.requireStaff(user.firmId, dto.assignedUserId) : undefined;
    const client = await this.repo.create({
      firm: { connect: { id: user.firmId } },
      type: dto.type,
      name: dto.name,
      utr: dto.utr,
      vatRegistrationNumber: dto.vatRegistrationNumber,
      vatRegion: dto.vatRegion,
      niNumber: dto.niNumber,
      nino: dto.nino ?? dto.niNumber,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      riskLevel: dto.riskLevel,
      assignedUser: assignedUserId ? { connect: { id: assignedUserId } } : undefined,
    });
    await this.charts.provision(client.id, client.type);
    await this.audit.record({ actor: user, clientId: client.id, actionType: "client.created", metadata: { name: client.name } });
    await this.webhooks.emit(user.firmId, "CLIENT_CREATED", { clientId: client.id, name: client.name });
    return client;
  }

  async update(user: AuthUser, id: string, dto: UpdateClientDto) {
    const client = await this.get(user, id);
    const assignedUserId =
      dto.assignedUserId === undefined
        ? undefined
        : dto.assignedUserId === null
          ? null
          : await this.requireStaff(user.firmId, dto.assignedUserId);
    const updated = await this.repo.update(client.id, {
      name: dto.name,
      utr: dto.utr,
      vatRegistrationNumber: dto.vatRegistrationNumber,
      vatRegion: dto.vatRegion,
      niNumber: dto.niNumber,
      nino: dto.nino,
      riskLevel: dto.riskLevel,
      assignedUser:
        assignedUserId === undefined
          ? undefined
          : assignedUserId === null
            ? { disconnect: true }
            : { connect: { id: assignedUserId } },
    });
    await this.audit.record({ actor: user, clientId: id, actionType: "client.updated" });
    return updated;
  }

  async remove(user: AuthUser, id: string) {
    await this.get(user, id);
    await this.repo.delete(id);
    await this.audit.record({ actor: user, clientId: id, actionType: "client.deleted" });
    return { deleted: true };
  }

  private async requireStaff(firmId: string, userId: string) {
    const staff = await this.repo.findStaff(firmId, userId);
    if (!staff) {
      throw new BadRequestException("Assigned accountant must be a staff member in this firm");
    }
    return staff.id;
  }
}
