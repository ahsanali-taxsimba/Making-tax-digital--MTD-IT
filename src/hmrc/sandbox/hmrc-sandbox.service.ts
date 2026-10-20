import { Injectable } from "@nestjs/common";
import { HmrcEnvironment } from "@prisma/client";
import { HmrcAppConfigService } from "../oauth/hmrc-app-config.service";
import { liveUrlCatalog, sandboxUrlCatalog } from "./hmrc-sandbox.urls";

@Injectable()
export class HmrcSandboxService {
  constructor(private readonly apps: HmrcAppConfigService) {}

  status() {
    const mode = this.apps.mode();
    const environment = this.apps.defaultEnvironment();
    const sandbox = this.apps.sandboxFlag();
    return {
      mode,
      environment,
      sandbox,
      callsHmrc: this.apps.callsHmrc(),
      gateway: {
        sandboxFlag: sandbox,
        header: "x-mtd-hmrc-sandbox",
      },
      urls: {
        sandbox: sandboxUrlCatalog(),
        live: liveUrlCatalog(),
        active: sandbox ? sandboxUrlCatalog() : liveUrlCatalog(),
      },
      app: {
        sandbox: this.redact(this.apps.settings(HmrcEnvironment.SANDBOX)),
        live: this.redact(this.apps.settings(HmrcEnvironment.LIVE)),
      },
    };
  }

  private redact(app: { clientId: string; redirectUri: string; baseUrl: string; authBaseUrl: string; authorizeUrl?: string }) {
    return {
      clientId: app.clientId ? `${app.clientId.slice(0, 4)}…` : "",
      configured: Boolean(app.clientId && app.redirectUri && app.baseUrl),
      redirectUri: app.redirectUri,
      baseUrl: app.baseUrl,
      authBaseUrl: app.authBaseUrl,
      authorizeUrl: app.authorizeUrl,
    };
  }
}
