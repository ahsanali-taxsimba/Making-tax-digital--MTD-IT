import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BookkeepingModule } from "../bookkeeping/bookkeeping.module";
import { CategorisationModule } from "../categorisation/categorisation.module";
import { MatchingModule } from "../matching/matching.module";
import { AgentController } from "./agent.controller";
import { LiveAgentLlm } from "./agent.llm.live";
import { MockAgentLlm } from "./agent.llm.mock";
import { AgentService } from "./agent.service";
import { AGENT_LLM } from "./agent.tokens";
import { AgentToolsService } from "./agent.tools";
import { AgentLlm } from "./agent.types";

@Module({
  imports: [BookkeepingModule, CategorisationModule, MatchingModule],
  controllers: [AgentController],
  providers: [
    MockAgentLlm,
    LiveAgentLlm,
    AgentToolsService,
    AgentService,
    {
      provide: AGENT_LLM,
      inject: [ConfigService, MockAgentLlm, LiveAgentLlm],
      useFactory: (config: ConfigService, mock: MockAgentLlm, live: LiveAgentLlm): AgentLlm =>
        config.get("agent.mode") === "live" ? live : mock,
    },
  ],
  exports: [AgentService],
})
export class AgentModule {}
