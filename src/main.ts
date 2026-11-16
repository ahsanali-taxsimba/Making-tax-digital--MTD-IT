import { ConfigService } from "@nestjs/config";
import { createNestApp, logListen } from "./create-app";

async function bootstrap() {
  const app = await createNestApp();
  const port = app.get(ConfigService).get<number>("port") ?? 3000;
  await app.listen(port);
  logListen(app, port);
}

void bootstrap();
