import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  app.set("trust proxy", 1);
  app.use(helmet());
  app.enableCors({
    origin: config.get<string>("frontendOrigin") ?? true,
    credentials: true,
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "x-mtd-hmrc-environment",
      "x-mtd-hmrc-sandbox",
      "x-mtd-fraud-prevention",
      "Gov-Test-Scenario",
    ],
    exposedHeaders: ["x-mtd-hmrc-mode", "x-mtd-hmrc-environment", "x-mtd-hmrc-sandbox"],
  });

  if (config.get<boolean>("swaggerEnabled") !== false) {
    const swagger = new DocumentBuilder()
      .setTitle("Making Tax Digital IT API")
      .setDescription(
        [
          "Multi-tenant MTD backend for VAT, Income Tax (ITSA), double-entry bookkeeping, HMRC OAuth2, and a Yapily bank-feed pipeline (consent, sync, enrichment, categorisation, invoice/bill matching, reconciliation, journals, VAT/ITSA).",
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
  }

  const port = config.get<number>("port") ?? 3000;
  await app.listen(port);
  Logger.log(`MTD IT API listening on ${port} — OpenAPI at /docs`, "Bootstrap");
}

void bootstrap();
