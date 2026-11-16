import { Injectable, Logger } from "@nestjs/common";
import { Prisma, WebhookEventType } from "@prisma/client";
import { createHmac } from "crypto";
import { AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

const BACKOFF_SECONDS = [60, 300, 900, 3600, 21600];

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async emit(firmId: string, eventType: WebhookEventType, payload: Record<string, unknown>) {
    const event = await this.prisma.webhookEvent.create({
      data: { firmId, eventType, payload: payload as Prisma.InputJsonValue },
    });
    await this.deliver(event.id);
    return this.prisma.webhookEvent.findUnique({ where: { id: event.id } });
  }

  async retryUndelivered(maxAttempts = 5): Promise<number> {
    const pending = await this.prisma.webhookEvent.findMany({
      where: { deliveredAt: null, attempts: { lt: maxAttempts } },
      take: 50,
      orderBy: { createdAt: "asc" },
    });
    const now = Date.now();
    let retried = 0;
    for (const event of pending) {
      if (!this.isDue(event.createdAt, event.attempts, now)) {
        continue;
      }
      await this.deliver(event.id);
      retried += 1;
    }
    return retried;
  }

  createEndpoint(user: AuthUser, url: string, events: WebhookEventType[]) {
    return this.prisma.webhookEndpoint.create({
      data: { firmId: user.firmId, url, events },
    });
  }

  list(user: AuthUser) {
    return this.prisma.webhookEndpoint.findMany({ where: { firmId: user.firmId } });
  }

  private async deliver(eventId: string) {
    const event = await this.prisma.webhookEvent.findUnique({ where: { id: eventId } });
    if (!event || event.deliveredAt) {
      return event;
    }
    const firm = await this.prisma.firm.findUnique({ where: { id: event.firmId } });
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { firmId: event.firmId, active: true, events: { has: event.eventType } },
    });
    if (!firm || endpoints.length === 0) {
      return event;
    }
    const body = JSON.stringify({
      id: event.id,
      type: this.publicType(event.eventType),
      createdAt: event.createdAt.toISOString(),
      data: event.payload,
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", firm.webhookSecret).update(`${timestamp}.${body}`).digest("hex");
    let delivered = false;
    let lastError: string | null = null;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-MTD-Event": this.publicType(event.eventType),
            "X-MTD-Timestamp": timestamp,
            "X-MTD-Signature": `sha256=${signature}`,
          },
          body,
        });
        if (response.ok) {
          delivered = true;
        } else {
          lastError = `HTTP ${response.status}`;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : "delivery failed";
        this.logger.warn(`Webhook delivery failed for ${endpoint.url}`);
      }
    }
    return this.prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        attempts: { increment: 1 },
        deliveredAt: delivered ? new Date() : undefined,
        lastError: delivered ? null : lastError,
      },
    });
  }

  private isDue(createdAt: Date, attempts: number, now: number): boolean {
    const waitSeconds = BACKOFF_SECONDS.slice(0, Math.max(attempts, 1)).reduce((sum, item) => sum + item, 0);
    return createdAt.getTime() + waitSeconds * 1000 <= now;
  }

  private publicType(event: WebhookEventType): string {
    const map: Record<WebhookEventType, string> = {
      CLIENT_CREATED: "client.created",
      MTD_CONNECTION_CREATED: "mtd.connection.created",
      VAT_RETURN_SUBMITTED: "vat.return.submitted",
      ITSA_UPDATE_SUBMITTED: "itsa.update.submitted",
    };
    return map[event];
  }
}
