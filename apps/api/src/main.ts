import cors from "@fastify/cors";
import { createGitHubClient } from "@ai-pr-reviewer/github";
import { createReviewModelClientFromEnv } from "@ai-pr-reviewer/model";
import Fastify from "fastify";
import { analysisRoutes } from "./modules/analysis/routes";
import { PrismaAnalysisTaskRepository } from "./modules/analysis/repository";
import { loadConfig } from "./config/config";
import { createPrismaClient } from "./prisma/client";

const config = loadConfig();
const githubClient = createGitHubClient(config.githubToken ? { token: config.githubToken } : {});
const prisma = createPrismaClient(config.databaseUrl);
const analysisTaskRepository = new PrismaAnalysisTaskRepository(prisma);
const reviewModelClientConfig = {
  OPENAI_MODEL: config.openAiModel,
  OPENAI_BASE_URL: config.openAiBaseUrl,
  ...(config.openAiApiKey ? { OPENAI_API_KEY: config.openAiApiKey } : {})
};
const reviewModelClient = createReviewModelClientFromEnv(reviewModelClientConfig);
const app = Fastify({
  routerOptions: {
    ignoreTrailingSlash: true
  },
  logger: {
    level: config.logLevel,
    redact: ["req.headers.authorization", "GITHUB_TOKEN", "OPENAI_API_KEY"]
  }
});

await app.register(cors, {
  origin: true
});

await app.register(analysisRoutes, {
  prefix: "/api/analysis-tasks",
  repository: analysisTaskRepository,
  githubClient,
  reviewModelClient
});

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

app.get("/health", async () => ({
  status: "ok"
}));

await app.listen({
  port: config.port,
  host: "0.0.0.0"
});
