"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { performLogout, useAuth } from "@/lib/auth/auth-store";
import { BBTooltip } from "@/components/ui/BBTooltip";
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
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onClick(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    await performLogout();
    setOpen(false);
    setLoggingOut(false);
    router.push("/");
    router.refresh();
  }

  if (auth.status === "loading") {
    return (
      <BBTooltip content="Tài khoản">
        <Link
          href={toAccountPath()}
          className="wp-icon-btn wp-account-icon"
          aria-label="Tài khoản"
        >
          <UserIcon />
        </Link>
      </BBTooltip>
    );
  }

  if (auth.status === "anonymous") {
    return (
      <div className="wp-user-menu" ref={wrapperRef}>
        <BBTooltip content="Tài khoản">
          <button
            type="button"
            className="wp-icon-btn wp-account-icon"
            aria-label="Tài khoản"
            aria-haspopup="true"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((prev) => !prev)}
          >
            <UserIcon />
          </button>
        </BBTooltip>
        {open && (
          <div id={panelId} className="wp-user-dropdown" role="menu">
            <div className="wp-user-dropdown-head">
              <p>Chào bạn!</p>
              <span>Đăng nhập để theo dõi đơn hàng</span>
            </div>
            <div className="wp-user-dropdown-actions">
              <Link
                href={toLoginPath(pathname ?? undefined)}
                className="wp-user-btn wp-user-btn-primary"
                role="menuitem"
              >
                Đăng nhập
              </Link>
              <Link
                href={toRegisterPath()}
                className="wp-user-btn"
                role="menuitem"
              >
                Đăng ký
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  const { profile } = auth;
  const displayName = profile.displayName?.trim() || profile.email;

  return (
    <div className="wp-user-menu" ref={wrapperRef}>
      <BBTooltip content={displayName ?? "Tài khoản"}>
        <button
          type="button"
          className="wp-icon-btn wp-account-icon wp-account-avatar"
          aria-label={`Tài khoản của ${displayName}`}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span aria-hidden="true">{initials(profile)}</span>
        </button>
      </BBTooltip>
      {open && (
        <div id={panelId} className="wp-user-dropdown" role="menu">
          <div className="wp-user-dropdown-head">
            <p>Xin chào,</p>
            <span title={profile.email}>{displayName}</span>
          </div>
          <ul className="wp-user-dropdown-list">
            <li>
              <Link href={toAccountPath()} role="menuitem">
                Tài khoản của tôi
              </Link>
            </li>
            <li>
              <Link href={toOrderHistoryPath()} role="menuitem">
                Đơn hàng
              </Link>
            </li>
          </ul>
          <button
            type="button"
            className="wp-user-logout"
            onClick={handleLogout}
            disabled={loggingOut}
            role="menuitem"
          >
            {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
          </button>
        </div>
      )}
    </div>
  );
}
