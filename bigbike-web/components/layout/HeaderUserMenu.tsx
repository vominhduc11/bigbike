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
  toAccountPath,
  toLoginPath,
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

  async function handleLogout() {
    setLoggingOut(true);
    await performLogout();
    setLoggingOut(false);
    router.push("/");
    router.refresh();
  }

  if (auth.status === "loading") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={toAccountPath()}
              className="wp-icon-btn wp-account-icon"
              aria-label="Tài khoản"
            >
              <UserIcon />
            </Link>
          </TooltipTrigger>
          <TooltipContent>Tài khoản</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (auth.status === "anonymous") {
    return (
      <DropdownMenu>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger
                className="wp-icon-btn wp-account-icon focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                aria-label="Tài khoản"
              >
                <UserIcon />
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Tài khoản</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-semibold">Chào bạn!</p>
            <p className="text-xs text-muted-foreground">Đăng nhập để theo dõi đơn hàng</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              href={toLoginPath(pathname ?? undefined)}
              className="font-semibold text-primary uppercase font-cta"
            >
              Đăng nhập
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={toRegisterPath()}>Đăng ký</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const { profile } = auth;
  const displayName = profile.displayName?.trim() || profile.email;

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger
              className="wp-icon-btn wp-account-icon wp-account-avatar focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              aria-label={`Tài khoản của ${displayName}`}
            >
              <span aria-hidden="true">{initials(profile)}</span>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{displayName ?? "Tài khoản"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs text-muted-foreground">Xin chào,</p>
          <p className="text-sm font-semibold truncate" title={profile.email}>
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
