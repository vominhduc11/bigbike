"use client";
import { useEffect } from "react";
import { pushDataLayer } from "@/lib/analytics";

export function HomeAnalytics() {
  useEffect(() => {
    pushDataLayer("page_view", { page_type: "home" });
  }, []);
  return null;
}
