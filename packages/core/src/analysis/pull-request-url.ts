import { z } from "zod";

export const pullRequestReferenceSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  pullNumber: z.number().int().positive()
});

export type PullRequestReference = z.infer<typeof pullRequestReferenceSchema>;

export function parseGitHubPullRequestUrl(value: string): PullRequestReference {
  const url = new URL(value);

  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
    throw new Error("Only github.com pull request URLs are supported.");
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const [owner, repo, resource, pullNumber] = pathParts;

  if (pathParts.length !== 4 || !owner || !repo || resource !== "pull" || !pullNumber) {
    throw new Error("Invalid GitHub pull request URL.");
  }

  if (!/^\d+$/.test(pullNumber)) {
    throw new Error("Invalid GitHub pull request number.");
  }

  return pullRequestReferenceSchema.parse({
    owner,
    repo,
    pullNumber: Number(pullNumber)
  });
}
