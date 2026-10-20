import { Injectable } from "@nestjs/common";
import { ChartProfile } from "@prisma/client";
import { defaultCategorisationModel, seedTrainingExamples, tokenizeFeatures, trainCategorisationModel } from "./domain/naive-bayes";
import { ClassifyInput, ModelPrediction } from "./domain/types";

@Injectable()
export class CategorisationModelService {
  private readonly model = defaultCategorisationModel();

  predict(input: ClassifyInput, profile: ChartProfile = ChartProfile.SOLE_TRADER): ModelPrediction {
    return this.model.predict(input, profile);
  }

  features(input: Parameters<typeof tokenizeFeatures>[0]) {
    return tokenizeFeatures(input);
  }

  stats() {
    return this.model.stats();
  }

  trainFromSeeds() {
    return trainCategorisationModel(seedTrainingExamples()).stats();
  }
}
