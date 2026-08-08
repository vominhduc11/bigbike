"use client";

import { useSearchParams } from "next/navigation";
import { isSafeReturnTo } from "@/lib/utils/auth";
import { oauthErrorKey } from "@/lib/auth/oauth-error";
import { RegisterForm } from "./RegisterForm";

export function RegisterFormIsland() {
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams.get("tiep") ?? "";
  const returnTo = isSafeReturnTo(rawReturnTo) ? rawReturnTo : undefined;
  // A social sign-up that fails can land back here rather than on the login page.
  const socialErrorKey = oauthErrorKey(searchParams.get("error"));

  return <RegisterForm returnTo={returnTo} socialErrorKey={socialErrorKey} />;
}
