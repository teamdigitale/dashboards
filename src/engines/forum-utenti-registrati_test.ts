import { assertEquals } from "@std/assert";
import { ForumUtentiRegistratiEngine } from "./forum-utenti-registrati.ts";
import type {
  ForumUser,
  ForumUsersDataSource,
} from "../lib/forum_users_data_source.ts";

Deno.test("ForumUtentiRegistratiEngine returns the user count", async () => {
  const forumUsers: ForumUsersDataSource = {
    getAllUsers: () => Promise.resolve(new Array(3) as ForumUser[]),
  };

  const engine = new ForumUtentiRegistratiEngine(forumUsers);

  assertEquals(await engine.computeStats(), 3);
});
