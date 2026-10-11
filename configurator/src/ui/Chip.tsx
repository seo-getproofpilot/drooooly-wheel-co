import type { ReactNode } from "react";

export function Chip({ on, onClick, children, label, title }: { on: boolean; onClick: () => void; children: ReactNode; label?: string; title?: string }) {
  return <button type="button" className="chip" aria-pressed={on} aria-label={label} title={title} onClick={onClick}>{children}</button>;
}

export function Section({ id, label, children, aside }: { id: string; label: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="sec" id={id} aria-labelledby={id + "-h"}>
      <header className="sec__head">
        <h2 id={id + "-h"}>{label}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
