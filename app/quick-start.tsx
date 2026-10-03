"use client";

import { useState } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { loadSnapshot, saveGameSetup, startGame } from "@/lib/game-api";
import { FAMILY_FRIENDLY_DECK_FILTER, MIXED_PASS_PLAY_CATEGORY } from "@/lib/pass-play-deck";
import { readableGameError } from "@/lib/player-session";

const presets = [
  { id: "classic", title: "Classic", cards: 40, seconds: 60, description: "A full bowl for game night" },
  { id: "quick", title: "Quick", cards: 20, seconds: 30, description: "A smaller bowl, shorter turns" },
  { id: "family", title: "Family", cards: 30, seconds: 60, description: "Simple, all-ages cards" }
] as const;

export function QuickStart({ gameId, onComplete, onBusyChange, disabled = false }: { gameId: string; onComplete: () => Promise<unknown>; onBusyChange?: (busy: boolean) => void; disabled?: boolean }) {
  const [presetId, setPresetId] = useState<string>("classic");
  const [playerCount, setPlayerCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const preset = presets.find((item) => item.id === presetId)!;

  async function start() {
    if (busy || disabled) return;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      const categories = preset.id === "family" ? [MIXED_PASS_PLAY_CATEGORY, FAMILY_FRIENDLY_DECK_FILTER] : [MIXED_PASS_PLAY_CATEGORY];
      await saveGameSetup(gameId, 5, ["Team 1", "Team 2"], "auto", "deck", playerCount, 10, 5, preset.seconds, "pass_and_play", Array.from({ length: playerCount }, (_, index) => ({ name: `Player ${index + 1}`, teamIndex: index % 2 })), preset.cards, categories, categories);
      await startGame(await loadSnapshot(gameId));
      const started = await loadSnapshot(gameId);
      trackAnalyticsEvent({ eventName: "game_started", gameId, playerId: started.viewer_player_id, playMode: started.game.play_mode, promptMode: started.game.prompt_mode, phase: started.game.phase, playerCount, teamCount: 2, promptCount: preset.cards, metadata: { preset: preset.id, turnDurationSeconds: preset.seconds } });
      await onComplete();
    } catch (cause) {
      setError(readableGameError(cause));
      await onComplete();
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return <section className="card quick-start stack" aria-labelledby="quick-start-title">
    <div><span className="eyebrow">One phone · two teams</span><h2 id="quick-start-title">Quick start</h2><p className="muted">Pick a bowl and play. Choose Custom game above for your own prompts, names, teams, or everyone’s own phones.</p></div>
    <div className="quick-presets">{presets.map((item) => <button type="button" className={item.id === presetId ? "quick-preset selected" : "quick-preset"} key={item.id} aria-pressed={item.id === presetId} disabled={busy || disabled} onClick={() => setPresetId(item.id)}><strong>{item.title}</strong><span>{item.cards} cards · {item.seconds}s turns</span><span>{item.description}</span></button>)}</div>
    <div className="field"><label htmlFor="quick-players">Number of players</label><select className="input" id="quick-players" disabled={busy || disabled} value={playerCount} onChange={(event) => setPlayerCount(Number(event.target.value))}>{Array.from({ length: 39 }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count}</option>)}</select></div>
    <p className="muted tiny">{playerCount} players, alternating teams. Three rounds with the same {preset.cards} cards: describe, one word, then charades.</p>
    <button className="button accent" disabled={busy || disabled} onClick={start}>{busy ? "Preparing your bowl…" : "Start quick game"}</button>
    {error ? <p className="notice" role="alert">{error}</p> : null}
  </section>;
}
