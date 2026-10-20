import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BookkeepingModule } from "../bookkeeping/bookkeeping.module";
import { CategorisationModule } from "../categorisation/categorisation.module";
import { ClientsModule } from "../clients/clients.module";
import { TokenCryptoService } from "../common/crypto/token-crypto.service";
import { MatchingModule } from "../matching/matching.module";
import { BankFeedPipelineService } from "./bank-feed-pipeline.service";
import { LiveYapilyGateway } from "./yapily.live";
import { MockYapilyGateway } from "./yapily.mock";
import { YapilyController } from "./yapily.controller";
import { YapilyHttpClient } from "./yapily.http";
import { YapilyRepository } from "./yapily.repository";
import { YapilyService } from "./yapily.service";
import { YAPILY_GATEWAY } from "./yapily.tokens";
import { YapilyGateway } from "./yapily.types";

@Module({
  imports: [ClientsModule, BookkeepingModule, CategorisationModule, MatchingModule],
  controllers: [YapilyController],
  providers: [
    TokenCryptoService,
    YapilyHttpClient,
    YapilyRepository,
    MockYapilyGateway,
    LiveYapilyGateway,
    YapilyService,
    BankFeedPipelineService,
    {
      provide: YAPILY_GATEWAY,
      inject: [ConfigService, MockYapilyGateway, LiveYapilyGateway],
      useFactory: (config: ConfigService, mock: MockYapilyGateway, live: LiveYapilyGateway): YapilyGateway =>
        config.get("yapily.mode") === "live" ? live : mock,
    },
  ],
  exports: [YapilyService, BankFeedPipelineService],
})
export class YapilyModule {}
