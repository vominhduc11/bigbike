import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_ATTRIBUTION_STORAGE_KEY,
  readChatAttributionProof,
  saveChatAttributionProof,
} from "./chat-attribution";

describe("chat attribution proof storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("keeps the latest proof per product without customer data", () => {
    const expiresAt = Date.now() + 60_000;
    saveChatAttributionProof({ productSlug: "mu-a", token: "old", expiresAt });
    saveChatAttributionProof({ productSlug: "mu-a", token: "new", expiresAt });

    expect(readChatAttributionProof("mu-a")).toEqual({
      productSlug: "mu-a", token: "new", expiresAt,
    });
    expect(localStorage.getItem(CHAT_ATTRIBUTION_STORAGE_KEY)).not.toMatch(
      /phone|email|customer|conversation/i,
    );
  });

  it("drops expired and malformed proofs instead of sending them to cart", () => {
    localStorage.setItem(CHAT_ATTRIBUTION_STORAGE_KEY, JSON.stringify([
      { productSlug: "mu-old", token: "expired", expiresAt: Date.now() - 1 },
      { productSlug: "mu-bad", token: "", expiresAt: Date.now() + 60_000 },
    ]));

    expect(readChatAttributionProof("mu-old")).toBeNull();
    expect(readChatAttributionProof("mu-bad")).toBeNull();
    expect(localStorage.getItem(CHAT_ATTRIBUTION_STORAGE_KEY)).toBe("[]");
  });

  it("caps browser proofs at twenty", () => {
    const expiresAt = Date.now() + 60_000;
    for (let index = 0; index < 25; index += 1) {
      saveChatAttributionProof({ productSlug: `mu-${index}`, token: `proof-${index}`, expiresAt });
    }

    expect(JSON.parse(localStorage.getItem(CHAT_ATTRIBUTION_STORAGE_KEY) || "[]"))
      .toHaveLength(20);
    expect(readChatAttributionProof("mu-24")?.token).toBe("proof-24");
    expect(readChatAttributionProof("mu-0")).toBeNull();
  });
});
