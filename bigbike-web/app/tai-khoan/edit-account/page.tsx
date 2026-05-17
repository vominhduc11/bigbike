"use client";

import { useState } from "react";
import { AccountShell, useAccount, useAccountRefresh } from "@/components/layout/AccountShell";
import { updateCustomerProfile } from "@/lib/api/client-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function EditAccountContent() {
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
    const phone = (fd.get("phone") as string).trim();
    const email = (fd.get("email") as string).trim();
    const currentPassword = (fd.get("currentPassword") as string).trim();
    const newPassword = (fd.get("newPassword") as string).trim();
    const confirmPassword = (fd.get("confirmPassword") as string).trim();
    const gender = (fd.get("gender") as string).trim();
    const dob = (fd.get("dob") as string).trim();

    const newEmailValue = email && email !== (profile?.email ?? "") ? email : undefined;
    const newPhoneValue = phone && phone !== (profile?.phone ?? "") ? phone : undefined;
    const isSensitiveChange = !!newPassword || !!newEmailValue || !!newPhoneValue;

    if (newPassword) {
      if (newPassword.length < 8) {
        setPasswordError("M\u1eadt kh\u1ea9u m\u1edbi ph\u1ea3i c\u00f3 \u00edt nh\u1ea5t 8 k\u00fd t\u1ef1.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError("M\u1eadt kh\u1ea9u x\u00e1c nh\u1eadn kh\u00f4ng kh\u1edbp.");
        return;
      }
    }

    if (isSensitiveChange && !currentPassword) {
      setPasswordError("Vui l\u00f2ng nh\u1eadp m\u1eadt kh\u1ea9u hi\u1ec7n t\u1ea1i \u0111\u1ec3 thay \u0111\u1ed5i th\u00f4ng tin nh\u1ea1y c\u1ea3m (email, s\u1ed1 \u0111i\u1ec7n tho\u1ea1i ho\u1eb7c m\u1eadt kh\u1ea9u).");
      return;
    }

    setSaving(true);
    try {
      await updateCustomerProfile({
        displayName: displayName || undefined,
        phone: newPhoneValue,
        email: newEmailValue,
        currentPassword: isSensitiveChange ? currentPassword : undefined,
        newPassword: newPassword || undefined,
        gender: gender || undefined,
        dob: dob || undefined,
      });
      await refreshProfile?.();
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "C\u00f3 l\u1ed7i x\u1ea3y ra, vui l\u00f2ng th\u1eed l\u1ea1i.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex justify-between items-end mb-5 pb-4 border-b border-border">
        <div>
          <h2 className="font-display uppercase text-[26px] tracking-[0.01em] m-0 text-foreground">{"T\u00e0i kho\u1ea3n"}</h2>
          <p className="text-xs text-muted-foreground mt-1 m-0">{"Th\u00f4ng tin c\u00e1 nh\u00e2n"}</p>
        </div>
      </div>

      {success && (
        <div className="bg-[var(--bb-state-success-bg)] border border-[var(--bb-state-success-border)] p-[14px_18px] mb-5 text-sm text-[var(--bb-state-success-text)]">
          <p className="m-0">{"Th\u00f4ng tin \u0111\u00e3 \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt."}</p>
        </div>
      )}

      {error && (
        <div className="bg-[var(--bb-state-danger-bg)] border border-[var(--bb-state-danger-border)] p-[14px_18px] mb-5 text-sm text-destructive">
          <p className="m-0">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-card border border-border p-[22px_24px]">
          <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[10px]">{"Th\u00f4ng tin t\u00e0i kho\u1ea3n"}</p>
          <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">{"H\u1ecd t\u00ean"}</label>
              <Input type="text" name="displayName" defaultValue={profile?.displayName ?? ""} placeholder={"H\u1ecd v\u00e0 t\u00ean"} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">{"S\u1ed1 \u0111i\u1ec7n tho\u1ea1i"}</label>
              <Input type="tel" name="phone" defaultValue={profile?.phone ?? ""} placeholder="0901234567" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">Email</label>
              <Input type="email" name="email" defaultValue={profile?.email ?? ""} placeholder="email@example.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">{"Gi\u1edbi t\u00ednh"}</label>
              <Select name="gender" defaultValue={profile?.gender ?? undefined}>
                <SelectTrigger>
                  <SelectValue placeholder={"-- Ch\u1ecdn --"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Nam</SelectItem>
                  <SelectItem value="female">{"N\u1eef"}</SelectItem>
                  <SelectItem value="other">{"Kh\u00e1c"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">{"Ng\u00e0y sinh"}</label>
              <Input type="date" name="dob" defaultValue={profile?.dob ?? ""} />
            </div>
          </div>

          <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[10px] mt-6">{"\u0110\u1ed5i m\u1eadt kh\u1ea9u (\u0111\u1ec3 tr\u1ed1ng n\u1ebfu kh\u00f4ng \u0111\u1ed5i)"}</p>
          <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">{"M\u1eadt kh\u1ea9u hi\u1ec7n t\u1ea1i"}</label>
              <Input type="password" name="currentPassword" placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"} autoComplete="current-password" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">{"M\u1eadt kh\u1ea9u m\u1edbi"}</label>
              <Input type="password" name="newPassword" placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"} autoComplete="new-password" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">{"X\u00e1c nh\u1eadn m\u1eadt kh\u1ea9u m\u1edbi"}</label>
              <Input type="password" name="confirmPassword" placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"} autoComplete="new-password" />
            </div>
          </div>
          {passwordError && (
            <p className="text-sm text-destructive mt-1.5">{passwordError}</p>
          )}

          <Button type="submit" variant="primary" className="mt-5" disabled={saving}>
            {saving ? "\u0110ang l\u01b0u..." : "L\u01b0u thay \u0111\u1ed5i"}
          </Button>
        </div>
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
