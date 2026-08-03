import { assertEquals } from "@std/assert";
import { GitHubMembriPubbliciEngine } from "./github-membri-pubblici.ts";
import type { GitHubPublicMembersDataSource } from "../lib/github_services.ts";

Deno.test("GitHubMembriPubbliciEngine returns the member count", async () => {
  const publicMembers: GitHubPublicMembersDataSource = {
    getAllMembers: () =>
      Promise.resolve([
        { login: "mario" },
        { login: "luisa" },
        { login: "anna" },
      ]),
  };

  const engine = new GitHubMembriPubbliciEngine(publicMembers);

  assertEquals(await engine.computeStats(), 3);
});
