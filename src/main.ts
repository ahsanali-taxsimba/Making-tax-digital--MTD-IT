import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { applySupabaseEnv } from "./config/supabase";
import { assertProductionConfig, parseCorsOrigins } from "./config/validate-env";

async function bootstrap() {
  const database = applySupabaseEnv();
  assertProductionConfig();
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.use(helmet());
  app.enableCors({
    origin: parseCorsOrigins(config.get<string>("frontendOrigin"), config.get<string>("nodeEnv")),
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

  const port = config.get<number>("port") ?? 3000;
  await app.listen(port);
  const storageDriver = config.get<string>("storage.driver") ?? "local";
  Logger.log(
    `MTD IT API listening on ${port} — OpenAPI at /docs — database=${database.provider} storage=${storageDriver}`,
    "Bootstrap",
  );
}

void bootstrap();
