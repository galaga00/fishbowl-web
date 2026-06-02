import fs from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex === -1) continue;

      const key = trimmed.slice(0, equalsIndex).trim();
      const value = trimmed
        .slice(equalsIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");

      process.env[key] ??= value;
    }
  }
}

export function getE2ESecret() {
  loadLocalEnv();
  const secret = process.env.E2E_TEST_SECRET;
  if (!secret) throw new Error("Missing E2E_TEST_SECRET for Convex E2E setup.");
  return secret;
}

export function createE2EConvexClient() {
  loadLocalEnv();
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL for Convex E2E setup.");
  }

  return new ConvexHttpClient(convexUrl);
}

export async function deleteTestGames(gameIds: string[]) {
  const uniqueGameIds = Array.from(new Set(gameIds)).filter(Boolean);
  if (uniqueGameIds.length === 0) return;

  let convex: ConvexHttpClient;
  let secret: string;
  try {
    convex = createE2EConvexClient();
    secret = getE2ESecret();
  } catch {
    console.warn("Skipping E2E Convex cleanup because Convex E2E env vars are missing.");
    return;
  }

  await convex.mutation(api.e2e.deleteTestGames, {
    secret,
    gameIds: uniqueGameIds as Array<Id<"games">>
  });
}
