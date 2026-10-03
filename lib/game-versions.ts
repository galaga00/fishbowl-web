export const GAME_VERSIONS = {
  v1: {
    title: "V1 — Original",
    description: "Original setup and presentation, with current safety and reliability fixes."
  },
  v2: {
    title: "V2 — Improved",
    description: "Quick Start, clearer turn information, and newer host tools."
  }
} as const;

export type GameVersion = keyof typeof GAME_VERSIONS;
export const DEFAULT_GAME_VERSION: GameVersion = "v2";

export function resolveGameVersion(version?: GameVersion): GameVersion {
  return version ?? DEFAULT_GAME_VERSION;
}
