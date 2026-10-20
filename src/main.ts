import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.use(helmet());
  app.enableCors({
    origin: config.get<string>("frontendOrigin") ?? true,
    credentials: true,
  });

  const swagger = new DocumentBuilder()
    .setTitle("Making Tax Digital IT API")
    .setDescription(
      "Multi-tenant MTD backend for VAT (Notice 700/12 boxes 1–9), Income Tax (ITSA), and double-entry bookkeeping",
    )
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>("port") ?? 3000;
  await app.listen(port);
  Logger.log(`MTD IT API listening on ${port} — OpenAPI at /docs`, "Bootstrap");
}

void bootstrap();
