"use client";

import { useEffect, useState } from "react";
import { isAnalyticsIgnored, setAnalyticsIgnored } from "@/lib/analytics";

export function IgnoreAnalyticsControl() {
  const [ignored, setIgnored] = useState(false);

  useEffect(() => {
    setIgnored(isAnalyticsIgnored());

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
          : "Use this on your own phone or browser so your testing does not count."}
      </p>
      <button className={ignored ? "button secondary" : "button accent"} type="button" onClick={toggleIgnored}>
        {ignored ? "Track this device again" : "Ignore this device"}
      </button>
    </section>
  );
}
