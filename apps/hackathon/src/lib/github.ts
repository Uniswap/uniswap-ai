import { Octokit } from '@octokit/rest';
import type { GitHubIssue } from './types';
import { HACKATHON_CONFIG } from './config';

const octokit = new Octokit({
  auth: import.meta.env.VITE_GITHUB_TOKEN || undefined,
});

const { owner, repo, submissionLabel } = HACKATHON_CONFIG.github;

export class GitHubRateLimitError extends Error {
  readonly resetAt: Date;

  constructor(resetAt: Date) {
    const resetTime = resetAt.toLocaleTimeString();
    super(`GitHub API rate limit exceeded. Resets at ${resetTime}.`);
    this.name = 'GitHubRateLimitError';
    this.resetAt = resetAt;
  }
}

export class GitHubNotFoundError extends Error {
  constructor(resource: string) {
    super(`GitHub resource not found: ${resource}`);
    this.name = 'GitHubNotFoundError';
  }
}

export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubAuthError';
  }
}

export class GitHubApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

export async function fetchSubmissions(): Promise<GitHubIssue[]> {
  try {
    const issues = await octokit.paginate(octokit.issues.listForRepo, {
      owner,
      repo,
      labels: submissionLabel,
      state: 'open',
      sort: 'created',
      direction: 'desc',
      per_page: 100,
    });

    return issues as GitHubIssue[];
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;

      if (status === 403) {
        const response =
          'response' in error
            ? (
                error as {
                  response: {
                    headers: Record<string, string>;
                    data?: { documentation_url?: string; message?: string };
                  };
                }
              ).response
            : undefined;
        const headers = response?.headers ?? {};
        const data = response?.data;

        const isRateLimit = headers['x-ratelimit-remaining'] === '0';
        if (isRateLimit) {
          const resetHeader = headers['x-ratelimit-reset'];
          const resetAt = resetHeader
            ? new Date(Number(resetHeader) * 1000)
            : new Date(Date.now() + 3600_000);
          throw new GitHubRateLimitError(resetAt);
        }

        const isSSOError = data?.documentation_url?.includes('saml-single-sign-on');
        if (isSSOError) {
          throw new GitHubAuthError(
            'The GitHub token needs to be authorized for SSO access to the organization.'
          );
        }

        throw new GitHubAuthError(
          data?.message ?? 'Access denied. The GitHub token may lack the required permissions.'
        );
      }

      if (status === 404) {
        throw new GitHubNotFoundError(`${owner}/${repo}`);
      }

      throw new GitHubApiError(status, `GitHub API error (${status})`);
    }

    throw error;
  }
}
