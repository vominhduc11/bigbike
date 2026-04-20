import Link from "next/link";

type ErrorStateProps = {
  title?: string;
  message: string;
  retryHref?: string;
};

export function ErrorState({
  title = "Khong tai duoc du lieu",
  message,
  retryHref,
}: ErrorStateProps) {
  return (
    <section className="bb-error-state" role="alert" aria-live="assertive">
      <h2>{title}</h2>
      <p>{message}</p>
      {retryHref ? (
        <Link href={retryHref} className="bb-button bb-button-primary">
          Thu lai
        </Link>
      ) : null}
    </section>
  );
}

