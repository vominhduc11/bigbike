import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHAT_STORAGE_KEY } from "@/lib/chat/chat-persistence";

const api = vi.hoisted(() => ({
  fetchMe: vi.fn(),
  logoutCustomer: vi.fn(),
}));

vi.mock("@/lib/api/client-api", () => api);

import { performLogout } from "./auth-store";

describe("customer logout", () => {
  beforeEach(() => {
    window.localStorage.clear();
    api.logoutCustomer.mockResolvedValue(undefined);
  });

  it("clears the browser chat snapshot when the customer logs out", async () => {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ conversationId: "conversation-logout" }));

    await performLogout();

    expect(window.localStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
    expect(api.logoutCustomer).toHaveBeenCalledTimes(1);
  });
});
