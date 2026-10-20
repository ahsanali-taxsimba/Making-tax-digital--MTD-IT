import { Injectable } from "@nestjs/common";
import { AuthUser } from "../common/types";
import { HmrcCallContext } from "./hmrc.types";
import { HmrcOAuthService } from "./oauth/hmrc-oauth.service";

@Injectable()
export class MtdConnectionService {
  constructor(private readonly oauth: HmrcOAuthService) {}

  startAuth(user: AuthUser, clientId: string, environment?: string) {
    return this.oauth.startAuth(user, clientId, environment);
  }

  handleCallback(query: { code?: string; state?: string; error?: string; error_description?: string }) {
    return this.oauth.handleCallback(query);
  }

  status(user: AuthUser, clientId: string, environment?: string) {
    return this.oauth.status(user, clientId, environment);
  }

  getCallContext(clientId: string, environment?: string): Promise<HmrcCallContext> {
    return this.oauth.getCallContext(clientId, environment);
  }

  getValidAccessToken(clientId: string, environment: "sandbox" | "live") {
    return this.oauth.getValidAccessToken(clientId, environment);
  }

  getConnectionStatus(clientId: string, environment: string) {
    return this.oauth.getConnectionStatus(clientId, environment);
  }

  startAuthUrl(clientId: string, environment: string) {
    return this.oauth.startAuthUrl(clientId, environment);
  }
}
