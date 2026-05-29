import { Octokit } from "@octokit/rest";

export type GitHubClientOptions = {
  token?: string;
};

export type GitHubClient = Octokit;

export function createGitHubClient(options: GitHubClientOptions = {}): GitHubClient {
  return new Octokit({
    auth: options.token
  });
}
