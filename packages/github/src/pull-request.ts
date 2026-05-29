import { ChangedFile, PullRequestReference, PullRequestSnapshot } from "@ai-pr-reviewer/core";
import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";

type GitHubPullRequest = RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];
type GitHubChangedFile = RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"][number];

export function adaptGitHubChangedFile(file: GitHubChangedFile): ChangedFile {
  const changedFile: ChangedFile = {
    path: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes
  };

  if (file.previous_filename) {
    changedFile.previousPath = file.previous_filename;
  }

  if (file.patch) {
    changedFile.patch = file.patch;
  }

  return changedFile;
}

export function adaptGitHubPullRequest(
  pullRequest: GitHubPullRequest,
  reference: PullRequestReference,
  taskId: string,
  changedFiles: ChangedFile[],
): PullRequestSnapshot {
  return {
    id: String(pullRequest.id),
    taskId,
    repositoryOwner: reference.owner,
    repositoryName: reference.repo,
    pullRequestNumber: reference.pullNumber,
    url: pullRequest.html_url,
    title: pullRequest.title,
    description: pullRequest.body ?? "",
    author: pullRequest.user?.login ?? "unknown",
    baseRef: pullRequest.base.ref,
    baseSha: pullRequest.base.sha,
    headRef: pullRequest.head.ref,
    commitSha: pullRequest.head.sha,
    changedFiles
  };
}

export async function getPullRequestSnapshot(
  octokit: Octokit,
  reference: PullRequestReference,
  taskId: string,
): Promise<PullRequestSnapshot> {
  const [pullRequestResponse, changedFiles] = await Promise.all([
    octokit.rest.pulls.get({
      owner: reference.owner,
      repo: reference.repo,
      pull_number: reference.pullNumber
    }),
    getPullRequestChangedFiles(octokit, reference)
  ]);

  return adaptGitHubPullRequest(pullRequestResponse.data, reference, taskId, changedFiles);
}

export async function getPullRequestChangedFiles(
  octokit: Octokit,
  reference: PullRequestReference,
): Promise<ChangedFile[]> {
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner: reference.owner,
    repo: reference.repo,
    pull_number: reference.pullNumber,
    per_page: 100
  });

  return files.map(adaptGitHubChangedFile);
}
