import { INestApplication, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { Express } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { applySupabaseEnv } from "./config/supabase";
import { assertProductionConfig, parseCorsOrigins } from "./config/validate-env";

export function frontendOriginsFromEnv(config: ConfigService): string[] | boolean {
  return parseCorsOrigins(config.get<string>("frontendOrigin"), config.get<string>("nodeEnv"));
}

export async function createNestApp(expressApp?: Express): Promise<INestApplication> {
  applySupabaseEnv();
  assertProductionConfig();
  const app = expressApp
    ? await NestFactory.create(AppModule, new ExpressAdapter(expressApp))
    : await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.use(helmet());
  app.enableCors({
    origin: frontendOriginsFromEnv(config),
    credentials: true,
  });

  const swagger = new DocumentBuilder()
    .setTitle("Making Tax Digital IT API")
    .setDescription(
      [
        "Multi-tenant MTD backend for VAT, Income Tax (ITSA), double-entry bookkeeping, and HMRC OAuth2 token management.",
        "",
        "VAT and ITSA never call HMRC directly. All HMRC HTTP goes through HmrcClientService (`get`, `post`, `getValidAccessToken`, `handleTokenRefresh`, `handleHMRCError`), which refreshes user-restricted tokens before they expire and retries once after a 401.",
        "",
        "Shared HMRC error codes: HMRC_ERR_TOKEN_EXPIRED, HMRC_ERR_TOKEN_REFRESH_FAILED, HMRC_ERR_UNAUTHORISED, HMRC_ERR_INVALID_SCOPE, HMRC_ERR_RATE_LIMIT, HMRC_ERR_SERVER, HMRC_ERR_BAD_REQUEST, HMRC_ERR_CONNECTION. Errors are returned as `{ data: null, error: { errorCode, message, details? } }`.",
      ].join(" "),
    )
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swagger));
  return app;
}

export function logListen(app: INestApplication, port: number): void {
  const config = app.get(ConfigService);
  Logger.log(
    `MTD IT API listening on ${port} — OpenAPI at /docs — database=${config.get("databaseProvider")} storage=${config.get("storage.driver")}`,
    "Bootstrap",
  );
}
