"use client";

import { useEffect, useState } from "react";
import { isAnalyticsIgnored, setAnalyticsIgnored } from "@/lib/analytics";

export function IgnoreAnalyticsControl() {
  const [ignored, setIgnored] = useState(false);
  const [ignoreUrl, setIgnoreUrl] = useState("");

  useEffect(() => {
    setIgnored(isAnalyticsIgnored());
    setIgnoreUrl(`${window.location.origin}/?ignoreAnalytics=1`);

    function handleChange() {
      setIgnored(isAnalyticsIgnored());
    }

    window.addEventListener("fish-bowl-analytics-ignore-change", handleChange);
    return () => window.removeEventListener("fish-bowl-analytics-ignore-change", handleChange);
  }, []);

  function toggleIgnored() {
    const nextIgnored = !ignored;
    setAnalyticsIgnored(nextIgnored);
    setIgnored(nextIgnored);
  }

  return (
    <section className="card stack">
      <h2>Ignore this device</h2>
      <p className="muted">
        {ignored
          ? "Analytics from this browser are currently ignored."
          : "Use this on each browser or phone you test with so your activity does not count."}
      </p>
      <button className={ignored ? "button secondary" : "button accent"} type="button" onClick={toggleIgnored}>
        {ignored ? "Track this device again" : "Ignore this device"}
      </button>
      {ignoreUrl ? (
        <div className="field">
          <label htmlFor="ignore-url">Opt-out link for other browsers</label>
          <input
            className="input tiny"
            id="ignore-url"
            readOnly
            value={ignoreUrl}
            onFocus={(event) => event.currentTarget.select()}
          />
          <p className="muted tiny">Open this once in Chrome, Safari, your phone, or any browser you want ignored.</p>
        </div>
      ) : null}
    </section>
  );
}
