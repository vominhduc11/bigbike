"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { subscribeNewsletter } from "@/lib/api/client-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const COOLDOWN_MS = 30_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ô đăng ký nhận tin qua email ở chân trang — gửi tới POST /api/v1/newsletter. */
export function NewsletterForm() {
  const t = useTranslations("Newsletter");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const lastSubmitAt = useRef<number>(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const now = Date.now();
    if (now - lastSubmitAt.current < COOLDOWN_MS) {
      setError(t("cooldown"));
      return;
    }
    const email = ((new FormData(e.currentTarget).get("email") as string) ?? "").trim();
    if (!email) {
      setError(t("emailRequired"));
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError(t("emailInvalid"));
      return;
    }
    setSaving(true);
    lastSubmitAt.current = Date.now();
    try {
      await subscribeNewsletter(email);
      setDone(true);
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("submitFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <p className="m-0 text-sm font-semibold text-brand">
        {t("success")}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2" noValidate>
      <div className="flex">
        <Input
          type="email"
          name="email"
          placeholder={t("placeholder")}
          aria-label={t("ariaLabel")}
          required
          className="h-11 flex-1 rounded-none border-0 bg-card text-card-foreground"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={saving}
          className="h-11 shrink-0 rounded-none px-6"
        >
          {saving ? t("submitting") : t("submit")}
        </Button>
      </div>
      {error && <p className="m-0 text-xs text-destructive">{error}</p>}
    </form>
  );
}
