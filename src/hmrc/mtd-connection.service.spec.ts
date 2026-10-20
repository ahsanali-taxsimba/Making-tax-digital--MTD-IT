import { MtdConnectionService } from "./mtd-connection.service";

describe("MtdConnectionService", () => {
  const oauth = {
    startAuth: jest.fn().mockResolvedValue({ authorizationUrl: "https://hmrc.test/oauth/authorize", state: "s" }),
    handleCallback: jest.fn().mockResolvedValue({ connected: true }),
    status: jest.fn(),
    getCallContext: jest.fn(),
    getValidAccessToken: jest.fn(),
    getConnectionStatus: jest.fn(),
    startAuthUrl: jest.fn().mockReturnValue("https://hmrc.test/oauth/authorize"),
  };
  const service = new MtdConnectionService(oauth as never);

  it("delegates start-auth to the reusable HMRC OAuth service", async () => {
    const user = { id: "u1" } as never;
    const result = await service.startAuth(user, "client-1");
    expect(oauth.startAuth).toHaveBeenCalledWith(user, "client-1", undefined);
    expect(result.authorizationUrl).toContain("hmrc.test");
  });
});
