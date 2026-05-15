"use client";

import { useState } from "react";
import Link from "next/link";
import { MailWarning, MailCheck } from "lucide-react";
import { AccountShell, useAccount } from "@/components/layout/AccountShell";
import { customerStatusLabel } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { resendEmailVerification } from "@/lib/api/client-api";

type ResendStatus = "idle" | "sending" | "sent" | "error";

function UnverifiedEmailBanner() {
  const [resendStatus, setResendStatus] = useState<ResendStatus>("idle");
  const [resendMsg, setResendMsg] = useState("");

  async function handleResend() {
    setResendStatus("sending");
    setResendMsg("");
    try {
      await resendEmailVerification();
      setResendStatus("sent");
      setResendMsg("Email xác minh đã được gửi. Vui lòng kiểm tra hộp thư (kể cả thư mục Spam).");
    } catch (e) {
      setResendStatus("error");
      setResendMsg(e instanceof Error ? e.message : "Không thể gửi lại email. Vui lòng thử lại sau.");
    }
  }

  if (resendStatus === "sent") {
    return (
      <div className="mb-5 flex items-start gap-3 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-4">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--bb-state-success-text)]" aria-hidden />
        <p className="m-0 text-sm text-[var(--bb-state-success-text)]">{resendMsg}</p>
      </div>
    );
  }

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-[var(--bb-state-warning-border)] bg-[var(--bb-state-warning-bg)] p-4">
      <div className="flex items-start gap-3">
        <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-[var(--bb-state-warning-text)]" aria-hidden />
        <div>
          <p className="m-0 text-sm font-medium text-[var(--bb-state-warning-text)]">Email chưa được xác minh</p>
          {resendStatus === "error" ? (
            <p className="m-0 mt-0.5 text-xs text-destructive">{resendMsg}</p>
          ) : (
            <p className="m-0 mt-0.5 text-xs text-muted-foreground">
              Xác minh email để bảo vệ tài khoản và nhận đơn hàng đầy đủ.
            </p>
          )}
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleResend}
        disabled={resendStatus === "sending"}
        className="shrink-0"
      >
        {resendStatus === "sending" ? "Đang gửi..." : "Gửi lại email xác minh"}
      </Button>
    </div>
  );
}

function AccountOverview() {
  const profile = useAccount()!;

  return (
    <>
      {!profile.emailVerified && <UnverifiedEmailBanner />}

      <div className="flex justify-between items-end mb-5 pb-4 border-b border-border">
        <div>
          <h1 className="font-display uppercase text-[26px] tracking-[0.01em] m-0 text-foreground">{"T\u00e0i kho\u1ea3n c\u1ee7a t\u00f4i"}</h1>
          <p className="text-xs text-muted-foreground mt-1 m-0">{"Xin ch\u00e0o, "}{profile.displayName ?? profile.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[14px] mb-7">
        <div className="bg-card border border-border p-[20px_22px]">
          <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[10px] m-0">Email</p>
          <p className="text-sm text-foreground m-0">{profile.email}</p>
        </div>
        <div className="bg-card border border-border p-[20px_22px]">
          <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[10px] m-0">{"S\u1ed1 \u0111i\u1ec7n tho\u1ea1i"}</p>
          <p className="text-sm text-foreground m-0">{profile.phone ?? "Ch\u01b0a c\u1eadp nh\u1eadt"}</p>
        </div>
        <div className="bg-card border border-border p-[20px_22px]">
          <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[10px] m-0">{"Tr\u1ea1ng th\u00e1i"}</p>
          <p className={`text-sm m-0${profile.status === "ACTIVE" ? " text-[var(--bb-state-success)] font-bold" : " text-foreground"}`}>
            {customerStatusLabel(profile.status)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <Link href="/tai-khoan/don-hang/" className="bg-card border border-border p-[18px_20px] no-underline block transition-colors duration-200 text-inherit hover:border-brand">
          <p className="text-xs font-bold tracking-[0.14em] uppercase text-brand mb-1.5 m-0">{"\u0110\u01a1n h\u00e0ng"}</p>
          <p className="text-sm text-muted-foreground m-0">{"Xem l\u1ecbch s\u1eed \u0111\u1eb7t h\u00e0ng \u2192"}</p>
        </Link>
        <Link href="/tai-khoan/edit-account/" className="bg-card border border-border p-[18px_20px] no-underline block transition-colors duration-200 text-inherit hover:border-brand">
          <p className="text-xs font-bold tracking-[0.14em] uppercase text-brand mb-1.5 m-0">{"T\u00e0i kho\u1ea3n"}</p>
          <p className="text-sm text-muted-foreground m-0">{"Ch\u1ec9nh s\u1eeda th\u00f4ng tin \u2192"}</p>
        </Link>
        <Link href="/tai-khoan/edit-address/billing/" className="bg-card border border-border p-[18px_20px] no-underline block transition-colors duration-200 text-inherit hover:border-brand">
          <p className="text-xs font-bold tracking-[0.14em] uppercase text-brand mb-1.5 m-0">{"\u0110\u1ecba ch\u1ec9"}</p>
          <p className="text-sm text-muted-foreground m-0">{"Qu\u1ea3n l\u00fd \u0111\u1ecba ch\u1ec9 \u2192"}</p>
        </Link>
        <Link href="/tai-khoan/yeu-thich/" className="bg-card border border-border p-[18px_20px] no-underline block transition-colors duration-200 text-inherit hover:border-brand">
          <p className="text-xs font-bold tracking-[0.14em] uppercase text-brand mb-1.5 m-0">{"Y\u00eau th\u00edch"}</p>
          <p className="text-sm text-muted-foreground m-0">{"S\u1ea3n ph\u1ea9m \u0111\u00e3 l\u01b0u \u2192"}</p>
        </Link>
      </div>
    </>
  );
}

export default function AccountPage() {
  return (
    <AccountShell loginRedirect="/tai-khoan/">
      <AccountOverview />
    </AccountShell>
  );
}
