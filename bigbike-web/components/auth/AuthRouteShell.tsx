"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type AuthRoute = "login" | "register" | "forgot" | "verify";
type AuthFormTransition = "forward" | "back";

const AUTH_FORM_TRANSITION_MS = 380;

function getAuthRoute(pathname: string): AuthRoute | null {
  const path = pathname.replace(/\/+$/, "");

  if (path === "/dang-nhap" || path.endsWith("/dang-nhap") || path.endsWith("/login")) {
    return "login";
  }
  if (path === "/dang-ky" || path.endsWith("/dang-ky") || path.endsWith("/register")) {
    return "register";
  }
  if (
    path === "/quen-mat-khau" ||
    path.endsWith("/quen-mat-khau") ||
    path.endsWith("/forgot-password")
  ) {
    return "forgot";
  }
  if (
    path === "/xac-nhan-email" ||
    path.endsWith("/xac-nhan-email") ||
    path.endsWith("/verify-email")
  ) {
    return "verify";
  }
  return null;
}

function getTransitionDirection(
  previousRoute: AuthRoute | null,
  nextRoute: AuthRoute | null,
): AuthFormTransition | null {
  if (
    !previousRoute ||
    !nextRoute ||
    previousRoute === nextRoute ||
    !["login", "register"].includes(previousRoute) ||
    !["login", "register"].includes(nextRoute)
  ) {
    return null;
  }
  return previousRoute === "login" && nextRoute === "register" ? "forward" : "back";
}

export function AuthRouteShell({
  children,
  brandPanel,
}: {
  children: ReactNode;
  brandPanel: ReactNode;
}) {
  const pathname = usePathname();
  const route = getAuthRoute(pathname);
  const previousRouteRef = useRef<AuthRoute | null>(route);
  const [formTransition, setFormTransition] = useState<AuthFormTransition | null>(null);

  useEffect(() => {
    const nextTransition = getTransitionDirection(previousRouteRef.current, route);
    previousRouteRef.current = route;

    if (!nextTransition) {
      setFormTransition(null);
      return;
    }

    setFormTransition(nextTransition);
    const clearTimer = window.setTimeout(() => setFormTransition(null), AUTH_FORM_TRANSITION_MS);
    return () => window.clearTimeout(clearTimer);
  }, [route]);

  return (
    <section
      data-auth-page={route}
      className="flex min-h-full w-full flex-1 items-start px-4 py-6 sm:px-6 md:items-center lg:p-0"
    >
      <div className="mx-auto grid w-full max-w-[1200px] bg-background lg:min-h-svh lg:grid-cols-2">
        {brandPanel}
        <div data-auth-form-panel className="flex min-w-0 justify-center lg:items-start lg:py-16">
          <div
            data-auth-form-content
            data-auth-form-transition={formTransition ?? undefined}
            className={cn("w-full max-w-md", formTransition && "will-change-transform")}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
