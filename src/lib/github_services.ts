import { Octokit } from "octokit";
import { throttling } from "@octokit/plugin-throttling";
import { getLogger } from "./logger.ts";

export const GITHUB_ORG = "italia";

const ThrottledOctokit = Octokit.plugin(throttling);

export type GitHubClient = InstanceType<typeof ThrottledOctokit>;

export interface GitHubPublicMember {
  login: string;
}

export interface GitHubPublicMembersDataSource {
  getAllMembers(): Promise<readonly GitHubPublicMember[]>;
}

type GitHubPublicMembersLoader = () => Promise<GitHubPublicMember[]>;

/** Loads public organization members once and shares them across consumers. */
export class CachedGitHubPublicMembersDataSource
  implements GitHubPublicMembersDataSource {
  private membersPromise?: Promise<readonly GitHubPublicMember[]>;

  constructor(private readonly loader: GitHubPublicMembersLoader) {}

  getAllMembers(): Promise<readonly GitHubPublicMember[]> {
    this.membersPromise ??= this.load();
    return this.membersPromise;
  }

  private async load(): Promise<readonly GitHubPublicMember[]> {
    try {
      return await this.loader();
    } catch (error) {
      this.membersPromise = undefined;
      throw error;
    }
  }
}

export interface GitHubServices {
  client: GitHubClient;
  publicMembers: GitHubPublicMembersDataSource;
}

export function createGitHubServices(token: string): GitHubServices {
  const log = getLogger("github");
  const client = new ThrottledOctokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter, opts, _octokit, retryCount) => {
        log.warn(
          `Rate limit hit on ${opts.method} ${opts.url}, retry after ${retryAfter}s (#${retryCount})`,
        );
        return retryCount < 3;
      },
      onSecondaryRateLimit: (retryAfter, opts, _octokit, retryCount) => {
        log.warn(
          `Secondary rate limit on ${opts.method} ${opts.url}, retry after ${retryAfter}s (#${retryCount})`,
        );
        return retryCount < 3;
      },
    },
  });

  const publicMembers = new CachedGitHubPublicMembersDataSource(() => {
    log.info("Getting public GitHub members...");
    return client.paginate<GitHubPublicMember>(
      "GET /orgs/{org}/public_members",
      { org: GITHUB_ORG, per_page: 100 },
    );
  });

  return { client, publicMembers };
}
