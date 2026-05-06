"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ASSETS } from "@/lib/assets";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { createGame, joinGame } from "@/lib/game-api";
import { getPlayerStorageKey, normalizeCode } from "@/lib/game-utils";

const titleLetters = Array.from("Fish Bowl");

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"menu" | "join">("menu");
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setBusy(true);
    setError("");
    try {
      const { game, player } = await createGame("Host");
      localStorage.setItem(getPlayerStorageKey(game.id), player.id);
      trackAnalyticsEvent({
        eventName: "game_created",
        gameId: game.id,
        playerId: player.id,
        playMode: game.play_mode,
        promptMode: game.prompt_mode,
        phase: game.phase,
        playerCount: 1,
        metadata: { source: "home_create" }
      });
      router.push(`/game/${game.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create game.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { game, player } = await joinGame(normalizeCode(joinCode), playerName);
      localStorage.setItem(getPlayerStorageKey(game.id), player.id);
      trackAnalyticsEvent({
        eventName: "player_joined",
        gameId: game.id,
        playerId: player.id,
        playMode: game.play_mode,
        promptMode: game.prompt_mode,
        phase: game.phase,
        metadata: { source: "home_join" }
      });
      router.push(`/game/${game.id}`);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not join game.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="home-shell">
      <section className={mode === "join" ? "home-art-stage joining" : "home-art-stage"} aria-labelledby="home-title">
        <div className="home-title-lockup">
          <h1 id="home-title" aria-label="Fish Bowl">
            {titleLetters.map((letter, index) => (
              <span
                aria-hidden="true"
                className={letter === " " ? "home-title-space" : "home-title-letter"}
                key={`${letter}-${index}`}
                style={{ "--wave-index": index } as React.CSSProperties}
              >
                {letter}
              </span>
            ))}
          </h1>
        </div>

        <div className="home-illustration-frame" role="img" aria-label="A fish singing into a microphone inside a fish bowl.">
          <Image
            className="home-art-layer home-art-bottom"
            src={ASSETS.art.home.fishBowlLayers.bottom}
            alt=""
            fill
            priority
            sizes="(max-width: 520px) calc(100vw - 44px), 476px"
          />
          <Image
            className="home-art-layer home-art-fish"
            src={ASSETS.art.home.fishBowlLayers.fish}
            alt=""
            fill
            priority
            sizes="(max-width: 520px) calc(100vw - 44px), 476px"
          />
          <Image
            className="home-art-layer home-art-top"
            src={ASSETS.art.home.fishBowlLayers.top}
            alt=""
            fill
            priority
            sizes="(max-width: 520px) calc(100vw - 44px), 476px"
          />
        </div>

        <div className="home-action-panel">
          {mode === "join" ? (
            <form className="home-join-form" onSubmit={handleJoin}>
              <div className="field">
                <label htmlFor="joinName">Your name</label>
                <input
                  className="input"
                  id="joinName"
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  placeholder="Jordan"
                  autoComplete="name"
                />
              </div>
              <div className="field">
                <label htmlFor="joinCode">Join code</label>
                <input
                  className="input"
                  id="joinCode"
                  value={joinCode}
                  onChange={(event) => setJoinCode(normalizeCode(event.target.value))}
                  placeholder="ABCDE"
                  inputMode="text"
                  autoCapitalize="characters"
                />
              </div>
              <div className="home-button-grid">
                <button className="button secondary" type="button" disabled={busy} onClick={() => setMode("menu")}>
                  Back
                </button>
                <button className="button accent" disabled={busy || normalizeCode(joinCode).length < 4}>
                  Join Game
                </button>
              </div>
            </form>
          ) : (
            <div className="home-button-grid">
              <button className="button accent" disabled={busy} type="button" onClick={handleCreate}>
                Create Game
              </button>
              <button className="button" disabled={busy} type="button" onClick={() => setMode("join")}>
                Join Game
              </button>
            </div>
          )}

          {error ? (
            <p className="notice" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
