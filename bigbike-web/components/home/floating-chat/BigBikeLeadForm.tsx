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

export type BigBikeLeadDraft = {
  name: string;
  phone: string;
  note: string;
  consented: boolean;
};

export type BigBikeAccountContact = {
  name: string;
  phone: string;
};

type BigBikeLeadFormProps = {
  conversationId: string;
  draft: BigBikeLeadDraft;
  onDraftChange: (draft: BigBikeLeadDraft) => void;
  onCaptured: () => void;
  onDeclined: () => Promise<void>;
  accountContact?: BigBikeAccountContact;
};

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 5) return "••••";
  const hiddenCount = Math.max(4, digits.length - 5);
  return `${digits.slice(0, 3)} ${"•".repeat(hiddenCount)} ${digits.slice(-2)}`;
}

export function BigBikeLeadForm({
  conversationId,
  draft,
  onDraftChange,
  onCaptured,
  onDeclined,
  accountContact,
}: BigBikeLeadFormProps) {
  const t = useTranslations("Support");
  const [pendingAction, setPendingAction] = useState<"submit" | "decline" | null>(null);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [consentError, setConsentError] = useState("");
  const [useManualForm, setUseManualForm] = useState(false);

  function update(patch: Partial<BigBikeLeadDraft>) {
    onDraftChange({ ...draft, ...patch });
  }

  async function submitAccountContact() {
    if (pendingAction || !accountContact) return;
    setError("");
    setPendingAction("submit");
    try {
      await captureChatLead({
        conversationId,
        contactSource: "ACCOUNT",
      });
      onCaptured();
    } catch {
      setError(t("leadError"));
    } finally {
      setPendingAction(null);
    }
  }

  function useOtherContact() {
    if (!accountContact || pendingAction) return;
    onDraftChange({
      ...draft,
      name: accountContact.name,
      phone: accountContact.phone,
      consented: false,
    });
    setUseManualForm(true);
    setError("");
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
        contactSource: "FORM",
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

  if (accountContact && !useManualForm) {
    return (
      <div data-bigbike-lead-quick data-testid="bigbike-lead-quick" className="grid gap-3 border border-chat bg-background p-4">
        <div>
          <h3 className="font-cta text-b4-action font-semibold uppercase tracking-wide text-foreground">
            {t("leadTitle")}
          </h3>
          <p className="mt-1 font-body text-a5-meta leading-relaxed text-muted-foreground">
            {t("leadAccountDescription")}
          </p>
        </div>

        <dl className="grid gap-2 border border-border bg-muted/30 p-3 font-body text-a5-meta">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{t("leadAccountName")}</dt>
            <dd className="font-semibold text-foreground">{accountContact.name}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{t("leadAccountPhone")}</dt>
            <dd className="font-semibold text-foreground">{maskPhone(accountContact.phone)}</dd>
          </div>
        </dl>

        {error ? <p role="alert" className="border border-destructive bg-accent p-3 text-a5-meta text-destructive">{error}</p> : null}

        <div className="grid gap-2 sm:grid-cols-3">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={pendingAction !== null}
            className="min-h-11 px-4 sm:col-span-2"
            onClick={() => void submitAccountContact()}
          >
            {pendingAction === "submit" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {pendingAction === "submit" ? t("leadSubmitting") : t("leadUseAccount")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pendingAction !== null}
            className="min-h-11 px-4"
            onClick={useOtherContact}
          >
            {t("leadUseOther")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pendingAction !== null}
            className="min-h-11 px-4 sm:col-span-3"
            onClick={() => void decline()}
          >
            {pendingAction === "decline" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {pendingAction === "decline" ? t("leadDeclining") : t("leadDecline")}
          </Button>
        </div>
      </div>
    );
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
        <Label htmlFor="bigbike-lead-name">{t("leadName")}</Label>
        <Input
          id="bigbike-lead-name"
          value={draft.name}
          maxLength={100}
          disabled={pendingAction !== null}
          onChange={(event) => update({ name: event.target.value })}
        />
      </div>

      <div className="grid gap-1">
        <Label htmlFor="bigbike-lead-phone">{t("leadPhone")}</Label>
        <Input
          id="bigbike-lead-phone"
          type="tel"
          value={draft.phone}
          maxLength={32}
          disabled={pendingAction !== null}
          aria-invalid={Boolean(phoneError)}
          aria-describedby={phoneError ? "bigbike-lead-phone-error" : undefined}
          onChange={(event) => {
            update({ phone: event.target.value });
            if (phoneError) setPhoneError("");
          }}
        />
        {phoneError ? <p id="bigbike-lead-phone-error" role="alert" className="text-a5-meta text-destructive">{phoneError}</p> : null}
      </div>

      <div className="grid gap-1">
        <Label htmlFor="bigbike-lead-note">{t("leadNote")}</Label>
        <Textarea
          id="bigbike-lead-note"
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
            id="bigbike-lead-consent"
            checked={draft.consented}
            disabled={pendingAction !== null}
            aria-invalid={Boolean(consentError)}
            aria-describedby={consentError ? "bigbike-lead-consent-error" : undefined}
            onCheckedChange={(checked) => {
              update({ consented: checked === true });
              if (consentError) setConsentError("");
            }}
          />
          <Label htmlFor="bigbike-lead-consent" className="font-body text-a5-meta font-normal leading-relaxed">
            {t("leadConsent")}
          </Label>
        </div>
        {consentError ? <p id="bigbike-lead-consent-error" role="alert" className="text-a5-meta text-destructive">{consentError}</p> : null}
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
