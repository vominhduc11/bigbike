"use client";

import { useSearchParams } from "next/navigation";
import { isSafeReturnTo } from "@/lib/utils/auth";
import ForgotPasswordFlow from "./ForgotPasswordFlow";

export function ForgotPasswordFlowIsland() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const rawReturnTo = searchParams.get("tiep") ?? "";
  const returnTo = isSafeReturnTo(rawReturnTo) ? rawReturnTo : undefined;

  return <ForgotPasswordFlow token={token} returnTo={returnTo} />;
}
