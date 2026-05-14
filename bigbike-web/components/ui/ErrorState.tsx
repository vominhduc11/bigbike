import Link from "next/link";
import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title?: string;
  message: string;
  retryHref?: string;
};

export function ErrorState({
  title = "Không tải được dữ liệu",
  message,
  retryHref,
}: ErrorStateProps) {
  return (
    <section
      className="bb-error-state grid justify-items-center gap-3 border border-border bg-card p-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <h2 className="text-base font-bold text-foreground m-0">{title}</h2>
      <p className="m-0 text-muted-foreground">{message}</p>
      {retryHref ? (
        <Button asChild variant="primary">
          <Link href={retryHref}>Thử lại</Link>
        </Button>
      ) : null}
    </section>
  );
}
