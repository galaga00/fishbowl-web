import fs from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  loadLocalEnv();
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.E2E_TEST_SECRET;
  if (!convexUrl || !secret) {
    throw new Error("Set NEXT_PUBLIC_CONVEX_URL and E2E_TEST_SECRET before running npm run debug:seed.");
  }

  const game = await new ConvexHttpClient(convexUrl).mutation(api.e2e.seedReadyPassAndPlayGame, {
    secret,
    promptCount: 12,
    teamPlayers: [
      ["Host", "Sam"],
      ["Maya", "Riley"]
    ],
    turnDurationSeconds: 60
  });

  console.log(`Debug Convex game created: ${game.code}`);
  console.log(`Open /game/${game.gameId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function loadLocalEnv() {
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
