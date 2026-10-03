import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsRuntime } from "@/components/analytics/AnalyticsRuntime";
import { markPendingAuthentication } from "@/lib/analytics";

const runtime = vi.hoisted(() => ({
  pathname: "/product/analytics-test/",
  auth: { status: "anonymous" } as
    { status: "anonymous" } | { status: "authenticated"; profile: { id: string } },
}));

vi.mock("next/navigation", () => ({ usePathname: () => runtime.pathname }));
vi.mock("@/lib/auth/auth-store", () => ({ useAuth: () => runtime.auth }));

class ImmediateIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }

  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function eventCalls() {
  return vi.mocked(window.gtag!).mock.calls.filter((call) => call[0] === "event");
}

beforeEach(() => {
  runtime.pathname = `/product/analytics-${crypto.randomUUID()}/`;
  runtime.auth = { status: "anonymous" };
  window.sessionStorage.clear();
  window.gtag = vi.fn();
  window.clarity = vi.fn();
  vi.stubGlobal("IntersectionObserver", ImmediateIntersectionObserver);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 100 });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 1_000,
  });
  Object.defineProperty(document.body, "scrollHeight", { configurable: true, value: 1_000 });
});

afterEach(() => {
  document.body.replaceChildren();
  window.sessionStorage.clear();
  delete window.gtag;
  delete window.clarity;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AnalyticsRuntime", () => {
  it("captures contact, promotion and product-section actions through the central helper", async () => {
    const product = document.createElement("main");
    product.dataset.analyticsProductId = "product-42";
    product.dataset.analyticsProductName = "Mũ AGV";
    const reviews = document.createElement("section");
    reviews.dataset.analyticsSection = "reviews";
    product.append(reviews);
    document.body.append(product);

    const phone = document.createElement("button");
    phone.dataset.analyticsContactChannel = "phone";
    phone.dataset.analyticsLocation = "contact_page";
    const promotion = document.createElement("a");
    promotion.href = "/sp/";
    promotion.dataset.analyticsPromotionId = "hero-1";
    promotion.dataset.analyticsPromotionName = "Mũ mới";
    promotion.dataset.analyticsLocation = "homepage_hero";
    // Next.js prevents the native navigation while completing a successful client transition.
    promotion.addEventListener("click", (event) => event.preventDefault());
    document.body.append(phone, promotion);

    render(<AnalyticsRuntime />);
    fireEvent.click(phone);
    fireEvent.click(promotion);

    await waitFor(() => {
      expect(eventCalls().map((call) => call[1])).toEqual(
        expect.arrayContaining(["view_content_section", "contact_click", "select_promotion"]),
      );
    });
    const contact = eventCalls().find((call) => call[1] === "contact_click");
    expect(contact?.[2]).toMatchObject({
      contact_channel: "phone",
      placement: "contact_page",
      product_id: "product-42",
    });
  });

  it("records dense scroll milestones once per session and path across a remount", () => {
    const product = document.createElement("main");
    product.dataset.analyticsProductId = "product-scroll";
    document.body.append(product);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 650 });
    const first = render(<AnalyticsRuntime />);
    fireEvent.scroll(window);

    expect(
      eventCalls()
        .filter((call) => call[1] === "scroll_depth")
        .map((call) => (call[2] as { percent_scrolled: number }).percent_scrolled),
    ).toEqual([10, 25, 50, 75]);

    first.unmount();
    render(<AnalyticsRuntime />);
    fireEvent.scroll(window);
    expect(eventCalls().filter((call) => call[1] === "scroll_depth")).toHaveLength(4);
  });

  it("does not dilute product scroll milestones with general-page scrolling", () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 650 });

    render(<AnalyticsRuntime />);
    fireEvent.scroll(window);

    expect(eventCalls().filter((call) => call[1] === "scroll_depth")).toHaveLength(0);
  });

  it("identifies an authenticated customer by internal id and completes social auth once", () => {
    runtime.auth = { status: "authenticated", profile: { id: "customer-internal-7" } };
    markPendingAuthentication("login", "google");

    render(<AnalyticsRuntime />);

    expect(window.gtag).toHaveBeenCalledWith("set", { user_id: "customer-internal-7" });
    expect(window.gtag).toHaveBeenCalledWith("event", "login", { method: "google" });
    expect(window.clarity).toHaveBeenCalledWith("identify", "customer-internal-7");
    expect(window.sessionStorage.getItem("bb_analytics:pending_auth")).toBeNull();
  });
});
