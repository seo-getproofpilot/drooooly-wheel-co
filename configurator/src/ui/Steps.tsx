/* The five step names. The active step is blue; steps already reached are
   buttons that go back; later steps are shown but cannot be opened yet. */
import type { Step } from "../flow";
import { copy } from "./copy";

export function Steps({ active, reached, onGo }: { active: Step; reached: Step; onGo: (s: Step) => void }) {
  return (
    <nav aria-label="Build steps">
      <ol className="steps">
        {copy.stepNames.map((name, i) => {
          const n = (i + 1) as Step;
          const cls = n === active ? "is-active" : n <= reached ? "is-done" : "";
          return (
            <li key={name}>
              <button type="button" className={cls} disabled={n > reached} aria-current={n === active ? "step" : undefined}
                onClick={() => onGo(n)}>
                <b aria-hidden="true">{String(n).padStart(2, "0")}</b>
                <span>{name}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StepHead({ n, title, note }: { n: Step; title: string; note?: string }) {
  return (
    <header>
      <p className="step__count">{copy.stepOf(n)}</p>
      <h2 id={"step-" + n}>{title}</h2>
      {note && <p className="step__note">{note}</p>}
    </header>
  );
}

export function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return <button type="button" className="chip" aria-pressed={on} aria-label={label} onClick={onClick}>{children}</button>;
}
