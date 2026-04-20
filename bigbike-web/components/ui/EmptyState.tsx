import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="bb-empty-state" aria-live="polite">
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}
