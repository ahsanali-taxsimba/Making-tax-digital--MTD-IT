import { Injectable, Logger } from "@nestjs/common";
import { Prisma, WebhookEventType } from "@prisma/client";
import { createHmac } from "crypto";
import { AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async emit(firmId: string, eventType: WebhookEventType, payload: Record<string, unknown>) {
    const event = await this.prisma.webhookEvent.create({
      data: { firmId, eventType, payload: payload as Prisma.InputJsonValue },
    });
    const firm = await this.prisma.firm.findUnique({ where: { id: firmId } });
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { firmId, active: true, events: { has: eventType } },
    });
    if (!firm || endpoints.length === 0) {
      return event;
    }
    const body = JSON.stringify({
      id: event.id,
      type: this.publicType(eventType),
      createdAt: event.createdAt.toISOString(),
      data: payload,
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", firm.webhookSecret).update(`${timestamp}.${body}`).digest("hex");
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-MTD-Event": this.publicType(eventType),
            "X-MTD-Timestamp": timestamp,
            "X-MTD-Signature": `sha256=${signature}`,
          },
          body,
        });
        await this.prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            attempts: { increment: 1 },
            deliveredAt: response.ok ? new Date() : undefined,
            lastError: response.ok ? null : `HTTP ${response.status}`,
          },
        });
      } catch (error) {
        this.logger.warn(`Webhook delivery failed for ${endpoint.url}`);
        await this.prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            attempts: { increment: 1 },
            lastError: error instanceof Error ? error.message : "delivery failed",
          },
        });
      }
    }
    return event;
  }

  createEndpoint(user: AuthUser, url: string, events: WebhookEventType[]) {
    return this.prisma.webhookEndpoint.create({
      data: { firmId: user.firmId, url, events },
    });
  }

  list(user: AuthUser) {
    return this.prisma.webhookEndpoint.findMany({ where: { firmId: user.firmId } });
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
