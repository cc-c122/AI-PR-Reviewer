import { ChangedFile, PullRequestSnapshot } from "../types/analysis";

export type ContextSourceType = "metadata" | "patch" | "file_content" | "test_candidate";

export type ContextSource = {
  type: ContextSourceType;
  description: string;
  filePath?: string;
};

export type ReviewContextFile = {
  path: string;
  status: ChangedFile["status"];
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  content?: string;
  contentTruncated?: boolean;
  isTestFile: boolean;
  testCandidatePaths: string[];
  contextSources: ContextSource[];
};

export type PullRequestReviewContext = {
  pullRequest: {
    taskId: string;
    repositoryOwner: string;
    repositoryName: string;
    pullRequestNumber: number;
    url: string;
    title: string;
    description: string;
    author: string;
    baseRef: string;
    headRef: string;
    commitSha: string;
  };
  changedFiles: ReviewContextFile[];
  contextSources: ContextSource[];
};

export type ReviewContextFileContent = {
  content: string;
  truncated?: boolean;
};

export type ReviewContextFileContents = Record<string, string | ReviewContextFileContent | undefined>;

export function buildPullRequestReviewContext(
  snapshot: PullRequestSnapshot,
  fileContents: ReviewContextFileContents = {},
): PullRequestReviewContext {
  const contextSources: ContextSource[] = [
    {
      type: "metadata",
      description: "Pull request metadata from GitHub."
    }
  ];

  const changedFiles = snapshot.changedFiles.map((file) => {
    const contentInput = normalizeFileContent(fileContents[file.path]);
    const testCandidatePaths = getTestCandidatePaths(file.path);
    const fileSources: ContextSource[] = [
      {
        type: "metadata",
        filePath: file.path,
        description: "Changed file metadata from the pull request file list."
      }
    ];

    if (file.patch) {
      fileSources.push({
        type: "patch",
        filePath: file.path,
        description: "Changed file patch from GitHub pull request files."
      });
    }

    if (contentInput) {
      fileSources.push({
        type: "file_content",
        filePath: file.path,
        description: contentInput.truncated
          ? "Repository file content at PR head commit, truncated by size limit."
          : "Repository file content at PR head commit."
      });
    }

    if (isTestPath(file.path) || testCandidatePaths.length > 0) {
      fileSources.push({
        type: "test_candidate",
        filePath: file.path,
        description: isTestPath(file.path)
          ? "Changed file is itself a test/spec file."
          : "Potential related test/spec paths inferred from the changed file path."
      });
    }

    contextSources.push(...fileSources);

    const contextFile: ReviewContextFile = {
      path: file.path,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      isTestFile: isTestPath(file.path),
      testCandidatePaths,
      contextSources: fileSources
    };

    if (file.patch) {
      contextFile.patch = file.patch;
    }

    if (contentInput) {
      contextFile.content = contentInput.content;

      if (contentInput.truncated !== undefined) {
        contextFile.contentTruncated = contentInput.truncated;
      }
    }

    return contextFile;
  });

  return {
    pullRequest: {
      taskId: snapshot.taskId,
      repositoryOwner: snapshot.repositoryOwner,
      repositoryName: snapshot.repositoryName,
      pullRequestNumber: snapshot.pullRequestNumber,
      url: snapshot.url,
      title: snapshot.title,
      description: snapshot.description,
      author: snapshot.author,
      baseRef: snapshot.baseRef,
      headRef: snapshot.headRef,
      commitSha: snapshot.commitSha
    },
    changedFiles,
    contextSources
  };
}

export function getTestCandidatePaths(filePath: string): string[] {
  if (isTestPath(filePath)) {
    return [filePath];
  }

  const normalizedPath = filePath.replace(/\\/gu, "/");
  const extensionMatch = normalizedPath.match(/(\.[cm]?[jt]sx?|\.py|\.go|\.rs|\.java|\.kt|\.cs)$/iu);

  if (!extensionMatch) {
    return [];
  }

  const extension = extensionMatch[1];

  if (!extension) {
    return [];
  }
  const withoutExtension = normalizedPath.slice(0, -extension.length);
  const fileName = withoutExtension.split("/").at(-1);

  if (!fileName) {
    return [];
  }

  const candidates = [
    `${withoutExtension}.test${extension}`,
    `${withoutExtension}.spec${extension}`,
    `${directoryName(withoutExtension)}/__tests__/${fileName}.test${extension}`,
    `tests/${fileName}.test${extension}`,
    `tests/${fileName}.spec${extension}`
  ];

  return Array.from(new Set(candidates.map((candidate) => candidate.replace(/^\.\//u, ""))));
}

export function isTestPath(filePath: string): boolean {
  return /(^|\/)(__tests__|tests?|spec)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/iu.test(filePath);
}

function normalizeFileContent(input: string | ReviewContextFileContent | undefined): ReviewContextFileContent | undefined {
  if (typeof input === "string") {
    return {
      content: input
    };
  }

  return input;
}

function directoryName(pathWithoutExtension: string): string {
  const parts = pathWithoutExtension.split("/");
  parts.pop();

  return parts.join("/") || ".";
}
