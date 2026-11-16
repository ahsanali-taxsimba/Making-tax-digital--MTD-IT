import { Controller, Get, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_PORT, StoragePort } from "../storage/storage.types";

@ApiTags("health")
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", service: "mtd-it-api" };
  }

  @Get("ready")
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    const storageReady = await this.storage.ready();
    const storageDriver = this.config.get<string>("storage.driver") ?? "local";
    const databaseProvider = this.config.get<string>("databaseProvider") ?? "local";
    const supabaseConfigured = Boolean(this.config.get<boolean>("supabase.configured"));
    const degraded = !storageReady || (storageDriver === "supabase" && !supabaseConfigured);
    return {
      status: degraded ? "degraded" : "ok",
      service: "mtd-it-api",
      checks: {
        database: { status: "ok", provider: databaseProvider },
        storage: {
          driver: storageDriver,
          ready: storageReady,
        },
        supabase: {
          configured: supabaseConfigured,
          projectRef: this.config.get<string>("supabase.projectRef") ?? null,
        },
        hmrcMode: this.config.get<string>("hmrc.mode") ?? "mock",
      },
    };
  }
}
