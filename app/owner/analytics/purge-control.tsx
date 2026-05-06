"use client";

import { useState } from "react";

export function PurgeDataControl({ ownerKey }: { ownerKey: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function purgeData() {
    const confirmed = window.confirm(
      "Are you sure? This will permanently delete all Fish Bowl games, players, prompts, turns, draft cards, game events, and analytics data."
    );
    if (!confirmed) return;

    const finalConfirmed = window.confirm("Last warning: this cannot be undone. Purge all data now?");
    if (!finalConfirmed) return;

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
      <button className="button danger" disabled={busy} type="button" onClick={purgeData}>
        {busy ? "Purging..." : "Purge data"}
      </button>
      {message ? <p className="muted tiny">{message}</p> : null}
    </section>
  );
}
