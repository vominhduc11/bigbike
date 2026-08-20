"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AccountSectionHeading, useAccount, useAccountRefresh } from "@/components/account/AccountNav";
import { updateCustomerProfile, uploadCustomerAvatar, removeCustomerAvatar } from "@/lib/api/client-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormNotice } from "@/components/ui/FormNotice";
import { Avatar } from "@/components/ui/Avatar";
import { createProfileSchema, type ProfileFormValues } from "@/lib/schemas/customer";

// 2020-mockup field label: gray, sentence-case.
const LEGACY_LABEL = "text-a5-meta text-muted-foreground";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function ReqMark() {
  return <span className="text-brand">*</span>;
}

function AvatarEditor() {
  const t = useTranslations("Account.edit");
  const profile = useAccount();
  const refreshProfile = useAccountRefresh();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const oauthManaged = !!profile?.oauthManaged;

  const [busy, setBusy] = useState<"uploading" | "removing" | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setNotice(null);
    if (file.size > MAX_AVATAR_BYTES) {
      setNotice({ tone: "danger", text: t("avatarErrorTooLarge") });
      return;
    }
    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setNotice({ tone: "danger", text: t("avatarErrorInvalidType") });
      return;
    }

    setBusy("uploading");
    try {
      await uploadCustomerAvatar(file);
      await refreshProfile?.();
      setNotice({ tone: "success", text: t("avatarUpdated") });
    } catch {
      setNotice({ tone: "danger", text: t("avatarErrorGeneric") });
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setNotice(null);
    setBusy("removing");
    try {
      await removeCustomerAvatar();
      await refreshProfile?.();
      setNotice({ tone: "success", text: t("avatarRemoved") });
    } catch {
      setNotice({ tone: "danger", text: t("avatarErrorGeneric") });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <Avatar url={profile?.avatarUrl} name={profile?.displayName ?? profile?.email ?? ""} size="lg" variant="brand" />
      {!oauthManaged && (
        <div className="flex flex-col gap-2">
          {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={busy !== null}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy === "uploading" ? t("avatarUploading") : t("avatarUploadCta")}
            </Button>
            {profile?.avatarUrl && (
              <Button type="button" variant="ghost" disabled={busy !== null} onClick={handleRemove}>
                {busy === "removing" ? t("avatarRemoving") : t("avatarRemoveCta")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function EditAccountContent() {
  const t = useTranslations("Account.edit");
  const tValidation = useTranslations("FormValidation");
  const tNav = useTranslations("Account.nav");
  const profile = useAccount();
  const refreshProfile = useAccountRefresh();
  const oauthManaged = !!profile?.oauthManaged;

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const profileValidation = (key: string) => key === "passwordLength"
    ? t("errorPasswordShort")
    : key === "passwordMismatch" ? t("errorPasswordMismatch")
      : key === "currentPasswordRequired" ? t("errorMissingCurrentPassword") : tValidation(key);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileFormValues>({
    resolver: zodResolver(createProfileSchema(profileValidation, profile?.email ?? "")),
    defaultValues: {
      displayName: profile?.displayName ?? "",
      email: profile?.email ?? "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function submit(values: ProfileFormValues) {
    setError("");
    setSuccess(false);
    const newEmailValue = values.email && values.email !== (profile?.email ?? "") ? values.email : undefined;
    const isSensitiveChange = Boolean(values.newPassword || newEmailValue);

    try {
      await updateCustomerProfile({
        displayName: values.displayName || undefined,
        email: newEmailValue,
        currentPassword: isSensitiveChange ? values.currentPassword : undefined,
        newPassword: values.newPassword || undefined,
      });
      await refreshProfile?.();
      setSuccess(true);
    } catch {
      setError(t("errorGeneric"));
    } finally { /* react-hook-form owns submitting state */ }
  }

  return (
    <>
      <AccountSectionHeading title={tNav("info")} />

      <p className="mb-5 text-a4-content leading-relaxed text-muted-foreground">
        {t("intro")}
      </p>

      {oauthManaged && (
        <FormNotice tone="warning" className="mb-5">{t("oauthManagedNotice")}</FormNotice>
      )}

      <AvatarEditor />

      {oauthManaged ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-4.5 md:grid-cols-2 xl:gap-x-8">
          <div className="flex flex-col gap-1.5">
            <label className={LEGACY_LABEL}>{t("fullNameLabel")}</label>
            <Input value={profile?.displayName ?? ""} disabled readOnly />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LEGACY_LABEL}>{t("emailLabel")}</label>
            <Input value={profile?.email ?? ""} disabled readOnly />
          </div>
        </div>
      ) : (
        <>
          {success && (
            <FormNotice tone="success" className="mb-5">{t("successUpdated")}</FormNotice>
          )}
          {error && (
            <FormNotice tone="danger" className="mb-5">{error}</FormNotice>
          )}

          <form onSubmit={handleSubmit(submit)} noValidate>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4.5 md:grid-cols-2 xl:gap-x-8">
              <div className="flex flex-col gap-1.5">
                <label className={LEGACY_LABEL}>{t("fullNameLabel")}</label>
                <Input {...register("displayName")} placeholder={t("fullNamePlaceholder")} />
                {errors.displayName && <p className="text-a4-content text-destructive">{errors.displayName.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={LEGACY_LABEL}>{t("emailLabel")}</label>
                <Input type="email" {...register("email")} placeholder={t("emailPlaceholder")} />
                {errors.email && <p className="text-a4-content text-destructive">{errors.email.message}</p>}
              </div>
            </div>


            <fieldset className="mt-5 border-0 p-0">
              <legend className="mb-3 text-a5-meta text-muted-foreground">{t("changePassword")}</legend>
              <p className="mb-3 text-a4-content text-muted-foreground">
                {t("changePasswordHint")}
              </p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4.5 md:grid-cols-2 xl:gap-x-8">
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className={LEGACY_LABEL}>{t("currentPassword")}<ReqMark /></label>
                  <Input
                    type="password"
                    {...register("currentPassword")}
                    placeholder={t("currentPasswordPlaceholder")}
                    autoComplete="current-password"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={LEGACY_LABEL}>{t("newPassword")}<ReqMark /></label>
                  <Input
                    type="password"
                    {...register("newPassword")}
                    placeholder={t("newPasswordPlaceholder")}
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={LEGACY_LABEL}>{t("confirmPassword")}<ReqMark /></label>
                  <Input
                    type="password"
                    {...register("confirmPassword")}
                    placeholder={t("confirmPasswordPlaceholder")}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              {(errors.currentPassword || errors.newPassword || errors.confirmPassword) && <p className="mt-2 text-a4-content text-destructive">{errors.currentPassword?.message ?? errors.newPassword?.message ?? errors.confirmPassword?.message}</p>}
            </fieldset>

            <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-6 w-full sm:w-auto sm:min-w-40">
              {isSubmitting ? t("saving") : t("save")}
            </Button>
          </form>
        </>
      )}
    </>
  );
}
