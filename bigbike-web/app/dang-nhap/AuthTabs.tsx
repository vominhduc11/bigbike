"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { isSafeReturnTo } from "@/lib/utils/auth";
import { toAccountPath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils";
import { AuthSkeleton } from "@/components/ui/Skeletons";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "@/app/dang-ky/RegisterForm";

type Tab = "login" | "register";

/** One skewed parallelogram tab — mirrors the legacy WP login design. */
function TabButton({
  active,
  onClick,
  controls,
  children,
}: {
  active: boolean;
  onClick: () => void;
  controls: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "flex-1 px-6 py-3.5 font-heading text-sm font-semibold uppercase tracking-wide",
        "[transform:skewX(-12deg)] transition-colors focus-visible:outline-2",
        "focus-visible:outline-ring focus-visible:outline-offset-2",
        active
          ? "bg-primary text-white"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="inline-block [transform:skewX(12deg)]">{children}</span>
    </button>
  );
}

function AuthTabsInner({ defaultTab }: { defaultTab: Tab }) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const searchParams = useSearchParams();
  const raw = searchParams.get("tiep") ?? "";
  const returnTo = isSafeReturnTo(raw) ? raw : toAccountPath();

  return (
    <section className="bb-page bb-page--auth">
      <div className="bb-container">
        <div className="bb-auth-wrap">
          <h1 className="sr-only">Đăng nhập hoặc đăng ký tài khoản BigBike</h1>
          <div role="tablist" aria-label="Đăng nhập hoặc đăng ký" className="mb-6 flex gap-2.5">
            <TabButton
              active={tab === "login"}
              onClick={() => setTab("login")}
              controls="auth-panel"
            >
              Đăng nhập
            </TabButton>
            <TabButton
              active={tab === "register"}
              onClick={() => setTab("register")}
              controls="auth-panel"
            >
              Đăng ký
            </TabButton>
          </div>

          <div id="auth-panel" role="tabpanel">
            {tab === "login" ? (
              <LoginForm returnTo={returnTo} />
            ) : (
              <RegisterForm returnTo={returnTo} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Shared tabbed login/register screen. Both `/dang-nhap` and `/dang-ky` render this —
 * `defaultTab` picks the initial tab; switching is in-place (no route change).
 */
export function AuthTabs({ defaultTab }: { defaultTab: Tab }) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <AuthTabsInner defaultTab={defaultTab} />
    </Suspense>
  );
}
