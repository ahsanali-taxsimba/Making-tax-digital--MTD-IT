import { WebhooksService } from "./webhooks.service";

describe("WebhooksService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("retries an undelivered event that is past backoff", async () => {
    const event = {
      id: "evt-1",
      firmId: "firm-1",
      eventType: "CLIENT_CREATED",
      payload: { clientId: "c1" },
      createdAt: new Date(Date.now() - 120_000),
      attempts: 1,
      deliveredAt: null,
    };
    const prisma = {
      webhookEvent: {
        findMany: jest.fn().mockResolvedValue([event]),
        findUnique: jest.fn().mockResolvedValue(event),
        update: jest.fn().mockResolvedValue({ ...event, attempts: 2, deliveredAt: new Date() }),
      },
      firm: { findUnique: jest.fn().mockResolvedValue({ id: "firm-1", webhookSecret: "secret" }) },
      webhookEndpoint: {
        findMany: jest.fn().mockResolvedValue([{ url: "https://example.test/hook", active: true }]),
      },
    };
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;
    const service = new WebhooksService(prisma as never);
    const retried = await service.retryUndelivered(5);
    expect(retried).toBe(1);
    expect(global.fetch).toHaveBeenCalled();
  });
});
