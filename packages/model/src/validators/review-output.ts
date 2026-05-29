import { z } from "zod";
import { reviewFindingSchema } from "@ai-pr-reviewer/core";

export const modelReviewOutputSchema = z.object({
  summary: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high", "unknown"]),
  findings: z.array(reviewFindingSchema)
});

export type ModelReviewOutput = z.infer<typeof modelReviewOutputSchema>;
