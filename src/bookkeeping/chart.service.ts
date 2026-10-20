import { Injectable, NotFoundException } from "@nestjs/common";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { decorateAccountWithItsa } from "../itsa/mtd-itsa.mapping";
import { ChartOfAccountsService } from "../ledger/chart-of-accounts.service";
import { decorateAccountWithVat } from "../vat/vat-box.mapping";
import { BookkeepingRepository } from "./bookkeeping.repository";
import { CreateChartAccountDto, PatchChartAccountDto } from "./dto/bookkeeping.dto";

@Injectable()
export class BookkeepingChartService {
  constructor(
    private readonly repo: BookkeepingRepository,
    private readonly clients: ClientsService,
    private readonly charts: ChartOfAccountsService,
  ) {}

  async list(user: AuthUser, clientId?: string, profile?: string) {
    const templates = await this.repo.listChart(profile);
    const decorated = templates.map((account) =>
      decorateAccountWithVat(decorateAccountWithItsa(account)),
    );
    if (!clientId) {
      return { templates: decorated };
    }
    await this.clients.get(user, clientId);
    const ledgers = await this.repo.listLedgers(clientId, profile);
    return {
      templates: decorated,
      ledgers: ledgers.map((account) => decorateAccountWithVat(decorateAccountWithItsa(account))),
    };
  }

  async create(user: AuthUser, dto: CreateChartAccountDto) {
    const created = await this.repo.createChart({
      code: dto.code,
      name: dto.name,
      type: dto.type,
      profile: dto.profile,
      isActive: dto.isActive ?? true,
    });
    if (dto.clientId) {
      await this.clients.get(user, dto.clientId);
      await this.charts.applyProfile(dto.clientId, dto.profile);
    }
    return created;
  }

  async patch(user: AuthUser, id: string, dto: PatchChartAccountDto) {
    const existing = await this.repo.findChart(id);
    if (!existing) {
      throw new NotFoundException("Chart of account not found");
    }
    void user;
    return this.repo.updateChart(id, { name: dto.name, isActive: dto.isActive });
  }

  async createPeriod(user: AuthUser, dto: { clientId: string; start: string; end: string; locked?: boolean }) {
    const client = await this.clients.get(user, dto.clientId);
    return this.repo.createPeriod({
      firm: { connect: { id: client.firmId } },
      client: { connect: { id: client.id } },
      start: this.repo.toDate(dto.start),
      end: this.repo.toDate(dto.end),
      locked: dto.locked ?? false,
    });
  }

  async listPeriods(user: AuthUser, clientId: string) {
    await this.clients.get(user, clientId);
    return this.repo.listPeriods(clientId);
  }

  async lockPeriodForClient(user: AuthUser, clientId: string, id: string) {
    await this.clients.get(user, clientId);
    return this.repo.lockPeriod(id);
  }
}
