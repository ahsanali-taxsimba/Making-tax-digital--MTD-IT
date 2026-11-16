import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { systemActor } from "../common/system-actor";
import { ItsaService } from "../itsa/itsa.service";
import { PrismaService } from "../prisma/prisma.service";
import { VatService } from "../vat/vat.service";

@Injectable()
export class ObligationSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ObligationSyncService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vat: VatService,
    private readonly itsa: ItsaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>("nodeEnv") === "test") {
      return;
    }
    const intervalMs = this.config.get<number>("jobs.obligationSyncMs") ?? 900_000;
    this.timer = setInterval(() => {
      void this.tick();
    }, Number.isFinite(intervalMs) ? intervalMs : 900_000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick(): Promise<{ vat: number; itsa: number; failed: number }> {
    const connections = await this.prisma.mtdConnection.findMany({
      where: { disconnectedAt: null },
      include: { client: true },
    });
    let vat = 0;
    let itsa = 0;
    let failed = 0;
    for (const connection of connections) {
      const actor = systemActor(connection.client.firmId);
      try {
        if (connection.client.vatRegistrationNumber) {
          await this.vat.obligations(actor, connection.client.id, { notify: false });
          vat += 1;
        }
        if (connection.client.nino || connection.client.niNumber) {
          await this.itsa.obligations(actor, connection.client.id, { notify: false });
          itsa += 1;
        }
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `Obligation sync failed for client ${connection.clientId}: ${error instanceof Error ? error.message : "unknown"}`,
        );
      }
    }
    if (vat || itsa || failed) {
      this.logger.log(`Obligation sync complete (vat=${vat} itsa=${itsa} failed=${failed})`);
    }
    return { vat, itsa, failed };
  }
}
