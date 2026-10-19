import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClientsModule } from "../clients/clients.module";
import { TokenCryptoService } from "../common/crypto/token-crypto.service";
import { HmrcHttpClient } from "./hmrc.http";
import { LiveHmrcItsaGateway, LiveHmrcOAuthGateway, LiveHmrcVatGateway } from "./hmrc.live";
import { MockHmrcItsaGateway, MockHmrcOAuthGateway, MockHmrcVatGateway } from "./hmrc.mock";
import { MtdConnectionService } from "./mtd-connection.service";
import { MtdController } from "./mtd.controller";
import { HmrcItsaGateway, HmrcOAuthGateway, HmrcVatGateway } from "./hmrc.types";
import { HMRC_ITSA, HMRC_OAUTH, HMRC_VAT } from "./hmrc.tokens";

@Module({
  imports: [ClientsModule],
  controllers: [MtdController],
  providers: [
    TokenCryptoService,
    HmrcHttpClient,
    MockHmrcVatGateway,
    MockHmrcItsaGateway,
    MockHmrcOAuthGateway,
    LiveHmrcVatGateway,
    LiveHmrcItsaGateway,
    LiveHmrcOAuthGateway,
    MtdConnectionService,
    {
      provide: HMRC_VAT,
      inject: [ConfigService, MockHmrcVatGateway, LiveHmrcVatGateway],
      useFactory: (config: ConfigService, mock: MockHmrcVatGateway, live: LiveHmrcVatGateway): HmrcVatGateway =>
        config.get("hmrc.mode") === "live" ? live : mock,
    },
    {
      provide: HMRC_ITSA,
      inject: [ConfigService, MockHmrcItsaGateway, LiveHmrcItsaGateway],
      useFactory: (config: ConfigService, mock: MockHmrcItsaGateway, live: LiveHmrcItsaGateway): HmrcItsaGateway =>
        config.get("hmrc.mode") === "live" ? live : mock,
    },
    {
      provide: HMRC_OAUTH,
      inject: [ConfigService, MockHmrcOAuthGateway, LiveHmrcOAuthGateway],
      useFactory: (config: ConfigService, mock: MockHmrcOAuthGateway, live: LiveHmrcOAuthGateway): HmrcOAuthGateway =>
        config.get("hmrc.mode") === "live" ? live : mock,
    },
  ],
  exports: [MtdConnectionService, TokenCryptoService, HMRC_VAT, HMRC_ITSA, HMRC_OAUTH],
})
export class HmrcModule {}
