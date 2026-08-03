/** Total number of registered users on forum.italia.it. */

import type { KpiEngine } from "./engine.ts";
import type { ForumUsersDataSource } from "../lib/forum_users_data_source.ts";

export class ForumUtentiRegistratiEngine implements KpiEngine {
  readonly outputType = "kpi";
  readonly metricName = "num_registered_users";

  constructor(private readonly forumUsers: ForumUsersDataSource) {}

  async computeStats(): Promise<number> {
    const users = await this.forumUsers.getAllUsers();
    return users.length;
  }
}
