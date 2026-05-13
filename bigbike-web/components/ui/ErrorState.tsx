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
    <section className="bb-error-state" role="alert" aria-live="assertive">
      <h2>{title}</h2>
      <p>{message}</p>
      {retryHref ? (
        <Button asChild variant="primary">
          <Link href={retryHref}>Thử lại</Link>
        </Button>
      ) : null}
    </section>
  );
}
