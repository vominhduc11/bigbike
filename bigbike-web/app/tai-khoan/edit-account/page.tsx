"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AccountSectionHeading, AccountShell, useAccount, useAccountRefresh } from "@/components/layout/AccountShell";
import { updateCustomerProfile } from "@/lib/api/client-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

// 2020-mockup field label: gray, sentence-case.
const LEGACY_LABEL = "text-sm text-muted-foreground";

function ReqMark() {
  return <span className="text-brand">*</span>;
}

function EditAccountContent() {
  const t = useTranslations("Account.edit");
  const tNav = useTranslations("Account.nav");
  const profile = useAccount();
  const refreshProfile = useAccountRefresh();

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setPasswordError("");

    const fd = new FormData(e.currentTarget);
    const displayName = (fd.get("displayName") as string).trim();
    const email = (fd.get("email") as string).trim();
    const currentPassword = ((fd.get("currentPassword") as string) ?? "").trim();
    const newPassword = ((fd.get("newPassword") as string) ?? "").trim();
    const confirmPassword = ((fd.get("confirmPassword") as string) ?? "").trim();
    const newsletterSubscribed = fd.get("newsletter") === "on";

    const newEmailValue = email && email !== (profile?.email ?? "") ? email : undefined;
    const isSensitiveChange = !!newPassword || !!newEmailValue;

    if (newPassword) {
      if (newPassword.length < 8) {
        setPasswordError(t("errorPasswordShort"));
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError(t("errorPasswordMismatch"));
        return;
      }
    }

    if (isSensitiveChange && !currentPassword) {
      setPasswordError(t("errorMissingCurrentPassword"));
      return;
    }

    setSaving(true);
    try {
      await updateCustomerProfile({
        displayName: displayName || undefined,
        email: newEmailValue,
        currentPassword: isSensitiveChange ? currentPassword : undefined,
        newPassword: newPassword || undefined,
        newsletterSubscribed,
      });
      await refreshProfile?.();
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AccountSectionHeading
        title={tNav("info")}
      />

      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
        {t("intro")}
      </p>

      {success && (
        <div className="bg-[var(--bb-state-success-bg)] border border-[var(--bb-state-success-border)] p-[12px_16px] mb-5 text-sm text-[var(--bb-state-success-text)]">
          {t("successUpdated")}
        </div>
      )}
      {error && (
        <div className="bg-[var(--bb-state-danger-bg)] border border-[var(--bb-state-danger-border)] p-[12px_16px] mb-5 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-[18px] sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className={LEGACY_LABEL}>{t("fullNameLabel")}</label>
            <Input name="displayName" defaultValue={profile?.displayName ?? ""} placeholder={t("fullNamePlaceholder")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LEGACY_LABEL}>{t("emailLabel")}</label>
            <Input type="email" name="email" defaultValue={profile?.email ?? ""} placeholder={t("emailPlaceholder")} />
          </div>
        </div>

        <label className="mt-5 flex w-fit items-center gap-2 text-sm text-muted-foreground">
          <Checkbox name="newsletter" defaultChecked={profile?.newsletterSubscribed ?? false} />
          {t("newsletter")}
        </label>

        <fieldset className="mt-5 border-0 p-0">
          <legend className="mb-3 text-sm text-muted-foreground">{t("changePassword")}</legend>
          <p className="mb-3 text-sm text-muted-foreground">
            {t("changePasswordHint")}
          </p>
          <div className="grid grid-cols-1 gap-x-6 gap-y-[18px] sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className={LEGACY_LABEL}>{t("currentPassword")}<ReqMark /></label>
              <Input
                type="password"
                name="currentPassword"
                placeholder={t("currentPasswordPlaceholder")}
                autoComplete="current-password"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LEGACY_LABEL}>{t("newPassword")}<ReqMark /></label>
              <Input
                type="password"
                name="newPassword"
                placeholder={t("newPasswordPlaceholder")}
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LEGACY_LABEL}>{t("confirmPassword")}<ReqMark /></label>
              <Input
                type="password"
                name="confirmPassword"
                placeholder={t("confirmPasswordPlaceholder")}
                autoComplete="new-password"
              />
            </div>
          </div>
          {passwordError && <p className="mt-2 text-sm text-destructive">{passwordError}</p>}
        </fieldset>

        <Button type="submit" variant="primary" disabled={saving} className="mt-6 min-w-[160px]">
          {saving ? t("saving") : t("save")}
        </Button>
      </form>
    </>
  );
}

export default function EditAccountPage() {
  return (
    <AccountShell loginRedirect="/tai-khoan/edit-account/">
      <EditAccountContent />
    </AccountShell>
  );
}
