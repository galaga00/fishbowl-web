"use client";

import { getPlayerStorageKey } from "./game-utils";

export const getSessionStorageKey = (gameId: string) => `fish-bowl:${gameId}:session`;
export const LAST_GAME_KEY = "fish-bowl:last-game";

export function getSessionToken(gameId: string) {
  return typeof localStorage === "undefined" ? "" : localStorage.getItem(getSessionStorageKey(gameId)) ?? "";
}

export function pendingSession(key: string) {
  const storageKey = `fish-bowl:pending:${key}`;
  const saved = localStorage.getItem(storageKey);
  if (saved) return saved;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  // Persist before creating a room so a failed connection can be retried safely.
  localStorage.setItem(storageKey, token);
  return token;
}

export function saveSession(gameId: string, code: string, playerId: string, token: string) {
  localStorage.setItem(getSessionStorageKey(gameId), token);
  localStorage.setItem(getPlayerStorageKey(gameId), playerId);
  localStorage.setItem(`fish-bowl:code:${code}`, gameId);
  localStorage.setItem(LAST_GAME_KEY, gameId);
}

export function readableGameError(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
  return message.split("Uncaught Error: ").pop()!.split(/\n\s+at /)[0].replace(/^\[CONVEX[^\n]*\n?/, "").trim();
}
