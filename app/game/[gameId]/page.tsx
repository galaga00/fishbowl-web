"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  assignPlayerToTeam,
  endTurn,
  finishGame,
  joinGame,
  loadSnapshot,
  markCorrect,
  pauseGame,
  resetToLobby,
  resumeGame,
  saveGameSetup,
  setDraftCardSelected,
  skipPrompt,
  startGame,
  startTurn,
  submitPrompts,
  undoLastAction,
  updatePlayerName
} from "@/lib/game-api";
import { supabase } from "@/lib/supabase";
import {
  FAMILY_FRIENDLY_DECK_FILTER,
  getDefaultPassPlayCardCount,
  hasFamilyFriendlyDeckFilter,
  MIXED_PASS_PLAY_CATEGORY,
  PASS_PLAY_CATEGORY_OPTIONS
} from "@/lib/pass-play-deck";
import type { GameSnapshot, Player, Prompt } from "@/lib/types";
import {
  DEFAULT_PROMPTS_PER_PLAYER,
  DEFAULT_CARDS_DEALT_PER_PLAYER,
  DEFAULT_CARDS_KEPT_PER_PLAYER,
  DEFAULT_PLAY_MODE,
  DEFAULT_TEAM_COUNT,
  DEFAULT_TEAM_ASSIGNMENT_MODE,
  TURN_DURATION_OPTIONS,
  TURN_DURATION_SECONDS,
  getDraftSelectedCountForPlayer,
  getPlayerStorageKey,
  getPreviousPlayerStorageKey,
  getPromptCountForPlayer,
  getPromptProgress,
  getRoundSummary,
  getTeamRoster,
  getTeamBalanceWarning,
  getRoundName,
  getWinningTeams,
  hasPlayerDrafted,
  hasPlayerSubmitted,
  isPassAndPlay,
  getTurnSecondsLeft
} from "@/lib/game-utils";
import { getPromptCategoriesForPlayer } from "@/lib/prompt-categories";
import type { PlayMode, PromptMode, TeamAssignmentMode } from "@/lib/types";

type PassAndPlaySetupPlayer = {
  name: string;
  teamIndex: number;
};

