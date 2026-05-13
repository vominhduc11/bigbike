"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalRouteError({
  error,
  unstable_retry,
}: {
  error: Error;
  unstable_retry: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <section className="bb-page">
      <div className="bb-container">
        <section className="bb-error-state" role="alert" aria-live="assertive">
          <h1>Lỗi hệ thống</h1>
          <p>Đã xảy ra lỗi ngoài dự kiến. Vui lòng thử lại.</p>
          <Button type="button" variant="primary" onClick={unstable_retry}>
            Thử lại
          </Button>
        </section>
      </div>
    </section>
  );
}

