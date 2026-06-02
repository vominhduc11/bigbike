import type { ReactNode } from "react";
import { stateTitle } from "@/lib/ui-classes";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section
      className="bb-empty-state grid justify-items-center gap-3 border border-border bg-card p-6 text-center"
      aria-live="polite"
    >
      <p className={stateTitle}>
        {title}
      </p>
      <p className="m-0 text-muted-foreground">{description}</p>
      {action}
    </section>
  );
}
