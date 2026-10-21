import type { ReactNode } from "react";

interface FrameProps {
  title?: string;
  kicker?: string;
  children: ReactNode;
  className?: string;
}

export function CommandFrame({ title, kicker, children, className }: FrameProps) {
  return (
    <section className={className ? `command-frame ${className}` : "command-frame"}>
      <span className="corner c-nw" aria-hidden="true" />
      <span className="corner c-ne" aria-hidden="true" />
      <span className="corner c-sw" aria-hidden="true" />
      <span className="corner c-se" aria-hidden="true" />
      {(kicker || title) && (
        <header className="frame-head">
          {kicker && <p className="kicker">{kicker}</p>}
          {title && <h2 className="frame-title">{title}</h2>}
        </header>
      )}
      {children}
    </section>
  );
}
