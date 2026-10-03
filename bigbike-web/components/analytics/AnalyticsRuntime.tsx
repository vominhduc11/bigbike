"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-store";
import {
  claimAnalyticsSessionEvent,
  consumePendingAuthentication,
  setAnalyticsUserId,
  trackAuthentication,
  trackContactClick,
  trackContentSection,
  trackScrollDepth,
  trackSelectPromotion,
  type ContactChannel,
  type ProductContentSection,
} from "@/lib/analytics";

const SCROLL_MILESTONES = [10, 25, 50, 75, 90, 100] as const;
const PRODUCT_SECTIONS = new Set<ProductContentSection>([
  "description",
  "specifications",
  "video",
  "reviews",
  "commitments",
]);

function inferContactChannel(element: Element): ContactChannel | null {
  const explicit = element.getAttribute("data-analytics-contact-channel");
  if (explicit === "phone" || explicit === "zalo" || explicit === "messenger") {
    return explicit;
  }
  const href = element.getAttribute("href")?.trim().toLowerCase() ?? "";
  if (href.startsWith("tel:")) return "phone";
  if (href.includes("zalo.me") || href.startsWith("zalo:")) return "zalo";
  if (
    href.includes("m.me/") ||
    href.includes("messenger.com") ||
    href.includes("facebook.com/messages")
  ) {
    return "messenger";
  }
  return null;
}

/**
 * Site-wide behavior measurement. It mounts once below the root providers and delegates every
 * outbound action to `lib/analytics.ts`, preserving that module as the only measurement surface.
 */
export function AnalyticsRuntime() {
  const pathname = usePathname() || "/";
  const auth = useAuth();

  useEffect(() => {
    if (auth.status === "loading") return;
    if (auth.status === "anonymous") {
      setAnalyticsUserId();
      return;
    }

    setAnalyticsUserId(auth.profile.id);
    const pending = consumePendingAuthentication();
    if (pending) trackAuthentication(pending.event, pending.method);
  }, [auth, pathname]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const action = event.target.closest<HTMLElement>(
        "a[href], [data-analytics-contact-channel], [data-analytics-promotion-id]",
      );
      if (!action) return;

      const channel = inferContactChannel(action);
      if (channel) {
        trackContactClick(channel, action.dataset.analyticsLocation?.trim() || pathname);
      }

      const promotionId = action.dataset.analyticsPromotionId?.trim();
      const promotionName = action.dataset.analyticsPromotionName?.trim();
      if (promotionId && promotionName) {
        trackSelectPromotion({
          id: promotionId,
          name: promotionName,
          placement: action.dataset.analyticsLocation?.trim() || pathname,
        });
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname]);

  useEffect(() => {
    // Dense milestones answer PDP-content questions. Keep them off short/general pages so the
    // custom event is not diluted by homepage, policy or account scrolling.
    if (!document.querySelector("[data-analytics-product-id]")) return;

    let frame = 0;
    const recordReachedMilestones = () => {
      frame = 0;
      const documentHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
      if (documentHeight <= 0) return;
      const reached = Math.min(
        100,
        Math.round(((window.scrollY + window.innerHeight) / documentHeight) * 100),
      );
      for (const milestone of SCROLL_MILESTONES) {
        if (reached >= milestone && claimAnalyticsSessionEvent(`scroll:${pathname}:${milestone}`)) {
          trackScrollDepth(milestone, pathname);
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(recordReachedMilestones);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [pathname]);

  useEffect(() => {
    const observed = new WeakSet<Element>();
    const intersection = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const section = entry.target.getAttribute("data-analytics-section");
          if (!section || !PRODUCT_SECTIONS.has(section as ProductContentSection)) continue;
          if (claimAnalyticsSessionEvent(`section:${pathname}:${section}`)) {
            trackContentSection(section as ProductContentSection, pathname);
          }
          intersection.unobserve(entry.target);
        }
      },
      { threshold: 0, rootMargin: "0px 0px -20% 0px" },
    );

    const observeSections = () => {
      document.querySelectorAll("[data-analytics-section]").forEach((element) => {
        if (!observed.has(element)) {
          observed.add(element);
          intersection.observe(element);
        }
      });
    };
    observeSections();
    const mutations = new MutationObserver(observeSections);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      intersection.disconnect();
    };
  }, [pathname]);

  return null;
}
