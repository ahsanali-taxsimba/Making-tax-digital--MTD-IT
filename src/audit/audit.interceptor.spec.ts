import { ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import { UserRole } from "@prisma/client";
import { AuditInterceptor } from "./audit.interceptor";

describe("AuditInterceptor", () => {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const interceptor = new AuditInterceptor(audit as never);
  const actor = {
    id: "u1",
    email: "james@northbridge.test",
    name: "James",
    role: UserRole.ACCOUNTANT,
    firmId: "firm-a",
    clientId: "client-1",
  };
  const next = { handle: () => of({ ok: true }) };

  beforeEach(() => {
    jest.clearAllMocks();
    audit.log.mockResolvedValue(undefined);
  });

  function context(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
  }

  async function flush() {
    await new Promise((resolve) => setImmediate(resolve));
  }

  it("logs mutating firm requests after they succeed", async () => {
    await lastValueFrom(
      interceptor.intercept(
        context({
          method: "POST",
          originalUrl: "/vat/returns?clientId=client-1",
          user: actor,
          params: { id: "vat-1", clientId: "client-1" },
        }),
        next,
      ),
    );
    await flush();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        firmId: "firm-a",
        clientId: "client-1",
        action: "vat.post",
        resourceId: "vat-1",
        metadata: { method: "POST", path: "/vat/returns" },
      }),
    );
  });

  it("skips reads, health, docs, audit export and unauthenticated calls", async () => {
    await lastValueFrom(interceptor.intercept(context({ method: "GET", originalUrl: "/vat/returns", user: actor }), next));
    await lastValueFrom(interceptor.intercept(context({ method: "POST", originalUrl: "/health/ready", user: actor }), next));
    await lastValueFrom(interceptor.intercept(context({ method: "POST", originalUrl: "/audit/export", user: actor }), next));
    await lastValueFrom(interceptor.intercept(context({ method: "POST", originalUrl: "/vat/returns" }), next));
    await flush();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
