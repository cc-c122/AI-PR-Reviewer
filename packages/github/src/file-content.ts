import { PullRequestSnapshot, ReviewContextFileContent } from "@ai-pr-reviewer/core";
import { Octokit } from "@octokit/rest";

export type RepositoryFileContentReference = {
  owner: string;
  repo: string;
  path: string;
  ref: string;
};

export type PullRequestFileContentOptions = {
  maxFiles?: number;
  maxBytesPerFile?: number;
};

const defaultMaxFiles = 20;
const defaultMaxBytesPerFile = 50 * 1024;

export async function getRepositoryFileContent(
  octokit: Octokit,
  reference: RepositoryFileContentReference,
  maxBytes = defaultMaxBytesPerFile,
): Promise<ReviewContextFileContent | null> {
  const response = await octokit.rest.repos.getContent({
    owner: reference.owner,
    repo: reference.repo,
    path: reference.path,
    ref: reference.ref
  });

  if (Array.isArray(response.data) || response.data.type !== "file") {
    return null;
  }

  if (typeof response.data.size === "number" && response.data.size > maxBytes) {
    return null;
  }

  if (!("content" in response.data) || typeof response.data.content !== "string") {
    return null;
  }

  const decoded = Buffer.from(response.data.content.replace(/\n/gu, ""), "base64").toString("utf8");
  const truncated = Buffer.byteLength(decoded, "utf8") > maxBytes;

  return {
    content: truncated ? decoded.slice(0, maxBytes) : decoded,
    truncated
  };
}

export async function getPullRequestFileContents(
  octokit: Octokit,
  snapshot: PullRequestSnapshot,
  options: PullRequestFileContentOptions = {},
): Promise<Record<string, ReviewContextFileContent>> {
  const maxFiles = options.maxFiles ?? defaultMaxFiles;
  const maxBytesPerFile = options.maxBytesPerFile ?? defaultMaxBytesPerFile;
  const eligibleFiles = snapshot.changedFiles.filter((file) => file.status !== "removed").slice(0, maxFiles);
  const entries = await Promise.all(
    eligibleFiles.map(async (file) => {
      try {
        const content = await getRepositoryFileContent(
          octokit,
          {
            owner: snapshot.repositoryOwner,
            repo: snapshot.repositoryName,
            path: file.path,
            ref: snapshot.commitSha
          },
          maxBytesPerFile,
        );

        return content ? ([file.path, content] as const) : null;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(entries.filter((entry): entry is readonly [string, ReviewContextFileContent] => Boolean(entry)));
}
