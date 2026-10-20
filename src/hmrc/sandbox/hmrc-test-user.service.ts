import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { HmrcTestUserKind } from "@prisma/client";
import { readFileSync } from "fs";
import { AuditService } from "../../audit/audit.service";
import { TokenCryptoService } from "../../common/crypto/token-crypto.service";
import { AuthUser } from "../../common/types";
import { PrismaService } from "../../prisma/prisma.service";
import { HmrcAppConfigService } from "../oauth/hmrc-app-config.service";
import { HmrcOAuthService } from "../oauth/hmrc-oauth.service";
import { HMRC_SANDBOX_API_BASE } from "./hmrc-sandbox.urls";

export interface CreateSandboxTestUserInput {
  type: "organisation" | "individual";
  services?: string[];
  clientId?: string;
}

interface StoredTestUserFile {
  type?: string;
  kind?: string;
  userId?: string;
  hmrcUserId?: string;
  password?: string;
  vrn?: string;
  nino?: string;
  saUtr?: string;
  mtdItId?: string;
  ctUtr?: string;
  services?: string[];
  clientId?: string;
}

@Injectable()
export class HmrcTestUserService implements OnModuleInit {
  private readonly logger = new Logger(HmrcTestUserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: TokenCryptoService,
    private readonly apps: HmrcAppConfigService,
    private readonly audit: AuditService,
    private readonly oauth: HmrcOAuthService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadFromFile();
  }

  async create(user: AuthUser, input: CreateSandboxTestUserInput) {
    const kind = input.type === "organisation" ? HmrcTestUserKind.ORGANISATION : HmrcTestUserKind.INDIVIDUAL;
    const services =
      input.services?.length ? input.services : kind === HmrcTestUserKind.ORGANISATION ? ["mtd-vat"] : ["mtd-income-tax"];
    const created = this.apps.callsHmrc()
      ? await this.createUpstream(kind, services)
      : this.mockUser(kind, services);
    const saved = await this.prisma.hmrcSandboxTestUser.create({
      data: {
        kind,
        hmrcUserId: created.userId,
        passwordEnc: this.crypto.encrypt(created.password),
        vrn: created.vrn,
        nino: created.nino,
        saUtr: created.saUtr,
        mtdItId: created.mtdItId,
        ctUtr: created.ctUtr,
        eoriNumber: created.eoriNumber,
        services,
        clientId: input.clientId,
        rawPayload: created.raw as object,
      },
    });
    await this.audit.record({
      actor: user,
      clientId: input.clientId,
      actionType: "hmrc.sandbox.test_user.created",
      resourceType: "hmrc_sandbox_test_user",
      resourceId: saved.id,
      metadata: { kind, services, sandbox: true, hmrcUserId: saved.hmrcUserId },
    });
    return this.present(saved, created.password);
  }

  async list() {
    const rows = await this.prisma.hmrcSandboxTestUser.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((row) => this.present(row));
  }

