"use client";

import { useSearchParams } from "next/navigation";
import { isSafeReturnTo } from "@/lib/utils/auth";
import { RegisterForm } from "./RegisterForm";

export function RegisterFormIsland() {
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams.get("tiep") ?? "";
  const returnTo = isSafeReturnTo(rawReturnTo) ? rawReturnTo : undefined;

  return <RegisterForm returnTo={returnTo} />;
}
