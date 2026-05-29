import { AnalysisReport } from "@ai-pr-reviewer/core";
import { z } from "zod";
import { modelReviewOutputSchema } from "../validators/review-output";
import type { ReviewModelClient, ReviewModelInput } from "../client";

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type OpenAICompatibleReviewModelClientOptions = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: FetchLike;
};

const chatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable()
        })
      }),
    )
    .min(1)
});

const defaultBaseUrl = "https://api.openai.com/v1";
const defaultModel = "gpt-4o-mini";

export class ModelOutputValidationError extends Error {
  constructor(message: string, readonly issues?: z.ZodIssue[]) {
    super(message);
    this.name = "ModelOutputValidationError";
  }
}

export class OpenAICompatibleReviewModelClient implements ReviewModelClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike;

  constructor(options: OpenAICompatibleReviewModelClientOptions) {
    const apiKey = options.apiKey.trim();

    if (!apiKey) {
      throw new Error("OpenAI-compatible model client requires a non-empty API key.");
    }

    this.apiKey = apiKey;
    this.model = options.model?.trim() || defaultModel;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? defaultBaseUrl);
    this.fetchFn = options.fetch ?? fetch;
  }

  async generateReview(input: ReviewModelInput): Promise<AnalysisReport> {
    const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt()
          },
          {
            role: "user",
            content: JSON.stringify(buildPromptInput(input))
          }
        ],
        temperature: 0.2,
        response_format: {
          type: "json_object"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI-compatible review request failed with status ${response.status}.`);
    }

    const payload = await parseJsonResponse(response);
    const completion = chatCompletionResponseSchema.safeParse(payload);

    if (!completion.success) {
      throw new ModelOutputValidationError(
        `OpenAI-compatible provider response shape was invalid: ${formatIssues(completion.error.issues)}`,
        completion.error.issues,
      );
    }

    const content = completion.data.choices[0]?.message.content;

    if (!content) {
      throw new ModelOutputValidationError("OpenAI-compatible provider returned an empty review response.");
    }

    const parsedContent = parseModelJson(content);
    const report = modelReviewOutputSchema.safeParse(parsedContent);

    if (!report.success) {
      throw new ModelOutputValidationError(
        `OpenAI-compatible review output failed schema validation: ${formatIssues(report.error.issues)}`,
        report.error.issues,
      );
    }

    return report.data;
  }
}

function buildSystemPrompt(): string {
  return [
    "You are an AI code review assistant.",
    "Analyze only the pull request context provided in the user message.",
    "Do not invent files, behavior, requirements, test results, vulnerabilities, or business context that is not present.",
    "If evidence is weak, lower confidence and mark the finding as non-blocking.",
    "Every finding must cite concrete evidence from the provided review context, including metadata, patch, file content, or test candidates when available.",
    "Prefer staticAnalysis signals as supporting evidence when they are relevant.",
    "Do not treat low-confidence static rule hits as certain bugs; explain uncertainty with confidence and non-blocking findings when appropriate.",
    "Return only valid JSON matching this shape:",
    '{ "summary": string, "riskLevel": "low" | "medium" | "high" | "unknown", "findings": ReviewFinding[] }',
    "Each ReviewFinding must include id, taskId, severity, category, filePath, title, evidence, suggestion, confidence, blocking, and status.",
    'Allowed severity values: "critical", "major", "minor", "info".',
    'Allowed category values: "bug", "security", "performance", "maintainability", "test", "docs", "style".',
    'Allowed status values: "open", "dismissed", "accepted".',
    "confidence must be a number from 0 to 1."
  ].join("\n");
}

function buildPromptInput(input: ReviewModelInput) {
  return {
    summary: input.summary,
    riskAssessment: input.riskAssessment,
    reviewContext: input.reviewContext,
    staticAnalysis: input.staticAnalysis
  };
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("OpenAI-compatible provider returned invalid JSON.");
  }
}

function parseModelJson(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new ModelOutputValidationError("OpenAI-compatible review output was not valid JSON.");
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/u, "");
}

function formatIssues(issues: z.ZodIssue[]): string {
  return issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
}