  async get(id: string, revealPassword = false) {
    const row = await this.prisma.hmrcSandboxTestUser.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException("Sandbox test user not found");
    }
    return this.present(row, revealPassword ? this.crypto.decrypt(row.passwordEnc) : undefined);
  }

  async loginHint(user: AuthUser, id: string, clientId?: string) {
    const row = await this.get(id, true);
    let authorizationUrl: string | undefined;
    if (clientId) {
      const started = await this.oauth.startAuth(user, clientId, "sandbox");
      authorizationUrl = started.authorizationUrl;
    }
    await this.audit.record({
      actor: user,
      clientId: clientId ?? row.clientId,
      actionType: "hmrc.sandbox.test_user.login",
      resourceType: "hmrc_sandbox_test_user",
      resourceId: id,
      metadata: { hmrcUserId: row.hmrcUserId, sandbox: true },
    });
    return {
      ...row,
      authorizationUrl,
      grantHost: this.apps.sandboxAuthBase(),
      tokenUrl: `${this.apps.sandboxApiBase()}/oauth/token`,
      instructions:
        "Open authorizationUrl, sign in with the sandbox test userId and password on the HMRC grant screen, then approve VAT/ITSA scopes.",
    };
  }

  async loadFromFile(): Promise<number> {
    const file = this.apps.testUsersFile();
    if (!file) {
      return 0;
    }
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as StoredTestUserFile[] | { users?: StoredTestUserFile[] };
      const users = Array.isArray(parsed) ? parsed : (parsed.users ?? []);
      let count = 0;
      for (const item of users) {
        const hmrcUserId = item.hmrcUserId ?? item.userId;
        const password = item.password;
        if (!hmrcUserId || !password) {
          continue;
        }
        const kind =
          String(item.type ?? item.kind ?? "").toLowerCase() === "organisation"
            ? HmrcTestUserKind.ORGANISATION
            : HmrcTestUserKind.INDIVIDUAL;
        const existing = await this.prisma.hmrcSandboxTestUser.findFirst({ where: { hmrcUserId } });
        if (existing) {
          continue;
        }
        await this.prisma.hmrcSandboxTestUser.create({
          data: {
            kind,
            hmrcUserId,
            passwordEnc: this.crypto.encrypt(password),
            vrn: item.vrn,
            nino: item.nino,
            saUtr: item.saUtr,
            mtdItId: item.mtdItId,
            ctUtr: item.ctUtr,
            services: item.services ?? [],
            clientId: item.clientId,
            rawPayload: item as object,
          },
        });
        count += 1;
      }
      if (count) {
        this.logger.log(`Loaded ${count} HMRC sandbox test user(s) from ${file}`);
      }
      return count;
    } catch (error) {
      this.logger.warn(`Could not load HMRC sandbox test users from ${file}`);
      return 0;
    }
  }

  private present(
    row: {
      id: string;
      kind: HmrcTestUserKind;
      hmrcUserId: string;
      vrn: string | null;
      nino: string | null;
      saUtr: string | null;
      mtdItId: string | null;
      ctUtr: string | null;
      eoriNumber: string | null;
      services: string[];
      clientId: string | null;
      createdAt: Date;
    },
    password?: string,
  ) {
    return {
      id: row.id,
      type: row.kind === HmrcTestUserKind.ORGANISATION ? "organisation" : "individual",
      hmrcUserId: row.hmrcUserId,
      userId: row.hmrcUserId,
      password,
      vrn: row.vrn,
      nino: row.nino,
      saUtr: row.saUtr,
      mtdItId: row.mtdItId,
      ctUtr: row.ctUtr,
      eoriNumber: row.eoriNumber,
      services: row.services,
      clientId: row.clientId,
      createdAt: row.createdAt,
    };
  }

  private mockUser(kind: HmrcTestUserKind, services: string[]) {
    if (kind === HmrcTestUserKind.ORGANISATION) {
      return {
        userId: "sandbox-org-user",
        password: "SandboxOrgPass1!",
        vrn: "888888888",
        nino: undefined,
        saUtr: "1234567890",
        mtdItId: undefined,
        ctUtr: "1111111111",
        eoriNumber: undefined,
        services,
        raw: { mock: true, kind },
      };
    }
    return {
      userId: "sandbox-ind-user",
      password: "SandboxIndPass1!",
      vrn: undefined,
      nino: "AA123456A",
      saUtr: "2234567890",
      mtdItId: "XMIT12345678901",
      ctUtr: undefined,
      eoriNumber: undefined,
      services,
      raw: { mock: true, kind },
    };
  }

  private async createUpstream(kind: HmrcTestUserKind, services: string[]) {
    const token = await this.clientCredentials();
    const path =
      kind === HmrcTestUserKind.ORGANISATION ? "/create-test-user/organisations" : "/create-test-user/individuals";
    const response = await fetch(new URL(path, this.apps.sandboxApiBase() || HMRC_SANDBOX_API_BASE), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.hmrc.1.0+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ serviceNames: services }),
    });
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new BadRequestException({
        message: "HMRC create-test-user failed",
        status: response.status,
        details: json,
      });
    }
    const userId = String(json.userId ?? json.userID ?? "");
    const password = String(json.password ?? "");
    if (!userId || !password) {
      throw new BadRequestException("HMRC create-test-user did not return credentials");
    }
    return {
      userId,
      password,
      vrn: optionalString(json.vrn),
      nino: optionalString(json.nino),
      saUtr: optionalString(json.saUtr),
      mtdItId: optionalString(json.mtdItId),
      ctUtr: optionalString(json.ctUtr),
      eoriNumber: optionalString(json.eoriNumber),
      services,
      raw: json,
    };
  }

  private async clientCredentials(): Promise<string> {
    const app = this.apps.requireSettings("sandbox", true);
    const payload = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: app.clientId,
      client_secret: app.clientSecret,
      scope: "create-user",
    });
    const response = await fetch(new URL("/oauth/token", app.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
    });
    const json = (await response.json().catch(() => ({}))) as { access_token?: string };
    if (!response.ok || !json.access_token) {
      throw new BadRequestException("HMRC client-credentials grant for create-user failed");
    }
    return json.access_token;
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
