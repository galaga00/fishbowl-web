"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PASS_PLAY_CATEGORY_OPTIONS } from "@/lib/pass-play-deck";
import type { GameSnapshot, Player } from "@/lib/types";

export function CategoryVoteLobby({ snapshot, me, busy, roster, onStartVoting, onVote, onCloseRound, onStartGame, onEditSetup, onChooseTeam, onRename }: {
  snapshot: GameSnapshot; me: Player; busy: boolean; roster: ReactNode;
  onStartVoting: () => void; onVote: (category: string) => void; onCloseRound: () => void;
  onStartGame: () => void; onEditSetup: () => void; onChooseTeam: (teamId: string) => void; onRename: (name: string) => void;
}) {
  const [name, setName] = useState(me.name);
  const vote = snapshot.categoryVote;
  const complete = vote?.status === "complete";
  const teamReady = snapshot.players.every((player) => player.team_id);
  return <div className="stack voting-lobby">
    {vote ? <VotingPanel key={`${vote.id}:${vote.round}:${vote.status}`} vote={vote} expectedPlayers={snapshot.game.expected_players} playerCount={snapshot.players.length} cardCount={snapshot.game.vote_card_count ?? 40} isHost={me.is_host} busy={busy} onStart={onStartVoting} onVote={onVote} onClose={onCloseRound} /> : <p role="status">Loading category vote…</p>}
    <section className="card stack">
      <h2>Lobby</h2>
      <p className="muted">{snapshot.players.length} players joined{snapshot.game.expected_players ? ` · ${snapshot.game.expected_players} expected` : ""}. Everyone uses their own phone.</p>
      {roster}
      {snapshot.game.team_assignment_mode === "choose" ? <div className="field">
        <label htmlFor="vote-team">Your team</label>
        <select id="vote-team" className="input" value={me.team_id ?? ""} disabled={busy} onChange={(event) => onChooseTeam(event.target.value)}>
          <option value="" disabled>Choose your team</option>
          {snapshot.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </div> : null}
    </section>
    <form className="card stack" onSubmit={(event) => { event.preventDefault(); onRename(name); }}>
      <label htmlFor="vote-name">Your name</label>
      <input id="vote-name" className="input" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
      <button className="button secondary" disabled={busy || !name.trim() || name.trim() === me.name}>Save name</button>
    </form>
    {me.is_host ? <section className="card stack">
      <h2>Host controls</h2>
      <p className="muted">{complete ? "The secret bowl is ready. Start when everyone is ready to play." : "Finish voting to fill the bowl, then start the game."}</p>
      {!teamReady ? <p className="notice">Everyone needs a team before the game starts.</p> : null}
      <button className="button accent" disabled={busy || !complete || !teamReady} onClick={onStartGame}>Start game</button>
      <button className="button secondary" disabled={busy || vote?.status === "voting"} onClick={onEditSetup}>Edit setup</button>
      {vote?.status === "voting" ? <p className="muted tiny">Setup is locked while voting is underway.</p> : null}
    </section> : complete ? <p className="notice" role="status">Waiting for the host to start the game.</p> : null}
  </div>;
}

function VotingPanel({ vote, expectedPlayers, playerCount, cardCount, isHost, busy, onStart, onVote, onClose }: {
  vote: NonNullable<GameSnapshot["categoryVote"]>; expectedPlayers: number | null; playerCount: number; cardCount: number;
  isHost: boolean; busy: boolean; onStart: () => void; onVote: (category: string) => void; onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (vote.status !== "waiting") heading.current?.focus(); }, [vote.status]);
  if (vote.status === "waiting") return <section className="card stack" aria-labelledby="vote-heading">
    <h2 id="vote-heading">Vote for the bowl</h2>
    <p>Everyone picks from the same three random categories, once per round. One category wins each round. The results stay secret.</p>
    <p className="muted">{vote.totalRounds} voting {vote.totalRounds === 1 ? "round" : "rounds"} · {cardCount} built-in cards · Same bowl for all three game rounds.</p>
    {isHost ? <>
      <p className="notice">Let everyone join before starting the vote. New players can join again once the bowl is ready.</p>
      <button className="button accent" disabled={busy || playerCount < 2} onClick={() => { if (expectedPlayers && playerCount < expectedPlayers) setConfirming(true); else onStart(); }}>Start category vote</button>
      {playerCount < 2 ? <p className="muted">Waiting for another player to join.</p> : null}
      {confirming ? <div className="confirmation-panel stack" role="alertdialog" aria-label="Start voting with fewer players?">
        <p>{playerCount} of {expectedPlayers} expected players have joined. Start voting with this group?</p>
        <div className="button-row"><button className="button secondary" disabled={busy} onClick={() => setConfirming(false)}>Keep waiting</button><button className="button accent" disabled={busy} onClick={onStart}>Start with these players</button></div>
      </div> : null}
    </> : <p role="status">Waiting for the host to start voting.</p>}
  </section>;
  if (vote.status === "complete") return <section className="card stack" aria-labelledby="vote-heading">
    <h2 ref={heading} tabIndex={-1} id="vote-heading">Your secret bowl is ready</h2>
    <p>{cardCount} cards are ready. You’ll discover the winning categories as you play.</p>
  </section>;
  return <section className="card stack" aria-labelledby="vote-heading">
    <h2 ref={heading} tabIndex={-1} id="vote-heading">Category vote {vote.round} of {vote.totalRounds}</h2>
    <p>Which category would you like in the bowl? Pick one. Votes lock when submitted; ties are decided randomly.</p>
    <div className="category-ballot" role="group" aria-label={`Category ballot ${vote.round}`}>
      {vote.choices.map((id) => <button key={id} type="button" className={vote.myVote === id ? "team-choice selected" : "team-choice"} aria-pressed={vote.myVote === id} disabled={busy || Boolean(vote.myVote)} onClick={() => onVote(id)}>
        <strong>{PASS_PLAY_CATEGORY_OPTIONS.find((category) => category.id === id)?.label ?? id}</strong>
        <span>{vote.myVote === id ? "Your vote is in" : "Vote for this category"}</span>
      </button>)}
    </div>
    <p role="status" aria-live="polite">{vote.votedCount} of {vote.voterCount} votes in. {vote.myVote ? "Waiting for the others." : "Your vote is still needed."}</p>
    {isHost ? <details>
      <summary>Someone can’t vote?</summary>
      <div className="stack">
        <p>Close this round using the votes already cast. Anyone who missed it can vote in the next round.</p>
        <button className="button secondary" disabled={busy || vote.votedCount === 0} onClick={() => setConfirming(true)}>Close voting round</button>
        {confirming ? <div className="confirmation-panel stack" role="alertdialog" aria-label="Close this voting round?">
          <p>Count the {vote.votedCount} votes received and close this round?</p>
          <div className="button-row"><button className="button secondary" disabled={busy} onClick={() => setConfirming(false)}>Keep waiting</button><button className="button accent" disabled={busy} onClick={onClose}>Count these votes</button></div>
        </div> : null}
      </div>
    </details> : null}
  </section>;
}
