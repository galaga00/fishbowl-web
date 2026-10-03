"use client";

import { useState } from "react";

export function PurgeDataControl({ ownerKey }: { ownerKey: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function purgeData() {
    if (confirmation !== "DELETE ALL DATA") return;

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/owner/purge", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ key: ownerKey })
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !result?.ok) {
        setMessage(result?.error ? `Purge failed: ${result.error}` : "Purge failed. Check logs and try again.");
        return;
      }

      setMessage("Data purged. Refreshing dashboard...");
      window.location.reload();
    } catch {
      setMessage("Could not reach the server. No deletion was confirmed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack">
      <h2>Purge data</h2>
      <p className="muted">
        Permanently clears games, players, prompts, turns, draft cards, game events, and analytics. Use this when you want a fresh
        test slate.
      </p>
      <label htmlFor="purge-confirmation">Type DELETE ALL DATA to confirm permanent deletion.</label>
      <input className="input" id="purge-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
      <button className="button danger" disabled={busy || confirmation !== "DELETE ALL DATA"} type="button" onClick={purgeData}>
        {busy ? "Purging..." : "Purge data"}
      </button>
      {message ? <p className="muted tiny">{message}</p> : null}
    </section>
  );
}
