"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { performLogout, useAuth } from "@/lib/auth/auth-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CustomerProfile } from "@/lib/contracts/commerce";
import {
  getSafeLoginHref,
  toAccountPath,
  toOrderHistoryPath,
  toRegisterPath,
} from "@/lib/utils/routes";

function UserIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function initials(profile: CustomerProfile): string {
  const source = (profile.displayName ?? profile.email ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function HeaderUserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await performLogout();
    setLoggingOut(false);
    router.push("/");
    router.refresh();
  }

  // During hydration render a non-navigating placeholder to avoid spurious navigation.
  if (auth.status === "loading") {
    return (
      <button
        type="button"
        disabled
        aria-label="Tài khoản"
        className="inline-flex items-center justify-center min-h-[var(--bb-header-height)] px-[14px] border border-transparent bg-transparent text-white/40 cursor-default [@media(max-width:420px)]:hidden"
      >
        <UserIcon />
      </button>
    );
  }

  if (auth.status === "anonymous") {
    const p = pathname?.replace(/\/$/, "") ?? "";
    const isOnLoginPage = p === "/dang-nhap";
    const isOnRegisterPage = p === "/dang-ky";
    const loginHref = getSafeLoginHref(pathname);

    const guestSubText = isOnRegisterPage
      ? "Đã có tài khoản? Đăng nhập ngay."
      : isOnLoginPage
        ? "Chưa có tài khoản? Đăng ký miễn phí."
        : "Đăng nhập để theo dõi đơn hàng.";

    return (
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <TooltipProvider>
          <Tooltip open={dropdownOpen ? false : undefined}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger
                className="inline-flex items-center justify-center min-h-[var(--bb-header-height)] px-[14px] border border-transparent bg-transparent text-white cursor-pointer transition-colors hover:text-brand hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px] [@media(max-width:420px)]:hidden"
                aria-label="Tài khoản"
              >
                <UserIcon />
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Tài khoản</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-semibold normal-case">Chào bạn!</p>
            <p className="text-sm text-muted-foreground normal-case">{guestSubText}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {!isOnLoginPage && (
            <DropdownMenuItem asChild>
              <Link href={loginHref} className="font-semibold">
                Đăng nhập
              </Link>
            </DropdownMenuItem>
          )}
          {!isOnRegisterPage && (
            <DropdownMenuItem asChild>
              <Link href={toRegisterPath()}>Đăng ký</Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const { profile } = auth;
  const displayName = profile.displayName?.trim() || profile.email;

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <TooltipProvider>
        <Tooltip open={dropdownOpen ? false : undefined}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger
              className="bb-round inline-flex items-center justify-center min-h-[var(--bb-header-height)] px-[14px] border bg-brand-soft text-brand border-[var(--bb-brand-primary-border)] text-[0.72rem] font-bold tracking-[0.04em] uppercase cursor-pointer transition-colors rounded-full hover:bg-brand hover:text-black hover:border-brand focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px] [@media(max-width:420px)]:hidden"
              aria-label={`Tài khoản của ${displayName}`}
            >
              <span aria-hidden="true">{initials(profile)}</span>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{displayName ?? "Tài khoản"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm text-muted-foreground normal-case">Xin chào,</p>
          <p className="text-sm font-semibold truncate normal-case" title={profile.email}>
            {displayName}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={toAccountPath()}>Tài khoản của tôi</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={toOrderHistoryPath()}>Đơn hàng</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleLogout}
          disabled={loggingOut}
          className="text-destructive focus:text-destructive"
        >
          {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
