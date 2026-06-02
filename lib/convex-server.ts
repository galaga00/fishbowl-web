import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
let client: ConvexHttpClient | null = null;

export const hasServerConvexConfig = Boolean(convexUrl);

export function createServerConvexClient() {
  if (!convexUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL.");
  }
  client ??= new ConvexHttpClient(convexUrl);
  return client;
}
