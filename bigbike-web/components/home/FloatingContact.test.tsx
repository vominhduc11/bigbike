import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import viMessages from "@/messages/vi.json";
import enMessages from "@/messages/en.json";
import { requestContactOpen } from "@/lib/contact/contact-launcher";
import { FloatingContact } from "./FloatingContact";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

const contacts = {
  hotline: "090 123 4567",
  zaloUrl: "https://zalo.me/0901234567",
  messengerUrl: "https://m.me/example-shop",
  zaloDisplay: "Zalo của shop",
  messengerDisplay: "Messenger của shop",
};

function widget(locale: "vi" | "en" = "vi", values = contacts) {
  return (
    <NextIntlClientProvider locale={locale} messages={locale === "vi" ? viMessages : enMessages}>
      <FloatingContact {...values} />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  route.pathname = "/";
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("direct shop contact", () => {
  it("removes retired assistant cache while preserving other browser data", () => {
    for (const storage of [localStorage, sessionStorage]) {
      storage.setItem("bb_ai_chat_session_v1", "retired conversation draft");
      storage.setItem("bb_chat_visitor_id_v1", "retired visitor");
      storage.setItem("bb_chat_visitor_token_v1", "retired test token");
      storage.setItem("bb_chat_memory_enabled_v1", "true");
      storage.setItem("customer_cart", "retained cart");
    }
    render(widget());
    for (const storage of [localStorage, sessionStorage]) {
      expect(storage.getItem("bb_ai_chat_session_v1")).toBeNull();
      expect(storage.getItem("bb_chat_visitor_id_v1")).toBeNull();
      expect(storage.getItem("bb_chat_visitor_token_v1")).toBeNull();
      expect(storage.getItem("bb_chat_memory_enabled_v1")).toBeNull();
      expect(storage.getItem("customer_cart")).toBe("retained cart");
    }
  });

  it.each(["vi", "en"] as const)(
    "opens configured links without API calls in %s",
    async (locale) => {
      const fetch = vi.spyOn(globalThis, "fetch");
      const user = userEvent.setup();
      render(widget(locale));
      const trigger = screen.getByRole("button", {
        name: locale === "vi" ? "Mở hỗ trợ" : "Open support",
      });
      await user.click(trigger);

      expect(screen.getByRole("dialog")).toBeVisible();
      expect(screen.getByRole("link", { name: /Hotline/ })).toHaveAttribute(
        "href",
        "tel:0901234567",
      );
      expect(screen.getByRole("link", { name: /Zalo/ })).toHaveAttribute("href", contacts.zaloUrl);
      expect(screen.getByRole("link", { name: /Messenger/ })).toHaveAttribute(
        "href",
        contacts.messengerUrl,
      );
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.queryByLabelText(/trợ lý|assistant/i)).toBeNull();
      expect(fetch).not.toHaveBeenCalled();

      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(trigger).toHaveFocus();
    },
  );

  it("omits invalid contact links and provides an empty state", async () => {
    const user = userEvent.setup();
    render(
      widget("vi", { ...contacts, hotline: "", zaloUrl: "javascript:alert(1)", messengerUrl: "" }),
    );
    await user.click(screen.getByRole("button", { name: "Mở hỗ trợ" }));
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(viMessages.Support.contactUnavailable)).toBeVisible();
  });

  it("opens from checkout's inline action and restores focus to that action", async () => {
    route.pathname = "/dat-hang/";
    const user = userEvent.setup();
    render(widget());
    expect(screen.queryByRole("button", { name: "Mở hỗ trợ" })).toBeNull();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    try {
      requestContactOpen(trigger);
      await waitFor(() => expect(screen.getByRole("dialog")).toBeVisible());
      await user.click(screen.getByRole("button", { name: "Đóng hỗ trợ" }));
      await waitFor(() => expect(trigger).toHaveFocus());
    } finally {
      trigger.remove();
    }
  });
});
