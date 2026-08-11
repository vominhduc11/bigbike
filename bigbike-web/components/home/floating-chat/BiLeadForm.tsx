"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { captureChatLead } from "@/lib/api/client-api";

export type BiLeadDraft = {
  name: string;
  phone: string;
  note: string;
  consented: boolean;
};

type BiLeadFormProps = {
  conversationId: string;
  draft: BiLeadDraft;
  onDraftChange: (draft: BiLeadDraft) => void;
  onCaptured: () => void;
  onDeclined: () => Promise<void>;
};

export function BiLeadForm({
  conversationId,
  draft,
  onDraftChange,
  onCaptured,
  onDeclined,
}: BiLeadFormProps) {
  const t = useTranslations("Support");
  const [pendingAction, setPendingAction] = useState<"submit" | "decline" | null>(null);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [consentError, setConsentError] = useState("");

  function update(patch: Partial<BiLeadDraft>) {
    onDraftChange({ ...draft, ...patch });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction) return;

    const nextPhoneError = draft.phone.trim() ? "" : t("leadPhoneRequired");
    const nextConsentError = draft.consented ? "" : t("leadConsentRequired");
    setPhoneError(nextPhoneError);
    setConsentError(nextConsentError);
    setError("");
    if (nextPhoneError || nextConsentError) return;

    setPendingAction("submit");
    try {
      await captureChatLead({
        conversationId,
        name: draft.name.trim() || undefined,
        phone: draft.phone.trim(),
        note: draft.note.trim() || undefined,
      });
      onCaptured();
    } catch {
      setError(t("leadError"));
    } finally {
      setPendingAction(null);
    }
  }

  async function decline() {
    if (pendingAction) return;
    setError("");
    setPendingAction("decline");
    try {
      await onDeclined();
    } catch {
      setError(t("leadDeclineError"));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 border border-chat bg-background p-4">
      <div>
        <h3 className="font-cta text-b4-action font-semibold uppercase tracking-wide text-foreground">
          {t("leadTitle")}
        </h3>
        <p className="mt-1 font-body text-a5-meta leading-relaxed text-muted-foreground">
          {t("leadDescription")}
        </p>
      </div>

      <div className="grid gap-1">
        <Label htmlFor="bi-lead-name">{t("leadName")}</Label>
        <Input
          id="bi-lead-name"
          value={draft.name}
          maxLength={100}
          disabled={pendingAction !== null}
          onChange={(event) => update({ name: event.target.value })}
        />
      </div>

      <div className="grid gap-1">
        <Label htmlFor="bi-lead-phone">{t("leadPhone")}</Label>
        <Input
          id="bi-lead-phone"
          type="tel"
          value={draft.phone}
          maxLength={32}
          disabled={pendingAction !== null}
          aria-invalid={Boolean(phoneError)}
          aria-describedby={phoneError ? "bi-lead-phone-error" : undefined}
          onChange={(event) => {
            update({ phone: event.target.value });
            if (phoneError) setPhoneError("");
          }}
        />
        {phoneError ? <p id="bi-lead-phone-error" role="alert" className="text-a5-meta text-destructive">{phoneError}</p> : null}
      </div>

      <div className="grid gap-1">
        <Label htmlFor="bi-lead-note">{t("leadNote")}</Label>
        <Textarea
          id="bi-lead-note"
          value={draft.note}
          maxLength={500}
          disabled={pendingAction !== null}
          className="min-h-24"
          onChange={(event) => update({ note: event.target.value })}
        />
      </div>

      <div className="grid gap-1">
        <div className="flex min-h-11 items-center gap-3">
          <Checkbox
            id="bi-lead-consent"
            checked={draft.consented}
            disabled={pendingAction !== null}
            aria-invalid={Boolean(consentError)}
            aria-describedby={consentError ? "bi-lead-consent-error" : undefined}
            onCheckedChange={(checked) => {
              update({ consented: checked === true });
              if (consentError) setConsentError("");
            }}
          />
          <Label htmlFor="bi-lead-consent" className="font-body text-a5-meta font-normal leading-relaxed">
            {t("leadConsent")}
          </Label>
        </div>
        {consentError ? <p id="bi-lead-consent-error" role="alert" className="text-a5-meta text-destructive">{consentError}</p> : null}
      </div>

      {error ? <p role="alert" className="border border-destructive bg-accent p-3 text-a5-meta text-destructive">{error}</p> : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={pendingAction !== null}
          className="min-h-11 px-4"
        >
          {pendingAction === "submit" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pendingAction === "submit" ? t("leadSubmitting") : t("leadSubmit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pendingAction !== null}
          className="min-h-11 px-4"
          onClick={() => void decline()}
        >
          {pendingAction === "decline" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pendingAction === "decline" ? t("leadDeclining") : t("leadDecline")}
        </Button>
      </div>
    </form>
  );
}
