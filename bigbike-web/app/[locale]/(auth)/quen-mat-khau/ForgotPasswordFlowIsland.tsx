"use client";

import { useSearchParams } from "next/navigation";
import ForgotPasswordFlow from "./ForgotPasswordFlow";

export function ForgotPasswordFlowIsland() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return <ForgotPasswordFlow token={token} />;
}
