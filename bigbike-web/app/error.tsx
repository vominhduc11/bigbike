"use client";

import { useEffect } from "react";

export default function GlobalRouteError({
  error,
  unstable_retry,
}: {
  error: Error;
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="bb-page">
      <div className="bb-container">
        <section className="bb-error-state" role="alert" aria-live="assertive">
          <h1>Loi he thong</h1>
          <p>Da xay ra loi ngoai du kien. Vui long thu lai.</p>
          <button type="button" className="bb-button bb-button-primary" onClick={unstable_retry}>
            Thu lai
          </button>
        </section>
      </div>
    </section>
  );
}

