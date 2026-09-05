import { beforeEach, describe, expect, it } from "vitest";
import {
  clearChatIdentity,
  readOrCreateChatIdentity,
  saveChatIdentityToken,
} from "./chat-identity";

const VISITOR_ID_KEY = "bb_chat_visitor_id_v1";
const VISITOR_TOKEN_KEY = "bb_chat_visitor_token_v1";
const LEGACY_MEMORY_ENABLED_KEY = "bb_chat_memory_enabled_v1";

describe("chat identity privacy", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  // CHAT_RULE_049 (owner decision 2026-09-05): the assistant only remembers inside the open
  // browser session.
  it("keeps the identity for the current session and drops it when the browser closes", () => {
    const identity = readOrCreateChatIdentity();
    saveChatIdentityToken("session-token");

    expect(readOrCreateChatIdentity()).toEqual({
      visitorId: identity.visitorId,
      visitorToken: "session-token",
    });

    // Closing the browser clears sessionStorage.
    window.sessionStorage.clear();
    const nextVisit = readOrCreateChatIdentity();

    expect(nextVisit.visitorId).not.toBe(identity.visitorId);
    expect(nextVisit.visitorToken).toBeUndefined();
  });

  it("never writes the identity to persistent storage", () => {
    readOrCreateChatIdentity();
    saveChatIdentityToken("session-token");

    expect(window.localStorage.getItem(VISITOR_ID_KEY)).toBeNull();
    expect(window.localStorage.getItem(VISITOR_TOKEN_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(VISITOR_ID_KEY)).not.toBeNull();
  });

  it("removes what an earlier long-term-memory build left on the device", () => {
    window.localStorage.setItem(VISITOR_ID_KEY, "old-visitor");
    window.localStorage.setItem(VISITOR_TOKEN_KEY, "old-token");
    window.localStorage.setItem(LEGACY_MEMORY_ENABLED_KEY, "true");

    const identity = readOrCreateChatIdentity();

    expect(identity.visitorId).not.toBe("old-visitor");
    expect(window.localStorage.getItem(VISITOR_ID_KEY)).toBeNull();
    expect(window.localStorage.getItem(VISITOR_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_MEMORY_ENABLED_KEY)).toBeNull();
  });

  it("clears the identity after a confirmed deletion", () => {
    const oldIdentity = readOrCreateChatIdentity();
    saveChatIdentityToken("delete-me");

    clearChatIdentity();
    const replacement = readOrCreateChatIdentity();

    expect(replacement.visitorId).not.toBe(oldIdentity.visitorId);
    expect(replacement.visitorToken).toBeUndefined();
  });
});
