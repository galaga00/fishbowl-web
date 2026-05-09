import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

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

export function createE2ESupabaseClient(): SupabaseClient {
  loadLocalEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase env vars for E2E setup.");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false
    }
  });
}

export async function deleteTestGames(gameIds: string[]) {
  const uniqueGameIds = Array.from(new Set(gameIds)).filter(Boolean);
  if (uniqueGameIds.length === 0) return;

  let supabase: SupabaseClient;
  try {
    supabase = createE2ESupabaseClient();
  } catch {
    console.warn("Skipping E2E Supabase cleanup because Supabase env vars are missing.");
    return;
  }

  await supabase.from("analytics_events").delete().in("game_id", uniqueGameIds);
  const { error } = await supabase.from("games").delete().in("id", uniqueGameIds);
  if (error) throw error;
}
