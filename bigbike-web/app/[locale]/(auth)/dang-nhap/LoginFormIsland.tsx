"use client";

import { useSearchParams } from "next/navigation";
import { isSafeReturnTo } from "@/lib/utils/auth";
import { oauthErrorKey } from "@/lib/auth/oauth-error";
import { LoginForm } from "./LoginForm";

export function LoginFormIsland() {
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams.get("tiep") ?? "";
  const returnTo = isSafeReturnTo(rawReturnTo) ? rawReturnTo : undefined;
  // The social-login callback lands back here with ?error=... on any failure.
  const socialErrorKey = oauthErrorKey(searchParams.get("error"));

  return <LoginForm returnTo={returnTo} socialErrorKey={socialErrorKey} />;
}
