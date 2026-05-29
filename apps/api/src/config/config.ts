import { z } from "zod";

const configSchema = z.object({
  port: z.coerce.number().int().positive().default(4000),
  logLevel: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  githubToken: z.string().optional(),
  openAiApiKey: z.string().optional(),
  openAiModel: z.string().default("gpt-4o-mini"),
  openAiBaseUrl: z.string().url().default("https://api.openai.com/v1"),
  databaseUrl: z.string().default("file:./dev.db")
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(): AppConfig {
  return configSchema.parse({
    port: process.env.API_PORT,
    logLevel: process.env.LOG_LEVEL,
    githubToken: process.env.GITHUB_TOKEN,
    openAiApiKey: process.env.OPENAI_API_KEY,
    openAiModel: process.env.OPENAI_MODEL,
    openAiBaseUrl: process.env.OPENAI_BASE_URL,
    databaseUrl: process.env.DATABASE_URL
  });
}
