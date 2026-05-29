import { MockReviewModelClient, ReviewModelClient } from "./client";
import {
  OpenAICompatibleReviewModelClient,
  OpenAICompatibleReviewModelClientOptions
} from "./providers/openai-compatible";

export type ReviewModelClientEnvironment = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
};

export function createReviewModelClientFromEnv(env: ReviewModelClientEnvironment): ReviewModelClient {
  const apiKey = env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return new MockReviewModelClient();
  }

  const options: OpenAICompatibleReviewModelClientOptions = {
    apiKey
  };

  if (env.OPENAI_MODEL) {
    options.model = env.OPENAI_MODEL;
  }

  if (env.OPENAI_BASE_URL) {
    options.baseUrl = env.OPENAI_BASE_URL;
  }

  return new OpenAICompatibleReviewModelClient(options);
}
