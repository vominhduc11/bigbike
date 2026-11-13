"use client";

import { useEffect } from "react";
import { trackReviewLinkOpen } from "@/lib/analytics";

export function ReviewLinkRedirect({ destination }: { destination: string }) {
  useEffect(() => trackReviewLinkOpen(() => window.location.replace(destination)), [destination]);
  return null;
}
