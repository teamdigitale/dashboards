/** Total number of public members in the GitHub organization. */

import type { KpiEngine } from "./engine.ts";
import type { GitHubPublicMembersDataSource } from "../lib/github_services.ts";

export class GitHubMembriPubbliciEngine implements KpiEngine {
  readonly outputType = "kpi";
  readonly metricName = "num_members";

  constructor(private readonly publicMembers: GitHubPublicMembersDataSource) {}

  async computeStats(): Promise<number> {
    const members = await this.publicMembers.getAllMembers();
    return members.length;
  }
}
