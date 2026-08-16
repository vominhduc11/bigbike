import { beforeEach, describe, expect, it } from "vitest";
import {
  CHAT_STORAGE_KEY,
  CHAT_STORAGE_TTL_MS,
  clearChatSnapshot,
  readChatSnapshot,
  writeChatSnapshot,
  type ChatPersistenceSnapshot,
} from "./chat-persistence";

const snapshot: ChatPersistenceSnapshot = {
  version: 1,
  expiresAt: Date.now() + CHAT_STORAGE_TTL_MS,
  locale: "vi",
  conversationId: "conversation-persistence",
  messages: [
    { id: "user-1", role: "USER", content: "Tìm giúp tôi một mẫu phù hợp" },
    {
      id: "assistant-1",
      role: "ASSISTANT",
      content: "Em đang kiểm tra các mẫu phù hợp.",
      products: [{ slug: "mu-test", name: "Mũ kiểm thử", stockState: "IN_STOCK" }],
      actions: [{ type: "ORDER_LOOKUP" }],
      noResults: false,
    },
  ],
  remainingTurns: 7,
  serviceMode: "AI",
  leadPrompt: true,
  leadCaptured: false,
  leadDeclined: false,
};

describe("chat persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps only the minimum display state and preserves the exact remaining turns", () => {
    writeChatSnapshot(snapshot);

    expect(readChatSnapshot()).toMatchObject(snapshot);
    expect(window.localStorage.getItem(CHAT_STORAGE_KEY)).not.toContain("0909123456");
  });

  it("removes an expired snapshot instead of restoring it", () => {
    writeChatSnapshot({ ...snapshot, expiresAt: Date.now() - 1 });

    expect(readChatSnapshot()).toBeNull();
    expect(window.localStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });

  it("clears the snapshot immediately", () => {
    writeChatSnapshot(snapshot);

    clearChatSnapshot();

    expect(window.localStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });
});
