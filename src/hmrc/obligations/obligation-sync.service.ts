import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ObligationStatus } from "@prisma/client";
import { ItsaService } from "../../itsa/itsa.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { PrismaService } from "../../prisma/prisma.service";
import { VatService } from "../../vat/vat.service";
import { obligationSyncActor } from "./system-actor";

@Injectable()
export class ObligationSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ObligationSyncService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vat: VatService,
    private readonly itsa: ItsaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>("nodeEnv") === "test") {
      return;
    }
    const intervalMs = this.config.get<number>("hmrc.obligationSyncMs") ?? 900_000;
    this.timer = setInterval(() => {
      void this.tick();
    }, Number.isFinite(intervalMs) ? intervalMs : 900_000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick(): Promise<void> {
    try {
      const synced = await this.syncConnectedClients();
      const due = await this.notifyDue();
      if (synced > 0 || due > 0) {
        this.logger.log(`Obligation sync refreshed ${synced} client(s); due notices ${due}`);
      }
    } catch (error) {
      this.logger.warn(`Obligation sync failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  async syncConnectedClients(): Promise<number> {
    const connections = await this.prisma.mtdConnection.findMany({
      where: { disconnectedAt: null },
      include: { client: true },
    });
    const seen = new Set<string>();
    let count = 0;
    for (const connection of connections) {
      if (seen.has(connection.clientId)) {
        continue;
      }
      seen.add(connection.clientId);
      const ok = await this.syncClient(connection.client);
      if (ok) {
        count += 1;
      }
    }
    return count;
  }

  async notifyDue(): Promise<number> {
    const dueDays = this.config.get<number>("hmrc.obligationDueDays") ?? 14;
    const horizon = new Date(Date.now() + Math.max(dueDays, 0) * 86_400_000);
    const [vatRows, itsaRows] = await Promise.all([
      this.prisma.vatObligation.findMany({
        where: { status: ObligationStatus.OPEN, due: { lte: horizon }, dueNotifiedAt: null },
        include: { client: true },
        take: 200,
      }),
      this.prisma.itsaObligation.findMany({
        where: { status: ObligationStatus.OPEN, due: { lte: horizon }, dueNotifiedAt: null },
        include: { client: true },
        take: 200,
      }),
    ]);
    let sent = 0;
    for (const row of vatRows) {
      await this.notifications.notify({
        firmId: row.client.firmId,
        type: "OBLIGATION_DUE",
        title: `VAT return ${row.periodKey} is due`,
        body: `VAT obligation ${row.periodKey} for ${row.client.name} is due on ${row.due.toISOString().slice(0, 10)}.`,
        metadata: { clientId: row.clientId, obligationId: row.id, kind: "vat", periodKey: row.periodKey },
      });
      await this.prisma.vatObligation.update({ where: { id: row.id }, data: { dueNotifiedAt: new Date() } });
      sent += 1;
    }
    for (const row of itsaRows) {
      await this.notifications.notify({
        firmId: row.client.firmId,
        type: "OBLIGATION_DUE",
        title: `${row.type} ${row.taxYear} is due`,
        body: `Income Tax obligation ${row.type} ${row.taxYear} for ${row.client.name} is due on ${row.due.toISOString().slice(0, 10)}.`,
        metadata: {
          clientId: row.clientId,
          obligationId: row.id,
          kind: "itsa",
          type: row.type,
          taxYear: row.taxYear,
        },
      });
      await this.prisma.itsaObligation.update({ where: { id: row.id }, data: { dueNotifiedAt: new Date() } });
      sent += 1;
    }
    return sent;
  }

  private async syncClient(client: {
    id: string;
    firmId: string;
    vatRegistrationNumber: string | null;
    nino: string | null;
    niNumber: string | null;
  }): Promise<boolean> {
    const actor = obligationSyncActor(client.firmId, client.id);
    let synced = false;
    try {
      if (client.vatRegistrationNumber) {
        await this.vat.obligations(actor, client.id, { notifyFetched: false });
        synced = true;
      }
    } catch (error) {
      this.logger.warn(
        `VAT obligation sync failed for client ${client.id}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
    try {
      if (client.nino || client.niNumber) {
        await this.itsa.obligations(actor, client.id, { notifyFetched: false });
        synced = true;
      }
    } catch (error) {
      this.logger.warn(
        `ITSA obligation sync failed for client ${client.id}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
    return synced;
  }
}