export default function GamePage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("");
  const [promptText, setPromptText] = useState("");
  const [categoryPromptValues, setCategoryPromptValues] = useState<string[]>([]);
  const [promptsPerPlayer, setPromptsPerPlayer] = useState(DEFAULT_PROMPTS_PER_PLAYER);
  const [turnDurationSeconds, setTurnDurationSeconds] = useState(TURN_DURATION_SECONDS);
  const [cardsDealtPerPlayer, setCardsDealtPerPlayer] = useState(DEFAULT_CARDS_DEALT_PER_PLAYER);
  const [cardsKeptPerPlayer, setCardsKeptPerPlayer] = useState(DEFAULT_CARDS_KEPT_PER_PLAYER);
  const [teamCount, setTeamCount] = useState(DEFAULT_TEAM_COUNT);
  const [teamNames, setTeamNames] = useState(() => Array.from({ length: DEFAULT_TEAM_COUNT }, (_, index) => `Team ${index + 1}`));
  const [expectedPlayers, setExpectedPlayers] = useState("");
  const [teamAssignmentMode, setTeamAssignmentMode] = useState<TeamAssignmentMode>(DEFAULT_TEAM_ASSIGNMENT_MODE);
  const [promptMode, setPromptMode] = useState<PromptMode>("free");
  const [promptCategories, setPromptCategories] = useState<string[]>([MIXED_PASS_PLAY_CATEGORY]);
  const [playMode, setPlayMode] = useState<PlayMode>(DEFAULT_PLAY_MODE);
  const [passAndPlayCardCount, setPassAndPlayCardCount] = useState(getDefaultPassPlayCardCount(4));
  const [passAndPlayCategories, setPassAndPlayCategories] = useState<string[]>([MIXED_PASS_PLAY_CATEGORY]);
  const [passAndPlayPlayers, setPassAndPlayPlayers] = useState<PassAndPlaySetupPlayer[]>(
    Array.from({ length: 4 }, (_, index) => ({ name: `Player ${index + 1}`, teamIndex: index % DEFAULT_TEAM_COUNT }))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const nextSnapshot = await loadSnapshot(gameId);
    setSnapshot(nextSnapshot);
  }, [gameId]);

  useEffect(() => {
    const savedPlayerId = localStorage.getItem(getPlayerStorageKey(gameId)) ?? localStorage.getItem(getPreviousPlayerStorageKey(gameId));
    if (savedPlayerId) {
      localStorage.setItem(getPlayerStorageKey(gameId), savedPlayerId);
      setPlayerId(savedPlayerId);
    }
    refresh().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load game."));
  }, [gameId, refresh]);

  useEffect(() => {
    const channel = supabase
      .channel(`game:${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `game_id=eq.${gameId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "prompts", filter: `game_id=eq.${gameId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "draft_cards", filter: `game_id=eq.${gameId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "turns", filter: `game_id=eq.${gameId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, refresh]);

  const me = useMemo(() => {
    if (!snapshot || !playerId) return null;
    return snapshot.players.find((player) => player.id === playerId) ?? null;
  }, [snapshot, playerId]);

  const activePlayer = useMemo(() => {
    if (!snapshot) return null;
    return snapshot.players.find((player) => player.id === snapshot.game.active_player_id) ?? null;
  }, [snapshot]);

  const currentPrompt = useMemo(() => {
    if (!snapshot) return null;
    return snapshot.prompts.find((prompt) => prompt.id === snapshot.game.current_prompt_id) ?? null;
  }, [snapshot]);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function trackSnapshotEvent(eventName: string, nextSnapshot = snapshot, metadata: Record<string, unknown> = {}) {
    if (!nextSnapshot) return;
    const includeGameSettings = eventName === "game_started" || (nextSnapshot.game.phase !== "setup" && nextSnapshot.game.phase !== "lobby");
    trackAnalyticsEvent({
      eventName,
      gameId: nextSnapshot.game.id,
      playerId: playerId ?? me?.id ?? null,
      playMode: includeGameSettings ? nextSnapshot.game.play_mode : null,
      promptMode: includeGameSettings ? nextSnapshot.game.prompt_mode : null,
      phase: nextSnapshot.game.phase,
      playerCount: includeGameSettings ? nextSnapshot.players.length : null,
      teamCount: includeGameSettings ? nextSnapshot.teams.length : null,
      promptCount: includeGameSettings ? nextSnapshot.prompts.length : null,
      metadata: {
        roundNumber: nextSnapshot.game.round_number,
        turnNumber: nextSnapshot.game.turn_number,
        ...metadata
      }
    });
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot) return;
    await runAction(async () => {
      const { player } = await joinGame(snapshot.game.code, joinName);
      localStorage.setItem(getPlayerStorageKey(snapshot.game.id), player.id);
      setPlayerId(player.id);
      trackSnapshotEvent("player_joined", snapshot, {
        joinedPlayerId: player.id,
        source: "game_join"
      });
    });
  }

  function handleReclaimPlayer(nextPlayerId: string) {
    if (!snapshot) return;
    localStorage.setItem(getPlayerStorageKey(snapshot.game.id), nextPlayerId);
    setPlayerId(nextPlayerId);
  }

  async function handleNameSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!me) return;
    await runAction(() => updatePlayerName(me.id, joinName || me.name));
  }

  async function handleSubmitPrompts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || !me) return;
    await runAction(async () => {
      const submittedCount =
        snapshot.game.prompt_mode === "category"
          ? categoryPromptValues.filter((value) => value.trim()).length
          : promptText
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean).length;
      if (snapshot.game.prompt_mode === "category") {
        const promptTarget =
          snapshot.game.play_mode === "pass_and_play"
            ? snapshot.players.length * snapshot.game.prompts_per_player
            : snapshot.game.prompts_per_player;
        const categories = getPromptCategoriesForPlayer(
          snapshot.game.id,
          me.id,
          promptTarget,
          snapshot.game.prompt_categories ?? [MIXED_PASS_PLAY_CATEGORY]
        );
        const existingPromptCount =
          snapshot.game.play_mode === "pass_and_play" ? snapshot.prompts.length : getPromptCountForPlayer(me.id, snapshot.prompts);
        await submitPrompts(
          snapshot.game.id,
          me.id,
          categoryPromptValues
            .map((text, index) => ({
              text,
              category: categories[existingPromptCount + index]
            }))
            .filter((prompt) => prompt.text.trim())
        );
        setCategoryPromptValues([]);
      } else {
        await submitPrompts(
          snapshot.game.id,
          me.id,
          promptText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
        );
        setPromptText("");
      }
      trackSnapshotEvent("prompts_submitted", snapshot, {
        submittedCount,
        passAndPlay: snapshot.game.play_mode === "pass_and_play"
      });
    });
  }

  async function handleSetupSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot) return;
    const minimumExpectedPlayers = Math.max(1, snapshot.players.length);
    await runAction(async () => {
      await saveGameSetup(
        snapshot.game.id,
        promptsPerPlayer,
        teamNames.slice(0, teamCount),
        teamAssignmentMode,
        promptMode,
        expectedPlayers ? Math.max(minimumExpectedPlayers, Number(expectedPlayers)) : null,
        cardsDealtPerPlayer,
        cardsKeptPerPlayer,
        turnDurationSeconds,
        playMode,
        passAndPlayPlayers,
        passAndPlayCardCount,
        passAndPlayCategories,
        promptCategories
      );
    });
  }

  async function handleDraftCardToggle(draftCardId: string, selected: boolean) {
    if (!snapshot || !me) return;
    await runAction(() => setDraftCardSelected(snapshot, me.id, draftCardId, selected));
  }

  async function handleChooseTeam(teamId: string) {
    if (!me) return;
    await runAction(() => assignPlayerToTeam(me.id, teamId));
  }

  async function handleAssignPlayerToTeam(playerId: string, teamId: string) {
    await runAction(() => assignPlayerToTeam(playerId, teamId));
  }

  function handlePassAndPlayPlayerCountChange(nextCount: number) {
    const safeCount = Math.min(40, Math.max(2, nextCount));
    setPassAndPlayPlayers((currentPlayers) =>
      Array.from({ length: safeCount }, (_, index) => currentPlayers[index] ?? { name: `Player ${index + 1}`, teamIndex: index % teamCount })
    );
    setPassAndPlayCardCount(getDefaultPassPlayCardCount(safeCount));
  }

  function handleTeamCountChange(nextCount: number) {
    const safeCount = Math.min(12, Math.max(1, nextCount));
    setTeamCount(safeCount);
    setTeamNames((currentNames) =>
      Array.from({ length: safeCount }, (_, index) => currentNames[index] ?? `Team ${index + 1}`)
    );
    setPassAndPlayPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => ({ ...player, teamIndex: Math.min(player.teamIndex ?? index % safeCount, safeCount - 1) }))
    );
  }

  if (!snapshot) {
    return (
      <main className="shell">
        <p className="muted">Loading game...</p>
        {error ? <p className="notice">{error}</p> : null}
      </main>
    );
  }

  const host = snapshot.players.find((player) => player.id === snapshot.game.host_player_id);
  const isHost = Boolean(me?.is_host);
  const promptCount = snapshot.prompts.length;
  const promptProgress = getPromptProgress(snapshot);
  const joinUrl = typeof window === "undefined" ? "" : `${window.location.origin}/game/${snapshot.game.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(joinUrl)}`;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Fish Bowl</strong>
          <span className="eyebrow">Host: {host?.name ?? "loading"}</span>
        </div>
        <Link className="button secondary" href="/">
          Home
        </Link>
      </header>

      <section className="status-panel stack">
        <div className="button-row">
          <div>
            <span className="muted tiny">Join code</span>
            <div className="code">{snapshot.game.code}</div>
          </div>
          <div>
            <span className="muted tiny">Status</span>
            <p className="muted">
              {snapshot.game.phase === "setup"
                ? "Host setup"
                : snapshot.game.phase === "lobby"
                  ? "Collecting prompts"
                  : `${getRoundName(snapshot.game.round_number)} - ${snapshot.game.phase}`}
            </p>
          </div>
        </div>
        {isHost && snapshot.game.phase !== "setup" && !isPassAndPlay(snapshot) ? (
          <div className="split">
            <Image className="qr" src={qrUrl} alt="QR code for joining this game" width={164} height={164} unoptimized />
            <div className="stack">
              <span className="muted tiny">Join link</span>
              <a className="input tiny" href={joinUrl}>
                {joinUrl}
              </a>
            </div>
          </div>
        ) : null}
      </section>

      {!me ? (
        <JoinThisGame
          snapshot={snapshot}
          onSubmit={handleJoin}
          name={joinName}
          setName={setJoinName}
          busy={busy}
          onReclaimPlayer={handleReclaimPlayer}
        />
      ) : snapshot.game.phase === "setup" ? (
        <Setup
          busy={busy}
          isHost={isHost}
          promptsPerPlayer={promptsPerPlayer}
          setPromptsPerPlayer={setPromptsPerPlayer}
          turnDurationSeconds={turnDurationSeconds}
          setTurnDurationSeconds={setTurnDurationSeconds}
          cardsDealtPerPlayer={cardsDealtPerPlayer}
          setCardsDealtPerPlayer={setCardsDealtPerPlayer}
          cardsKeptPerPlayer={cardsKeptPerPlayer}
          setCardsKeptPerPlayer={setCardsKeptPerPlayer}
          teamCount={teamCount}
          setTeamCount={handleTeamCountChange}
          teamNames={teamNames}
          setTeamNames={setTeamNames}
          expectedPlayers={expectedPlayers}
          setExpectedPlayers={setExpectedPlayers}
          teamAssignmentMode={teamAssignmentMode}
          setTeamAssignmentMode={setTeamAssignmentMode}
          promptMode={promptMode}
          setPromptMode={setPromptMode}
          promptCategories={promptCategories}
          setPromptCategories={setPromptCategories}
          playMode={playMode}
          setPlayMode={setPlayMode}
          passAndPlayCardCount={passAndPlayCardCount}
          setPassAndPlayCardCount={setPassAndPlayCardCount}
          passAndPlayCategories={passAndPlayCategories}
          setPassAndPlayCategories={setPassAndPlayCategories}
          passAndPlayPlayers={passAndPlayPlayers}
          setPassAndPlayPlayers={setPassAndPlayPlayers}
          setPassAndPlayPlayerCount={handlePassAndPlayPlayerCountChange}
          onSave={handleSetupSave}
        />
      ) : snapshot.game.phase === "lobby" ? (
        <Lobby
          snapshot={snapshot}
          me={me}
          isHost={isHost}
          busy={busy}
          joinName={joinName}
          setJoinName={setJoinName}
          promptText={promptText}
          setPromptText={setPromptText}
          categoryPromptValues={categoryPromptValues}
          setCategoryPromptValues={setCategoryPromptValues}
          promptCount={promptCount}
          promptProgress={promptProgress}
          onNameSave={handleNameSave}
          onPromptSubmit={handleSubmitPrompts}
          onChooseTeam={handleChooseTeam}
          onAssignPlayerToTeam={handleAssignPlayerToTeam}
          onDraftCardToggle={handleDraftCardToggle}
          onStart={() =>
            runAction(async () => {
              await startGame(snapshot);
              trackSnapshotEvent("game_started", snapshot, {
                cardsDealtPerPlayer: snapshot.game.cards_dealt_per_player,
                cardsKeptPerPlayer: snapshot.game.cards_kept_per_player,
                expectedPlayers: snapshot.game.expected_players,
                passAndPlayCardCount: snapshot.game.pass_play_card_count,
                promptsPerPlayer: snapshot.game.prompts_per_player,
                selectedCategories: (snapshot.game.prompt_categories ?? [MIXED_PASS_PLAY_CATEGORY]).join(","),
                turnDurationSeconds: snapshot.game.turn_duration_seconds
              });
            })
          }
        />
      ) : (
        <Play
          snapshot={snapshot}
          me={me}
          activePlayer={activePlayer}
          currentPrompt={currentPrompt}
          busy={busy}
          isHost={isHost}
          onCorrect={() =>
            runAction(async () => {
              await markCorrect(snapshot);
              trackSnapshotEvent("correct", snapshot, {
                promptId: snapshot.game.current_prompt_id
              });
            })
          }
          onSkip={() =>
            runAction(async () => {
              await skipPrompt(snapshot);
              trackSnapshotEvent("skip", snapshot, {
                promptId: snapshot.game.current_prompt_id
              });
            })
          }
          onEndTurn={() =>
            runAction(async () => {
              await endTurn(snapshot);
              trackSnapshotEvent("turn_ended", snapshot);
            })
          }
          onStartTurn={() =>
            runAction(async () => {
              await startTurn(snapshot);
              trackSnapshotEvent("turn_started", snapshot, {
                activePlayerId: snapshot.game.active_player_id,
                currentTeamId: snapshot.game.current_team_id
              });
            })
          }
          onPause={() =>
            runAction(async () => {
              await pauseGame(snapshot);
              trackSnapshotEvent("game_paused", snapshot);
            })
          }
          onResume={() =>
            runAction(async () => {
              await resumeGame(snapshot);
              trackSnapshotEvent("game_resumed", snapshot);
            })
          }
          onUndo={() =>
            runAction(async () => {
              await undoLastAction(snapshot);
              trackSnapshotEvent("action_undone", snapshot, {
                action: snapshot.latestUndoableEvent?.action ?? null
              });
            })
          }
          onFinishGame={() => {
            if (window.confirm("End the game now?")) {
              runAction(async () => {
                await finishGame(snapshot);
                trackSnapshotEvent("game_finished", snapshot);
              });
            }
          }}
          onResetToLobby={() => {
            if (window.confirm("Reset scores and return to the lobby?")) {
              runAction(async () => {
                await resetToLobby(snapshot);
                trackSnapshotEvent("reset_to_lobby", snapshot);
              });
            }
          }}
        />
      )}

      {error ? <p className="notice">{error}</p> : null}
    </main>
  );
}

function Setup({
  busy,
  isHost,
  promptsPerPlayer,
  setPromptsPerPlayer,
  turnDurationSeconds,
  setTurnDurationSeconds,
  cardsDealtPerPlayer,
  setCardsDealtPerPlayer,
  cardsKeptPerPlayer,
  setCardsKeptPerPlayer,
  teamCount,
  setTeamCount,
  teamNames,
  setTeamNames,
  expectedPlayers,
  setExpectedPlayers,
  teamAssignmentMode,
  setTeamAssignmentMode,
  promptMode,
  setPromptMode,
  promptCategories,
  setPromptCategories,
  playMode,
  setPlayMode,
  passAndPlayCardCount,
  setPassAndPlayCardCount,
  passAndPlayCategories,
  setPassAndPlayCategories,
  passAndPlayPlayers,
  setPassAndPlayPlayers,
  setPassAndPlayPlayerCount,
  onSave
}: {
  busy: boolean;
  isHost: boolean;
  promptsPerPlayer: number;
  setPromptsPerPlayer: (count: number) => void;
  turnDurationSeconds: number;
  setTurnDurationSeconds: (seconds: number) => void;
  cardsDealtPerPlayer: number;
  setCardsDealtPerPlayer: (count: number) => void;
  cardsKeptPerPlayer: number;
  setCardsKeptPerPlayer: (count: number) => void;
  teamCount: number;
  setTeamCount: (count: number) => void;
  teamNames: string[];
  setTeamNames: (names: string[]) => void;
  expectedPlayers: string;
  setExpectedPlayers: (count: string) => void;
  teamAssignmentMode: TeamAssignmentMode;
  setTeamAssignmentMode: (mode: TeamAssignmentMode) => void;
  promptMode: PromptMode;
  setPromptMode: (mode: PromptMode) => void;
  promptCategories: string[];
  setPromptCategories: (categories: string[]) => void;
  playMode: PlayMode;
  setPlayMode: (mode: PlayMode) => void;
  passAndPlayCardCount: number;
  setPassAndPlayCardCount: (count: number) => void;
  passAndPlayCategories: string[];
  setPassAndPlayCategories: (categories: string[]) => void;
  passAndPlayPlayers: PassAndPlaySetupPlayer[];
  setPassAndPlayPlayers: (players: PassAndPlaySetupPlayer[]) => void;
  setPassAndPlayPlayerCount: (count: number) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!isHost) {
    return (
      <section className="card">
        <h2>Waiting for host</h2>
        <p className="muted">The host is choosing teams and prompt count.</p>
      </section>
    );
  }

  return (
    <form className="card stack" onSubmit={onSave}>
      <h2>Game setup</h2>
      <div className="field">
        <label>Play mode</label>
        <div className="segmented">
          <button
            className={playMode === "multi_device" ? "segment active" : "segment"}
            type="button"
            onClick={() => setPlayMode("multi_device")}
          >
            <strong>Everyone joins</strong>
            <span>Players use their own phones.</span>
          </button>
          <button
            className={playMode === "pass_and_play" ? "segment active" : "segment"}
            type="button"
            onClick={() => {
              setPlayMode("pass_and_play");
              if (playMode !== "pass_and_play") setPromptMode("deck");
            }}
          >
            <strong>Pass & Play</strong>
            <span>One shared device, passed around.</span>
          </button>
        </div>
      </div>
      {playMode === "pass_and_play" ? (
        <PassAndPlaySetup
          cardCount={passAndPlayCardCount}
          categories={passAndPlayCategories}
          playerCount={passAndPlayPlayers.length}
          players={passAndPlayPlayers}
          promptMode={promptMode}
          promptsPerPlayer={promptsPerPlayer}
          setCardCount={setPassAndPlayCardCount}
          setCategories={setPassAndPlayCategories}
          setPlayerCount={setPassAndPlayPlayerCount}
          setPlayers={setPassAndPlayPlayers}
          setPromptMode={setPromptMode}
          setPromptsPerPlayer={setPromptsPerPlayer}
          teamCount={teamCount}
          teamNames={teamNames}
        />
      ) : null}
      <div className="split">
        {playMode === "multi_device" ? (
          <div className="field">
          <label htmlFor="expectedPlayers">Expected players</label>
          <input
            className="input"
            id="expectedPlayers"
            inputMode="numeric"
            min={1}
            max={200}
            pattern="[0-9]*"
            type="text"
            value={expectedPlayers}
            onChange={(event) => setExpectedPlayers(event.target.value.replace(/\D/g, ""))}
            placeholder="Optional"
          />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="teamCount">Teams</label>
          <MobileNumberInput
            id="teamCount"
            min={1}
            max={12}
            value={teamCount}
            onValueChange={setTeamCount}
          />
        </div>
      </div>
      {playMode === "multi_device" ? (
        <div className="split">
          <div className="field">
            <label htmlFor="promptCount">Prompts per player</label>
            <MobileNumberInput
              disabled={promptMode === "deck"}
              id="promptCount"
              min={1}
              max={20}
              value={promptsPerPlayer}
              onValueChange={setPromptsPerPlayer}
            />
          </div>
          <div className="field">
            <label>Team assignment</label>
            <div className="segmented">
              <button
                className={teamAssignmentMode === "auto" ? "segment active" : "segment"}
                type="button"
                onClick={() => setTeamAssignmentMode("auto")}
              >
                Auto
              </button>
              <button
                className={teamAssignmentMode === "choose" ? "segment active" : "segment"}
                type="button"
                onClick={() => setTeamAssignmentMode("choose")}
              >
                Players choose
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="field">
        <label>Turn timer</label>
        <div className="segmented">
          {TURN_DURATION_OPTIONS.map((seconds) => (
            <button
              className={turnDurationSeconds === seconds ? "segment active" : "segment"}
              type="button"
              key={seconds}
              onClick={() => setTurnDurationSeconds(seconds)}
            >
              {seconds}s
            </button>
          ))}
        </div>
      </div>
      {playMode === "multi_device" ? (
        <div className="field">
          <label>Prompt mode</label>
          <div className="segmented">
            <button className={promptMode === "free" ? "segment active" : "segment"} type="button" onClick={() => setPromptMode("free")}>
              <strong>Anything goes</strong>
              <span>Players write their own prompts.</span>
            </button>
            <button className={promptMode === "category" ? "segment active" : "segment"} type="button" onClick={() => setPromptMode("category")}>
              <strong>Category prompts</strong>
              <span>Players write from assigned categories.</span>
            </button>
            <button
              className={promptMode === "deck" ? "segment active" : "segment"}
              type="button"
              onClick={() => setPromptMode("deck")}
            >
              <strong>Deck draft</strong>
              <span>Players choose cards from a shared deck.</span>
            </button>
          </div>
        </div>
      ) : null}
      {playMode === "multi_device" && promptMode !== "free" ? (
        <CategorySelector
          categories={promptCategories}
          helpText={
            promptMode === "deck"
              ? "Cards will be dealt from these categories. Mixed pulls from the full deck."
              : "Players will be asked for prompt ideas from these categories. Mixed spreads the prompts across the full set."
          }
          familyFriendlyText={promptMode === "deck" ? "Uses simple, all-ages cards." : "Uses simple, all-ages prompts."}
          showFamilyFriendly
          setCategories={setPromptCategories}
        />
      ) : null}
      {playMode === "multi_device" && promptMode === "deck" ? (
        <div className="split">
          <div className="field">
            <label htmlFor="cardsDealt">Cards dealt</label>
            <MobileNumberInput
              id="cardsDealt"
              min={1}
              max={20}
              value={cardsDealtPerPlayer}
              onCommit={(nextCount) => setCardsKeptPerPlayer(Math.min(cardsKeptPerPlayer, nextCount))}
              onValueChange={setCardsDealtPerPlayer}
            />
          </div>
          <div className="field">
            <label htmlFor="cardsKept">Cards kept</label>
            <MobileNumberInput
              id="cardsKept"
              min={1}
              max={cardsDealtPerPlayer}
              value={cardsKeptPerPlayer}
              onValueChange={setCardsKeptPerPlayer}
            />
          </div>
        </div>
      ) : null}
      <div className="stack">
        {teamNames.map((name, index) => (
          <div className="field" key={index}>
            <label htmlFor={`team-${index}`}>Team {index + 1}</label>
            <input
              className="input"
              id={`team-${index}`}
              value={name}
              onChange={(event) => {
                const nextNames = [...teamNames];
                nextNames[index] = event.target.value;
                setTeamNames(nextNames);
              }}
            />
          </div>
        ))}
      </div>
      <button className="button accent" disabled={busy}>
        Create lobby
      </button>
    </form>
  );
}

function PassAndPlaySetup({
  cardCount,
  categories,
  playerCount,
  players,
  promptMode,
  promptsPerPlayer,
  setCardCount,
  setCategories,
  setPlayerCount,
  setPlayers,
  setPromptMode,
  setPromptsPerPlayer,
  teamCount,
  teamNames
}: {
  cardCount: number;
  categories: string[];
  playerCount: number;
  players: PassAndPlaySetupPlayer[];
  promptMode: PromptMode;
  promptsPerPlayer: number;
  setCardCount: (count: number) => void;
  setCategories: (categories: string[]) => void;
  setPlayerCount: (count: number) => void;
  setPlayers: (players: PassAndPlaySetupPlayer[]) => void;
  setPromptMode: (mode: PromptMode) => void;
  setPromptsPerPlayer: (count: number) => void;
  teamCount: number;
  teamNames: string[];
}) {
  const groupedPlayers = teamNames.slice(0, teamCount).map((teamName, teamIndex) => ({
    teamName,
    players: players.filter((player) => player.teamIndex === teamIndex)
  }));

  return (
    <section className="setup-panel stack">
      <div className="field">
        <label>Pass & Play prompts</label>
        <div className="segmented">
          <button className={promptMode === "deck" ? "segment active" : "segment"} type="button" onClick={() => setPromptMode("deck")}>
            <strong>Built-in deck</strong>
            <span>Load cards automatically.</span>
          </button>
          <button className={promptMode === "free" ? "segment active" : "segment"} type="button" onClick={() => setPromptMode("free")}>
            <strong>Write prompts</strong>
            <span>Players make the deck together.</span>
          </button>
          <button className={promptMode === "category" ? "segment active" : "segment"} type="button" onClick={() => setPromptMode("category")}>
            <strong>Category prompts</strong>
            <span>Players write from assigned categories.</span>
          </button>
        </div>
      </div>

      <div className="split">
        <div className="field">
          <label htmlFor="passPlayerCount">Players</label>
          <MobileNumberInput id="passPlayerCount" min={2} max={40} value={playerCount} onValueChange={setPlayerCount} />
        </div>
        {promptMode === "deck" ? (
          <div className="field">
            <label htmlFor="passCardCount">Cards in game</label>
            <MobileNumberInput id="passCardCount" min={10} max={80} value={cardCount} onValueChange={setCardCount} />
            <p className="muted tiny">Default adjusts by player count to stay near a 40-50 card game.</p>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="passPromptCount">Prompts per player</label>
            <MobileNumberInput id="passPromptCount" min={1} max={20} value={promptsPerPlayer} onValueChange={setPromptsPerPlayer} />
            <p className="muted tiny">Pass the phone around during the lobby and collect this many prompts per player.</p>
          </div>
        )}
      </div>

      {promptMode !== "free" ? (
        <CategorySelector
          categories={categories}
          helpText={
            promptMode === "deck"
              ? "Cards will be loaded from these categories. Mixed pulls from the full deck."
              : "The shared prompt form will ask for ideas from these categories."
          }
          familyFriendlyText={promptMode === "deck" ? "Uses simple, all-ages cards." : "Uses simple, all-ages prompts."}
          showFamilyFriendly
          setCategories={setCategories}
        />
      ) : null}

      <div className="stack">
        <h3>Players</h3>
        {players.map((player, index) => (
          <div className="player-setup-row" key={index}>
            <div className="field">
              <label htmlFor={`pass-player-${index}`}>Player {index + 1}</label>
              <input
                className={isDefaultPassAndPlayPlayerName(player.name, index) ? "input placeholder-value" : "input"}
                id={`pass-player-${index}`}
                value={player.name}
                onFocus={() => {
                  if (!isDefaultPassAndPlayPlayerName(player.name, index)) return;
                  const nextPlayers = [...players];
                  nextPlayers[index] = { ...player, name: "" };
                  setPlayers(nextPlayers);
                }}
                placeholder={`Player ${index + 1}`}
                onChange={(event) => {
                  const nextPlayers = [...players];
                  nextPlayers[index] = { ...player, name: event.target.value };
                  setPlayers(nextPlayers);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor={`pass-team-${index}`}>Team</label>
              <select
                className="team-select wide"
                id={`pass-team-${index}`}
                value={player.teamIndex}
                onChange={(event) => {
                  const nextPlayers = [...players];
                  nextPlayers[index] = { ...player, teamIndex: Number(event.target.value) };
                  setPlayers(nextPlayers);
                }}
              >
                {teamNames.slice(0, teamCount).map((teamName, teamIndex) => (
                  <option key={teamIndex} value={teamIndex}>
                    {teamName || `Team ${teamIndex + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="team-rosters">
        {groupedPlayers.map((team, teamIndex) => (
          <section className="team-roster" key={teamIndex}>
            <div className="team-roster-heading">
              <strong>{team.teamName}</strong>
              <span>{team.players.length}</span>
            </div>
            <ul className="list">
              {team.players.map((player, index) => (
                <li className="list-item compact" key={`${team.teamName}-${index}`}>
                  {player.name || "Unnamed player"}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

function CategorySelector({
  categories,
  familyFriendlyText = "Uses simple, all-ages cards.",
  helpText,
  showFamilyFriendly = false,
  setCategories
}: {
  categories: string[];
  familyFriendlyText?: string;
  helpText?: string;
  showFamilyFriendly?: boolean;
  setCategories: (categories: string[]) => void;
}) {
  const familyFriendlyEnabled = hasFamilyFriendlyDeckFilter(categories);

  function toggleCategory(categoryId: string) {
    if (categoryId === MIXED_PASS_PLAY_CATEGORY) {
      setCategories([MIXED_PASS_PLAY_CATEGORY]);
      return;
    }

    const withoutMixed = categories.filter((category) => category !== MIXED_PASS_PLAY_CATEGORY && category !== FAMILY_FRIENDLY_DECK_FILTER);
    const nextCategories = withoutMixed.includes(categoryId)
      ? withoutMixed.filter((category) => category !== categoryId)
      : [...withoutMixed, categoryId];
    setCategories(nextCategories.length > 0 ? nextCategories : [MIXED_PASS_PLAY_CATEGORY]);
  }

  function toggleFamilyFriendly() {
    setCategories(familyFriendlyEnabled ? [MIXED_PASS_PLAY_CATEGORY] : [MIXED_PASS_PLAY_CATEGORY, FAMILY_FRIENDLY_DECK_FILTER]);
  }

  return (
    <div className="field">
      <label>Categories</label>
      {helpText ? <p className="muted tiny">{helpText}</p> : null}
      {showFamilyFriendly ? (
        <button
          className={familyFriendlyEnabled ? "team-choice selected family-choice" : "team-choice family-choice"}
          type="button"
          onClick={toggleFamilyFriendly}
        >
          <strong>Family Friendly</strong>
          <span>{familyFriendlyText}</span>
        </button>
      ) : null}
      <div className="category-toggle-grid">
        <button
          className={!familyFriendlyEnabled && categories.includes(MIXED_PASS_PLAY_CATEGORY) ? "team-choice selected" : "team-choice"}
          type="button"
          onClick={() => toggleCategory(MIXED_PASS_PLAY_CATEGORY)}
        >
          <strong>Mixed</strong>
          <span>Balanced pull</span>
        </button>
        {PASS_PLAY_CATEGORY_OPTIONS.map((category) => (
          <button
            className={!familyFriendlyEnabled && categories.includes(category.id) ? "team-choice selected" : "team-choice"}
            key={category.id}
            type="button"
            onClick={() => toggleCategory(category.id)}
          >
            <strong>{category.label}</strong>
            <span>{!familyFriendlyEnabled && categories.includes(category.id) ? "Included" : "Tap to include"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function isDefaultPassAndPlayPlayerName(name: string, index: number) {
  return name === `Player ${index + 1}`;
}

function MobileNumberInput({
  disabled = false,
  id,
  max,
  min,
  onCommit,
  onValueChange,
  value
}: {
  disabled?: boolean;
  id: string;
  max: number;
  min: number;
  onCommit?: (value: number) => void;
  onValueChange: (value: number) => void;
  value: number;
}) {
  const [draftValue, setDraftValue] = useState(String(value));

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  function clamp(nextValue: number) {
    return Math.min(max, Math.max(min, nextValue));
  }

  function commit(nextDraftValue: string) {
    if (!nextDraftValue) {
      setDraftValue(String(value));
      onCommit?.(value);
      return;
    }

    const nextValue = clamp(Number(nextDraftValue));
    setDraftValue(String(nextValue));
    onValueChange(nextValue);
    onCommit?.(nextValue);
  }

  return (
    <input
      className="input"
      disabled={disabled}
      id={id}
      inputMode="numeric"
      max={max}
      min={min}
      pattern="[0-9]*"
      type="text"
      value={draftValue}
      onBlur={() => commit(draftValue)}
      onChange={(event) => {
        const nextDraftValue = event.target.value.replace(/\D/g, "");
        setDraftValue(nextDraftValue);
        if (!nextDraftValue) return;
        onValueChange(clamp(Number(nextDraftValue)));
      }}
    />
  );
}

function JoinThisGame({
  snapshot,
  onSubmit,
  name,
  setName,
  busy,
  onReclaimPlayer
}: {
  snapshot: GameSnapshot;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  name: string;
  setName: (name: string) => void;
  busy: boolean;
  onReclaimPlayer: (playerId: string) => void;
}) {
  return (
    <div className="stack">
      <form className="card stack" onSubmit={onSubmit}>
        <h2>Join this game</h2>
        <p className="muted">Enter your name to claim this phone as a player.</p>
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input className="input" id="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </div>
        <button className="button accent" disabled={busy}>
          Join
        </button>
      </form>
      {snapshot.players.length > 0 ? (
        <section className="card stack">
          <h2>Rejoin as yourself</h2>
          <p className="muted">Lost your tab? Pick your name to reconnect on this phone.</p>
          <div className="button-list">
            {snapshot.players.map((player) => (
              <button className="button secondary" disabled={busy} key={player.id} onClick={() => onReclaimPlayer(player.id)}>
                {player.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Lobby({
  snapshot,
  me,
  isHost,
  busy,
  joinName,
  setJoinName,
  promptText,
  setPromptText,
  categoryPromptValues,
  setCategoryPromptValues,
  promptCount,
  promptProgress,
  onNameSave,
  onPromptSubmit,
  onChooseTeam,
  onAssignPlayerToTeam,
  onDraftCardToggle,
  onStart
}: {
  snapshot: GameSnapshot;
  me: Player;
  isHost: boolean;
  busy: boolean;
  joinName: string;
  setJoinName: (name: string) => void;
  promptText: string;
  setPromptText: (text: string) => void;
  categoryPromptValues: string[];
  setCategoryPromptValues: (values: string[]) => void;
  promptCount: number;
  promptProgress: { submittedTotal: number; requiredTotal: number; expectedTotal: number | null; isComplete: boolean };
  onNameSave: (event: FormEvent<HTMLFormElement>) => void;
  onPromptSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChooseTeam: (teamId: string) => void;
  onAssignPlayerToTeam: (playerId: string, teamId: string) => void;
  onDraftCardToggle: (draftCardId: string, selected: boolean) => void;
  onStart: () => void;
}) {
  const myPromptCount = getPromptCountForPlayer(me.id, snapshot.prompts);
  const myDraftCards = snapshot.draftCards.filter((card) => card.player_id === me.id);
  const myDraftSelectedCount = getDraftSelectedCountForPlayer(me.id, snapshot);
  const passAndPlay = isPassAndPlay(snapshot);
  const isDeckDraft = snapshot.game.prompt_mode === "deck";
  const passAndPlayDeck = passAndPlay && isDeckDraft;
  const sharedPromptTarget = snapshot.players.length * snapshot.game.prompts_per_player;
  const submittedPromptCount = passAndPlay ? snapshot.prompts.length : myPromptCount;
  const requiredPromptCount = passAndPlayDeck ? snapshot.game.pass_play_card_count : passAndPlay ? sharedPromptTarget : snapshot.game.prompts_per_player;
  const myPromptsLeft = Math.max(0, requiredPromptCount - submittedPromptCount);
  const pendingPromptLines = promptText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
  const categoryPrompts = getPromptCategoriesForPlayer(
    snapshot.game.id,
    me.id,
    requiredPromptCount,
    snapshot.game.prompt_categories ?? [MIXED_PASS_PLAY_CATEGORY]
  );
  const remainingCategories = categoryPrompts.slice(submittedPromptCount, submittedPromptCount + myPromptsLeft);
  const pendingCategoryPromptCount = categoryPromptValues.filter((value) => value.trim()).length;
  const pendingPromptCount = snapshot.game.prompt_mode === "category" ? pendingCategoryPromptCount : pendingPromptLines;
  const canSubmitPrompts = !isDeckDraft && myPromptsLeft > 0 && pendingPromptCount > 0;
  const canSelfSwitchTeams = snapshot.game.team_assignment_mode === "choose" && !passAndPlay;
  const needsTeam = canSelfSwitchTeams && !me.team_id;
  const allPlayersHaveTeams = snapshot.players.every((player) => Boolean(player.team_id));
  const canStart = promptProgress.isComplete && allPlayersHaveTeams;
  const progressLabel = passAndPlayDeck ? "Card deck" : isDeckDraft ? "Draft progress" : "Prompt progress";
  const teamBalanceWarning = getTeamBalanceWarning(snapshot);

  return (
    <div className="stack">
      <section className="card stack">
        <h2>Lobby</h2>
        <p className="muted">
          {snapshot.game.expected_players
            ? `Players: ${snapshot.players.length} / ${snapshot.game.expected_players}. `
            : `${snapshot.players.length} players connected. `}
          {progressLabel}: {promptProgress.submittedTotal} / {promptProgress.requiredTotal}.
          {promptProgress.expectedTotal && promptProgress.expectedTotal !== promptProgress.requiredTotal
            ? ` Expected total: ${promptProgress.expectedTotal}.`
            : ""}
        </p>
        {passAndPlay ? <p className="notice warning">Pass & Play is on. Keep this phone with the host, then pass it to each active player when prompted.</p> : null}
        {isHost && teamBalanceWarning ? <p className="notice warning">{teamBalanceWarning}</p> : null}
        <TeamRosters snapshot={snapshot} me={me} isHost={isHost} busy={busy} onAssignPlayerToTeam={onAssignPlayerToTeam} />
      </section>

      {canSelfSwitchTeams ? (
        <section className="card stack">
          <h2>{needsTeam ? "Choose your team" : "Switch team"}</h2>
          <div className="team-choice-grid">
            {snapshot.teams.map((team) => (
              <button className={me.team_id === team.id ? "team-choice selected" : "team-choice"} key={team.id} onClick={() => onChooseTeam(team.id)} disabled={busy || me.team_id === team.id}>
                <strong>{team.name}</strong>
                <span>{me.team_id === team.id ? "Your team" : `${getTeamRoster(team.id, snapshot.players).length} players`}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {!passAndPlay ? (
        <form className="card stack" onSubmit={onNameSave}>
          <h2>Your name</h2>
          <div className="field">
            <label htmlFor="rename">Name</label>
            <input
              className="input"
              id="rename"
              value={joinName}
              placeholder={me.name}
              onChange={(event) => setJoinName(event.target.value)}
            />
          </div>
          <button className="button secondary" disabled={busy || !joinName.trim()}>
            Save name
          </button>
        </form>
      ) : null}

      {passAndPlayDeck ? (
        <section className="card stack">
          <h2>Card deck ready</h2>
          <p className="muted">
            {snapshot.prompts.length} cards are loaded for this one-phone game. Start when teams look right.
          </p>
        </section>
      ) : isDeckDraft ? (
        <section className="card stack">
          <h2>Pick your cards</h2>
          <p className="muted">
            {needsTeam
              ? "Choose a team first."
              : `Chosen ${myDraftSelectedCount} of ${snapshot.game.cards_kept_per_player}. These become the shared deck.`}
          </p>
          <div className="draft-grid">
            {myDraftCards.map((card) => (
              <button
                className={card.selected ? "draft-card selected" : "draft-card"}
                disabled={busy || needsTeam || (!card.selected && myDraftSelectedCount >= snapshot.game.cards_kept_per_player)}
                key={card.id}
                onClick={() => onDraftCardToggle(card.id, !card.selected)}
                type="button"
              >
                <span className={card.selected ? "pill" : "pill pending"}>{card.selected ? "Picked" : "Available"}</span>
                <strong>{card.title}</strong>
                <span>{card.description}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <form className="card stack" onSubmit={onPromptSubmit}>
          <h2>Submit prompts</h2>
          <p className="muted">
            {needsTeam
              ? "Choose a team first."
              : passAndPlay
                ? `Shared prompts: ${snapshot.prompts.length} / ${sharedPromptTarget}`
                : `Your prompts: ${myPromptCount} / ${snapshot.game.prompts_per_player}`}
          </p>
          {snapshot.game.prompt_mode === "category" ? (
            <div className="stack">
              {remainingCategories.map((category, index) => (
                <div className="field category-field" key={`${category}-${index}`}>
                  <label htmlFor={`category-prompt-${index}`}>Write a prompt for</label>
                  <strong>{category}</strong>
                  <input
                    className="input"
                    id={`category-prompt-${index}`}
                    value={categoryPromptValues[index] ?? ""}
                    onChange={(event) => {
                      const nextValues = [...categoryPromptValues];
                      nextValues[index] = event.target.value;
                      setCategoryPromptValues(nextValues);
                    }}
                    placeholder={category.includes(" ") ? "Your funny answer" : category}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="field">
              <label htmlFor="prompts">Prompts</label>
              <textarea
                className="textarea"
                id="prompts"
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                placeholder="Write anything you want, just make sure people can actually guess it!"
              />
            </div>
          )}
          <button className="button accent" disabled={busy || needsTeam || !canSubmitPrompts}>
            {myPromptsLeft > 0
              ? `Submit ${Math.min(myPromptsLeft, pendingPromptCount) || ""} prompt${Math.min(myPromptsLeft, pendingPromptCount) === 1 ? "" : "s"}`
              : "All prompts submitted"}
          </button>
        </form>
      )}

      {isHost ? (
        <section className="card stack">
          <h2>Host controls</h2>
          <p className="muted">
            Start when everyone reaches{" "}
            {passAndPlayDeck
              ? `${snapshot.game.pass_play_card_count} loaded cards`
              : isDeckDraft
                ? `${snapshot.game.cards_kept_per_player} / ${snapshot.game.cards_kept_per_player} cards`
                : passAndPlay
                  ? `${sharedPromptTarget} shared prompts`
              : `${snapshot.game.prompts_per_player} / ${snapshot.game.prompts_per_player} prompts`}.
            {!allPlayersHaveTeams ? " Everyone also needs a team." : ""}
          </p>
          <button className="button blue" disabled={busy || (!isDeckDraft && promptCount < 1) || !canStart} onClick={onStart}>
            Start game
          </button>
        </section>
      ) : (
        <section className="card">
          <h2>Waiting for host</h2>
          <p className="muted">You are all set once your {isDeckDraft ? "cards are picked" : "prompts are submitted"}.</p>
        </section>
      )}
    </div>
  );
}

function TeamRosters({
  snapshot,
  me,
  isHost,
  busy,
  onAssignPlayerToTeam
}: {
  snapshot: GameSnapshot;
  me: Player;
  isHost: boolean;
  busy: boolean;
  onAssignPlayerToTeam: (playerId: string, teamId: string) => void;
}) {
  const unassignedPlayers = snapshot.players.filter((player) => !player.team_id);

  return (
    <div className="team-rosters">
      {snapshot.teams.map((team) => {
        const roster = getTeamRoster(team.id, snapshot.players);
        return (
          <section className="team-roster" key={team.id}>
            <div className="team-roster-heading">
              <strong>{team.name}</strong>
              <span>{roster.length}</span>
            </div>
            <ul className="list">
              {roster.map((player) => (
                <li className="list-item compact" key={player.id}>
                  <PlayerLobbyRow
                    busy={busy}
                    isHost={isHost}
                    me={me}
                    player={player}
                    snapshot={snapshot}
                    onAssignPlayerToTeam={onAssignPlayerToTeam}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {unassignedPlayers.length > 0 ? (
        <section className="team-roster">
          <div className="team-roster-heading">
            <strong>Choosing</strong>
            <span>{unassignedPlayers.length}</span>
          </div>
          <ul className="list">
            {unassignedPlayers.map((player) => (
              <li className="list-item compact" key={player.id}>
                <PlayerLobbyRow
                  busy={busy}
                  isHost={isHost}
                  me={me}
                  player={player}
                  snapshot={snapshot}
                  onAssignPlayerToTeam={onAssignPlayerToTeam}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PlayerLobbyRow({
  busy,
  isHost,
  me,
  player,
  snapshot,
  onAssignPlayerToTeam
}: {
  busy: boolean;
  isHost: boolean;
  me: Player;
  player: Player;
  snapshot: GameSnapshot;
  onAssignPlayerToTeam: (playerId: string, teamId: string) => void;
}) {
  const isDeckDraft = snapshot.game.prompt_mode === "deck";
  const passAndPlay = isPassAndPlay(snapshot);
  const progressCount = isDeckDraft
    ? getDraftSelectedCountForPlayer(player.id, snapshot)
    : getPromptCountForPlayer(player.id, snapshot.prompts);
  const progressRequired = isDeckDraft ? snapshot.game.cards_kept_per_player : snapshot.game.prompts_per_player;
  const isReady = isDeckDraft
    ? hasPlayerDrafted(player.id, snapshot)
    : hasPlayerSubmitted(player.id, snapshot.prompts, snapshot.game.prompts_per_player);

  return (
    <div className="player-row">
      <span>
        {player.name}
        {player.id === me.id ? " (you)" : ""}
      </span>
      <div className="player-row-actions">
        <span className={isReady ? "pill" : "pill pending"}>
          {player.team_id ? (passAndPlay ? "Pass & Play" : `${progressCount} / ${progressRequired}`) : "No team"}
        </span>
        {isHost ? (
          <select
            className="team-select"
            disabled={busy}
            value={player.team_id ?? ""}
            onChange={(event) => onAssignPlayerToTeam(player.id, event.target.value)}
          >
            <option value="" disabled>
              Move
            </option>
            {snapshot.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}

function Play({
  snapshot,
  me,
  activePlayer,
  currentPrompt,
  busy,
  isHost,
  onCorrect,
  onSkip,
  onEndTurn,
  onStartTurn,
  onPause,
  onResume,
  onUndo,
  onFinishGame,
  onResetToLobby
}: {
  snapshot: GameSnapshot;
  me: Player;
  activePlayer: Player | null;
  currentPrompt: Prompt | null;
  busy: boolean;
  isHost: boolean;
  onCorrect: () => void;
  onSkip: () => void;
  onEndTurn: () => void;
  onStartTurn: () => void;
  onPause: () => void;
  onResume: () => void;
  onUndo: () => void;
  onFinishGame: () => void;
  onResetToLobby: () => void;
}) {
  const isActive = me.id === activePlayer?.id;
  const passAndPlay = isPassAndPlay(snapshot);
  const isController = isActive || (isHost && passAndPlay);
  const [now, setNow] = useState(Date.now());
  const [autoEndedTurnId, setAutoEndedTurnId] = useState<string | null>(null);
  const secondsLeft = getTurnSecondsLeft(snapshot.activeTurn?.started_at, snapshot.game.turn_duration_seconds, now);
  const isTurnRunning = snapshot.game.phase === "playing";
  const isPaused = snapshot.game.phase === "paused";

  useEffect(() => {
    if (!isTurnRunning) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [isTurnRunning, snapshot.activeTurn?.id]);

  useEffect(() => {
    if (!isTurnRunning || !isController || !snapshot.activeTurn || secondsLeft > 0 || autoEndedTurnId === snapshot.activeTurn.id) return;
    setAutoEndedTurnId(snapshot.activeTurn.id);
    onEndTurn();
  }, [autoEndedTurnId, isController, isTurnRunning, onEndTurn, secondsLeft, snapshot.activeTurn]);

  if (snapshot.game.phase === "finished") {
    return (
      <div className="stack">
        <Scoreboard snapshot={snapshot} celebrateWinner />
        <section className="card winner-card stack">
          <h2>Game finished</h2>
          <p className="muted">All prompts were guessed through Charades.</p>
          <div className="winner-callout">{getWinningTeams(snapshot.teams).map((team) => team.name).join(" + ")} wins!</div>
          {isHost ? (
            <button className="button secondary" disabled={busy} onClick={onResetToLobby}>
              Reset to lobby
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <Scoreboard snapshot={snapshot} />
      <section className="card stack">
        <div className="round-banner">
          <span>Round {snapshot.game.round_number}</span>
          <strong>{getRoundName(snapshot.game.round_number)}</strong>
        </div>
        <div className="round-meta">
          <span>Turn {snapshot.game.turn_number}</span>
          <span>{snapshot.game.turn_duration_seconds}s timer</span>
          <span>{activePlayer?.name ?? "Someone"} is up</span>
        </div>
        {snapshot.game.phase === "ready" ? (
          <div className={snapshot.game.round_number > 1 ? "ready-panel round-transition stack" : "ready-panel stack"}>
            {snapshot.game.round_number > 1 ? (
              <>
                <span className="pill">Round {snapshot.game.round_number - 1} complete</span>
                <h2>Next up: {getRoundName(snapshot.game.round_number)}</h2>
                <p className="muted">{getRoundSummary(snapshot.game.round_number)}</p>
              </>
            ) : null}
            <p className="muted">
              {isController
                ? passAndPlay
                  ? `Pass the phone to ${activePlayer?.name ?? "the active player"}, then tap Ready.`
                  : "Tap ready when your team is listening."
                : `Waiting for ${activePlayer?.name ?? "the active player"} to start.`}
            </p>
            {isController ? (
              <button className="button accent" disabled={busy} onClick={onStartTurn}>
                Ready!
              </button>
            ) : null}
          </div>
        ) : null}
        {isPaused ? (
          <div className="ready-panel stack">
            <h2>Game paused</h2>
            <p className="muted">The host paused the timer.</p>
          </div>
        ) : null}
        {isTurnRunning ? (
          <>
            <div className={secondsLeft <= 10 ? "timer urgent" : "timer"} aria-live="polite">
              {secondsLeft}s
            </div>
            <p className="muted">
              {isController
                ? passAndPlay
                  ? `${activePlayer?.name ?? "Active player"} is holding the phone. No peeking from the team.`
                  : "Show this screen to no one."
                : "Wait for your turn."}
            </p>
            <div className="prompt">{isController ? currentPrompt?.text ?? "No prompt" : "Waiting..."}</div>
            {isController && currentPrompt?.description ? <p className="card-note">{currentPrompt.description}</p> : null}
          </>
        ) : null}
        {isController && isTurnRunning ? (
          <div className="stack">
            <div className="button-row">
              <button className="button accent" disabled={busy || secondsLeft <= 0} onClick={onCorrect}>
                Correct
              </button>
              <button className="button warn" disabled={busy || secondsLeft <= 0} onClick={onSkip}>
                Skip
              </button>
            </div>
            <button className="button danger" disabled={busy} onClick={onEndTurn}>
              End turn
            </button>
          </div>
        ) : null}
        {isHost ? (
          <HostPlayControls
            busy={busy}
            canUndo={Boolean(snapshot.latestUndoableEvent)}
            isPaused={isPaused}
            isTurnRunning={isTurnRunning}
            onFinishGame={onFinishGame}
            onPause={onPause}
            onResetToLobby={onResetToLobby}
            onResume={onResume}
            onUndo={onUndo}
          />
        ) : null}
      </section>
    </div>
  );
}

function HostPlayControls({
  busy,
  canUndo,
  isPaused,
  isTurnRunning,
  onFinishGame,
  onPause,
  onResetToLobby,
  onResume,
  onUndo
}: {
  busy: boolean;
  canUndo: boolean;
  isPaused: boolean;
  isTurnRunning: boolean;
  onFinishGame: () => void;
  onPause: () => void;
  onResetToLobby: () => void;
  onResume: () => void;
  onUndo: () => void;
}) {
  return (
    <section className="host-play-controls stack">
      <h2>Host controls</h2>
      <div className="button-row">
        {isPaused ? (
          <button className="button accent" disabled={busy} onClick={onResume}>
            Resume
          </button>
        ) : (
          <button className="button secondary" disabled={busy || !isTurnRunning} onClick={onPause}>
            Pause
          </button>
        )}
        <button className="button secondary" disabled={busy || !canUndo} onClick={onUndo}>
          Undo last
        </button>
      </div>
      <div className="button-row">
        <button className="button warn" disabled={busy} onClick={onResetToLobby}>
          Reset lobby
        </button>
        <button className="button danger" disabled={busy} onClick={onFinishGame}>
          End game
        </button>
      </div>
    </section>
  );
}

function Scoreboard({ snapshot, celebrateWinner = false }: { snapshot: GameSnapshot; celebrateWinner?: boolean }) {
  const winningTeamIds = new Set(celebrateWinner ? getWinningTeams(snapshot.teams).map((team) => team.id) : []);
  return (
    <section className="score-grid">
      {snapshot.teams.map((team) => (
        <div className={winningTeamIds.has(team.id) ? "score winner" : "score"} key={team.id}>
          <span className="muted tiny">{team.name}</span>
          <strong>{team.score}</strong>
        </div>
      ))}
    </section>
  );
}
