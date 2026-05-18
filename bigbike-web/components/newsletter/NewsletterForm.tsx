"use client";

import { useRef, useState } from "react";
import { subscribeNewsletter } from "@/lib/api/client-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const COOLDOWN_MS = 30_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ô đăng ký nhận tin qua email ở chân trang — gửi tới POST /api/v1/newsletter. */
export function NewsletterForm() {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const lastSubmitAt = useRef<number>(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const now = Date.now();
    if (now - lastSubmitAt.current < COOLDOWN_MS) {
      setError("Vui lòng chờ một chút trước khi gửi lại.");
      return;
    }
    const email = ((new FormData(e.currentTarget).get("email") as string) ?? "").trim();
    if (!email) {
      setError("Vui lòng nhập email.");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError("Email không hợp lệ.");
      return;
    }
    setSaving(true);
    lastSubmitAt.current = Date.now();
    try {
      await subscribeNewsletter(email);
      setDone(true);
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <p className="m-0 text-sm font-semibold text-brand">
        Cảm ơn bạn đã đăng ký nhận tin từ BigBike!
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2" noValidate>
      <div className="flex">
        <Input
          type="email"
          name="email"
          placeholder="Email của bạn..."
          aria-label="Email đăng ký nhận tin"
          required
          className="h-11 flex-1 rounded-none border-0 bg-card text-card-foreground"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={saving}
          className="h-11 shrink-0 rounded-none px-6"
        >
          {saving ? "Đang gửi..." : "Gửi"}
        </Button>
      </div>
      {error && <p className="m-0 text-xs text-destructive">{error}</p>}
    </form>
  );
}
