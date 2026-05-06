"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ASSETS } from "@/lib/assets";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { createGame, joinGame } from "@/lib/game-api";
import { getPlayerStorageKey, normalizeCode } from "@/lib/game-utils";

const titleLetters = Array.from("Fish Bowl");
const howToPages = [
  { body: "Pick the cards you want to use or create your own!" },
  { title: "Round 1", body: "Say anything to describe the card." },
  { title: "Round 2", body: "Use only one word." },
  { title: "Round 3", body: "Act out the card. No sounds!" },
  { body: "Team with the most points wins!" }
];

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"menu" | "join" | "howTo">("menu");
  const [howToIndex, setHowToIndex] = useState(0);
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
        phase: game.phase,
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
      <section
        className={mode === "join" ? "home-art-stage joining" : mode === "howTo" ? "home-art-stage how-to-mode" : "home-art-stage"}
        aria-labelledby="home-title"
      >
        <div className="home-title-lockup">
          {mode === "howTo" ? (
            <h1 className="home-rule-title" id="home-title">
              <span className="home-rule-round">{howToPages[howToIndex].title ?? ""}</span>
              <span className="home-rule-copy">{howToPages[howToIndex].body}</span>
            </h1>
          ) : (
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
          )}
        </div>

        {mode === "howTo" ? (
          <div className="home-illustration-frame how-to-illustration-frame" role="img" aria-label="Placeholder rule artwork.">
            <div className="how-to-placeholder">
              <div className="how-to-card-stack" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        ) : (
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
        )}

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
          ) : mode === "howTo" ? (
            <div className="how-to-nav" aria-label="How to play navigation">
              {howToIndex > 0 ? (
                <button
                  className="home-icon-button"
                  type="button"
                  aria-label="Back"
                  onClick={() => setHowToIndex((currentIndex) => Math.max(0, currentIndex - 1))}
                >
                  <ArrowLeftIcon />
                </button>
              ) : (
                <span className="home-icon-spacer" aria-hidden="true" />
              )}
              <button
                className="home-icon-button"
                type="button"
                aria-label="Home"
                onClick={() => {
                  setHowToIndex(0);
                  setMode("menu");
                }}
              >
                <HomeIcon />
              </button>
              {howToIndex < howToPages.length - 1 ? (
                <button
                  className="home-icon-button accent"
                  type="button"
                  aria-label="Next"
                  onClick={() => setHowToIndex((currentIndex) => Math.min(howToPages.length - 1, currentIndex + 1))}
                >
                  <ArrowRightIcon />
                </button>
              ) : (
                <span className="home-icon-spacer" aria-hidden="true" />
              )}
            </div>
          ) : (
            <div className="home-button-grid">
              <button className="button accent" disabled={busy} type="button" onClick={handleCreate}>
                Create Game
              </button>
              <button className="button" disabled={busy} type="button" onClick={() => setMode("join")}>
                Join Game
              </button>
              <button className="button secondary" disabled={busy} type="button" onClick={() => setMode("howTo")}>
                How to Play
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

function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" className="home-nav-icon" viewBox="0 0 24 24">
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" className="home-nav-icon" viewBox="0 0 24 24">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg aria-hidden="true" className="home-nav-icon" viewBox="0 0 24 24">
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6.5 10.5V20h11v-9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}
