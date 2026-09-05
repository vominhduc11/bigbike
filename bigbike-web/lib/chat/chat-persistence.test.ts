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
  version: 5,
  expiresAt: Date.now() + CHAT_STORAGE_TTL_MS,
  locale: "vi",
  conversationId: "conversation-persistence",
  messages: [
    {
      id: "user-1",
      role: "USER",
      content: "Mũ bảo hiểm",
      clarificationSelection: {
        clarificationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        optionId: "group-helmet",
      },
    },
    {
      id: "assistant-1",
      role: "ASSISTANT",
      content: "Em đang kiểm tra các mẫu phù hợp.",
      products: [{ slug: "mu-test", name: "Mũ kiểm thử", stockState: "IN_STOCK" }],
      actions: [{ type: "ORDER_LOOKUP" }],
      clarification: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        criterion: "USE_CASE",
        options: [
          { id: "use-long-tour", label: "Đi tour đường dài", count: 5, kind: "FILTER" },
          { id: "show-all", label: "Cứ cho em xem tất cả", count: null, kind: "BYPASS" },
        ],
      },
      noResults: false,
    },
  ],
  remainingTurns: 7,
  serviceMode: "AI",
};

describe("chat persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("keeps only the minimum display state and preserves the exact remaining turns", () => {
    writeChatSnapshot(snapshot);

    expect(readChatSnapshot()).toMatchObject(snapshot);
    expect(window.sessionStorage.getItem(CHAT_STORAGE_KEY)).not.toContain("0909123456");
  });

  it("removes an expired snapshot instead of restoring it", () => {
    writeChatSnapshot({ ...snapshot, expiresAt: Date.now() - 1 });

    expect(readChatSnapshot()).toBeNull();
    expect(window.sessionStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });

  it("removes an older snapshot so obsolete contact data is not restored", () => {
    window.localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        expiresAt: Date.now() + CHAT_STORAGE_TTL_MS,
        locale: "vi",
        conversationId: "legacy-conversation",
        messages: [{ id: "assistant-old", role: "ASSISTANT", content: "Nội dung cũ" }],
        remainingTurns: 5,
        serviceMode: "AI",
      }),
    );

    expect(readChatSnapshot()).toBeNull();
    expect(window.sessionStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });

  it("removes a pre-AI-only snapshot from the retired flow", () => {
    window.localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        ...snapshot,
        version: 4,
      }),
    );

    expect(readChatSnapshot()).toBeNull();
    expect(window.sessionStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });

  it("clears the snapshot immediately", () => {
    writeChatSnapshot(snapshot);

    clearChatSnapshot();

    expect(window.sessionStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });
});
