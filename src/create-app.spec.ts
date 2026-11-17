import { parseCorsOrigins } from "./config/validate-env";
import { frontendOriginsFromEnv } from "./create-app";

describe("frontendOriginsFromEnv", () => {
  it("splits FRONTEND_ORIGIN including a Vercel web host", () => {
    const origin = frontendOriginsFromEnv({
      get: (key: string) =>
        key === "frontendOrigin" ? "https://app.taxsimba.test,https://mtd-web-abc.vercel.app" : "production",
    } as never);
    expect(origin).toEqual(["https://app.taxsimba.test", "https://mtd-web-abc.vercel.app"]);
  });

  it("refuses an empty origin list in production", () => {
    expect(parseCorsOrigins("", "production")).toBe(false);
  });
});
