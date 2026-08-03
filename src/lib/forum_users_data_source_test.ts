import { assertEquals, assertRejects } from "@std/assert";
import {
  CachedForumUsersDataSource,
  type ForumUser,
} from "./forum_users_data_source.ts";

const users = [{
  id: 1,
  username: "mario",
  created_at: "2024-01-01T00:00:00Z",
}] as ForumUser[];

Deno.test("CachedForumUsersDataSource shares one concurrent load", async () => {
  let calls = 0;
  const source = new CachedForumUsersDataSource(async () => {
    calls++;
    await Promise.resolve();
    return users;
  });

  const [first, second] = await Promise.all([
    source.getAllUsers(),
    source.getAllUsers(),
  ]);

  assertEquals(calls, 1);
  assertEquals(first, users);
  assertEquals(second, users);
});

Deno.test("CachedForumUsersDataSource retries after a failed load", async () => {
  let calls = 0;
  const source = new CachedForumUsersDataSource(() => {
    calls++;
    return calls === 1
      ? Promise.reject(new Error("temporary failure"))
      : Promise.resolve(users);
  });

  await assertRejects(() => source.getAllUsers(), Error, "temporary");
  assertEquals(await source.getAllUsers(), users);
  assertEquals(calls, 2);
});
