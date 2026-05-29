import { z } from "zod";

export const reviewFindingSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  severity: z.enum(["critical", "major", "minor", "info"]),
  category: z.enum(["bug", "security", "performance", "maintainability", "test", "docs", "style"]),
  filePath: z.string().min(1),
  line: z.number().int().positive().optional(),
  title: z.string().min(1),
  evidence: z.string().min(1),
  suggestion: z.string().min(1),
  confidence: z.number().min(0).max(1),
  blocking: z.boolean(),
  status: z.enum(["open", "dismissed", "accepted"]).default("open")
});

export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
