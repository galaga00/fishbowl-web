import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_REF = "gmchqcpllgleyfjnxuit";
const BLOCKED_REFS = new Map([["pmtkuxdktwzmeyinyola", "deceit-street"]]);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(repoRoot, ".env.local");
const linkRefPath = path.join(repoRoot, "supabase", ".temp", "project-ref");
const linkMetaPath = path.join(repoRoot, "supabase", ".temp", "linked-project.json");

const env = parseEnv(await readOptional(envPath));
const linkRef = (await readOptional(linkRefPath)).trim();
const linkMeta = parseJson(await readOptional(linkMetaPath), {});
const expectedUrl = `https://${EXPECTED_REF}.supabase.co`;

const failures = [];
if (env.NEXT_PUBLIC_SUPABASE_URL !== expectedUrl) {
  failures.push(`.env.local NEXT_PUBLIC_SUPABASE_URL must be ${expectedUrl}.`);
}

if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  failures.push(".env.local NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.");
}

if (linkRef && linkRef !== EXPECTED_REF) {
  const blockedName = BLOCKED_REFS.get(linkRef);
  failures.push(
    blockedName
      ? `Supabase CLI is linked to ${blockedName} (${linkRef}); expected Fish Bowl (${EXPECTED_REF}).`
      : `Supabase CLI is linked to ${linkRef}; expected Fish Bowl (${EXPECTED_REF}).`
  );
}

if (linkMeta.ref && linkMeta.ref !== EXPECTED_REF) {
  const blockedName = BLOCKED_REFS.get(linkMeta.ref);
  failures.push(
    blockedName
      ? `Supabase CLI metadata says ${blockedName} (${linkMeta.ref}); expected Fish Bowl (${EXPECTED_REF}).`
      : `Supabase CLI metadata says ${linkMeta.ref}; expected Fish Bowl (${EXPECTED_REF}).`
  );
}

if (failures.length > 0) {
  console.error("Fish Bowl Supabase target check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Fish Bowl Supabase target verified: ${EXPECTED_REF}.`);

async function readOptional(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function parseJson(source, fallback) {
  if (!source.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(source);
  } catch {
    return fallback;
  }
}
