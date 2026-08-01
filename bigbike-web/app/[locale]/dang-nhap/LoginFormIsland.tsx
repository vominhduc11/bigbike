"use client";

import { useSearchParams } from "next/navigation";
import { isSafeReturnTo } from "@/lib/utils/auth";
import { LoginForm } from "./LoginForm";

export function LoginFormIsland() {
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams.get("tiep") ?? "";
  const returnTo = isSafeReturnTo(rawReturnTo) ? rawReturnTo : undefined;

  return <LoginForm returnTo={returnTo} />;
}
