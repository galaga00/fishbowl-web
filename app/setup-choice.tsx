"use client";

export type SetupPath = "quick" | "custom";

const choices = [
  { id: "quick", title: "Quick game", description: "Built-in cards, one phone, ready in a few taps." },
  { id: "custom", title: "Custom game", description: "Write your own prompts, choose teams, and use one phone or everyone’s phones." }
] as const;

export function SetupChoice({ selected, busy, onSelect }: {
  selected: SetupPath | null;
  busy: boolean;
  onSelect: (path: SetupPath) => void;
}) {
  return (
    <section className="card setup-choice stack" aria-labelledby="setup-choice-title">
      <h2 id="setup-choice-title">How would you like to play?</h2>
      <div className="setup-choices" role="group" aria-label="Choose game setup">
        {choices.map(({ id, title, description }) => (
          <button key={id} type="button" className={selected === id ? "setup-option selected" : "setup-option"}
            aria-labelledby={`${id}-choice-title`} aria-describedby={`${id}-choice-description`}
            aria-pressed={selected === id} aria-controls={`${id}-setup`} disabled={busy}
            onClick={() => onSelect(id)}>
            <strong id={`${id}-choice-title`}>{title}</strong>
            <span id={`${id}-choice-description`}>{description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
