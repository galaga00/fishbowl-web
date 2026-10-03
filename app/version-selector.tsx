"use client";

import { useRef, useState } from "react";
import { GAME_VERSIONS, type GameVersion } from "@/lib/game-versions";

export function VersionSelector({ version, busy, onChange }: {
  version: GameVersion;
  busy: boolean;
  onChange: (version: GameVersion) => Promise<boolean>;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  async function select(nextVersion: GameVersion) {
    if (busy) return;
    if (nextVersion === version || await onChange(nextVersion)) {
      setExpanded(false);
      requestAnimationFrame(() => toggle.current?.focus());
    }
  }

  return (
    <section className="card version-selector stack" aria-label="Game version">
      <div className="version-heading">
        <strong>Version: {GAME_VERSIONS[version].title}</strong>
        <button ref={toggle} className="button secondary compact-button" type="button"
          aria-label={expanded ? "Close version choices" : "Change game version"}
          aria-expanded={expanded} aria-controls="version-choices" disabled={busy}
          onClick={() => setExpanded(!expanded)}>{expanded ? "Close" : "Change"}</button>
      </div>
      {expanded ? (
        <div id="version-choices" className="version-choices" role="group" aria-label="Choose a game version">
          {(Object.keys(GAME_VERSIONS) as GameVersion[]).map((id) => (
            <button key={id} type="button" className={id === version ? "version-choice selected" : "version-choice"}
              aria-pressed={id === version} disabled={busy} onClick={() => void select(id)}>
              <strong>{GAME_VERSIONS[id].title}</strong>
              <span>{GAME_VERSIONS[id].description}</span>
              <span className="version-choice-status">{id === version ? "Selected" : "Use this version"}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
