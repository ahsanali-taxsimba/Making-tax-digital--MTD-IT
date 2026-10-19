import { Injectable, NotFoundException } from "@nestjs/common";
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

  async get(user: AuthUser, id: string) {
    const client = await this.repo.findInFirm(user.firmId, id);
    if (!client) {
      throw new NotFoundException("Client not found");
    }
    assertClientScope(user, client);
    return client;
  }

  async create(user: AuthUser, dto: CreateClientDto) {
    const client = await this.repo.create({
      firm: { connect: { id: user.firmId } },
      type: dto.type,
      name: dto.name,
      utr: dto.utr,
      vatRegistrationNumber: dto.vatRegistrationNumber,
      niNumber: dto.niNumber,
      nino: dto.nino ?? dto.niNumber,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    });
    await this.charts.provision(client.id, client.type);
    await this.audit.record({ actor: user, clientId: client.id, actionType: "client.created", metadata: { name: client.name } });
    await this.webhooks.emit(user.firmId, "CLIENT_CREATED", { clientId: client.id, name: client.name });
    return client;
  }

  async update(user: AuthUser, id: string, dto: UpdateClientDto) {
    const client = await this.get(user, id);
    const updated = await this.repo.update(client.id, {
      name: dto.name,
      utr: dto.utr,
      vatRegistrationNumber: dto.vatRegistrationNumber,
      niNumber: dto.niNumber,
      nino: dto.nino,
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
}
