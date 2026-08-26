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
  version: 3,
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
  leadPromptSequence: 1,
  leadPromptMessageId: "assistant-1",
  viewedLeadSequences: [1],
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

  it("upgrades a valid version-one snapshot without losing its active lead prompt", () => {
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
        leadPrompt: true,
        leadCaptured: false,
        leadDeclined: false,
      }),
    );

    expect(readChatSnapshot()).toMatchObject({
      version: 3,
      conversationId: "legacy-conversation",
      leadPromptSequence: 1,
      viewedLeadSequences: [],
    });
  });

  it("upgrades a valid version-two snapshot to the current format", () => {
    window.localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        ...snapshot,
        version: 2,
      }),
    );

    expect(readChatSnapshot()).toMatchObject({
      version: 3,
      conversationId: snapshot.conversationId,
    });
  });

  it("clears the snapshot immediately", () => {
    writeChatSnapshot(snapshot);

    clearChatSnapshot();

    expect(window.localStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });
});
