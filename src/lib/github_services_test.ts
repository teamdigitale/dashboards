import { assertEquals, assertRejects } from "@std/assert";
import {
  CachedGitHubPublicMembersDataSource,
  type GitHubPublicMember,
} from "./github_services.ts";

const members: GitHubPublicMember[] = [
  { login: "mario" },
  { login: "luisa" },
];

Deno.test(
  "CachedGitHubPublicMembersDataSource shares one concurrent load",
  async () => {
    let calls = 0;
    const source = new CachedGitHubPublicMembersDataSource(async () => {
      calls++;
      await Promise.resolve();
      return members;
    });

    const [first, second] = await Promise.all([
      source.getAllMembers(),
      source.getAllMembers(),
    ]);

    assertEquals(calls, 1);
    assertEquals(first, members);
    assertEquals(second, members);
  },
);

Deno.test(
  "CachedGitHubPublicMembersDataSource retries after a failed load",
  async () => {
    let calls = 0;
    const source = new CachedGitHubPublicMembersDataSource(() => {
      calls++;
      return calls === 1
        ? Promise.reject(new Error("temporary failure"))
        : Promise.resolve(members);
    });

    await assertRejects(() => source.getAllMembers(), Error, "temporary");
    assertEquals(await source.getAllMembers(), members);
    assertEquals(calls, 2);
  },
);
