import { SecretsService } from "./secrets.service";

describe("SecretsService", () => {
  it("treats short and placeholder secrets as weak", () => {
    const service = new SecretsService({ get: () => "development" } as never);
    expect(service.isWeak("short")).toBe(true);
    expect(service.isWeak("change-me-access-secret-at-least-32-chars")).toBe(true);
    expect(service.isWeak("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
  });
});
