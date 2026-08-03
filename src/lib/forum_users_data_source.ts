import Discourse, { HTTPError } from "discourse2";
import { getLogger } from "./logger.ts";
import { withRetry } from "./retry.ts";

export const FORUM_BASE_URL = "https://forum.italia.it";

export type ForumUser = Awaited<
  ReturnType<Discourse["adminListUsers"]>
>[number];

export interface ForumUsersDataSource {
  getAllUsers(): Promise<readonly ForumUser[]>;
}

type ForumUsersLoader = () => Promise<ForumUser[]>;

/** Loads Forum users once and shares them across all consumers. */
export class CachedForumUsersDataSource implements ForumUsersDataSource {
  private usersPromise?: Promise<readonly ForumUser[]>;

  constructor(private readonly loader: ForumUsersLoader) {}

  getAllUsers(): Promise<readonly ForumUser[]> {
    this.usersPromise ??= this.load();
    return this.usersPromise;
  }

  private async load(): Promise<readonly ForumUser[]> {
    try {
      return await this.loader();
    } catch (error) {
      this.usersPromise = undefined;
      throw error;
    }
  }
}

export function createForumUsersDataSource(
  apiKey: string,
): ForumUsersDataSource {
  const log = getLogger("forum");
  const client = new Discourse(FORUM_BASE_URL, {
    "Api-Key": apiKey,
    "Api-Username": "system",
  });
  const isRateLimit = (error: unknown): boolean =>
    error instanceof HTTPError && error.status === 429;

  return new CachedForumUsersDataSource(async () => {
    log.info("Getting registered Forum users...");
    const users: ForumUser[] = [];
    for (let page = 1;; page++) {
      const chunk = await withRetry(
        () => client.adminListUsers({ flag: "active", page }),
        isRateLimit,
      );
      if (!Array.isArray(chunk) || chunk.length === 0) break;
      users.push(...chunk);
    }
    return users;
  });
}
