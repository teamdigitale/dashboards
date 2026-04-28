/**
 * Shared utilities for engines that consume the Developers Italia
 * software catalog (api.developers.italia.it/v1).
 */

import { parse as parseYaml } from "@std/yaml";
import { fetchJson } from "./http.ts";
import { stripDate } from "./dates.ts";
import { getLogger } from "./logger.ts";
import type { Timestamp } from "../engines/engine.ts";

const BASE_URL = "https://api.developers.italia.it/v1";
const log = getLogger();

interface RawSoftwareItem {
  id: string;
  publiccodeYml: string;
  vitality: string | null;
  createdAt: string;
}

interface ApiPage<T> {
  data: T[];
  links: { prev: string | null; next: string | null };
}

interface RawPublicCode {
  releaseDate?: string;
  usedBy?: string[];
  categories?: string[];
  intendedAudience?: { scope?: string[] };
  organisation?: { uri?: string };
  IT?: { riuso?: { codiceIPA?: string } };
  it?: { riuso?: { codiceIPA?: string } };
}

export interface ParsedSoftware {
  id: string;
  vitality: string | null;
  timestamp: Timestamp;
  codiceIPA: string | null;
  usedBy: string[];
  categories: string[];
  audiences: string[];
}

export async function fetchAllSoftware(): Promise<ParsedSoftware[]> {
  const all: ParsedSoftware[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({ "page[size]": "100" });
    if (cursor) params.set("page[after]", cursor);

    const page = await fetchJson<ApiPage<RawSoftwareItem>>(
      `${BASE_URL}/software?${params}`,
    );

    for (const item of page.data) {
      const parsed = parseItem(item);
      if (parsed) all.push(parsed);
    }

    cursor = page.links.next
      ? new URLSearchParams(page.links.next.slice(1)).get("page[after]") ??
        undefined
      : undefined;
  } while (cursor);

  return all;
}

function parseItem(item: RawSoftwareItem): ParsedSoftware | null {
  let pc: RawPublicCode;
  try {
    pc = parseYaml(item.publiccodeYml) as RawPublicCode;
  } catch {
    log.debug(`Could not parse publiccodeYml for ${item.id}, skipping`);
    return null;
  }

  const rawDate = pc.releaseDate ?? item.createdAt;
  let timestamp: Timestamp;
  try {
    timestamp = stripDate(rawDate);
  } catch {
    return null;
  }

  const codiceIPA = extractCodiceIPA(pc);

  return {
    id: item.id,
    vitality: item.vitality,
    timestamp,
    codiceIPA,
    usedBy: Array.isArray(pc.usedBy) ? pc.usedBy : [],
    categories: Array.isArray(pc.categories) ? pc.categories : [],
    audiences: Array.isArray(pc.intendedAudience?.scope)
      ? pc.intendedAudience!.scope!
      : [],
  };
}

function extractCodiceIPA(pc: RawPublicCode): string | null {
  const itSection = pc.IT ?? pc.it;
  const fromIT = itSection?.riuso?.codiceIPA;
  if (fromIT) return fromIT.toLowerCase();

  const uri = pc.organisation?.uri ?? "";
  const prefix = "urn:x-italian-pa:";
  if (uri.startsWith(prefix)) {
    const code = uri.slice(prefix.length).toLowerCase();
    if (code) return code;
  }

  return null;
}
