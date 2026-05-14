"use client";

import Link from "next/link";
import { AccountShell, useAccount } from "@/components/layout/AccountShell";
import { customerStatusLabel } from "@/lib/utils/format";

function AccountOverview() {
  const profile = useAccount()!;

  return (
    <>
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
