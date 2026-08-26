import { beforeEach, describe, expect, it } from "vitest";
import {
  clearChatIdentity,
  readOrCreateChatIdentity,
  saveChatIdentityToken,
  setChatMemoryPreference,
} from "./chat-identity";

describe("chat identity privacy", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("keeps a remembered identity across browser sessions only while memory is enabled", () => {
    const remembered = readOrCreateChatIdentity();
    saveChatIdentityToken("remembered-token");

    window.sessionStorage.clear();

    expect(readOrCreateChatIdentity()).toEqual({
      ...remembered,
      visitorToken: "remembered-token",
    });
  });

  it("moves identity to session-only storage when the customer turns memory off", () => {
    const remembered = readOrCreateChatIdentity();
    saveChatIdentityToken("session-token");

    setChatMemoryPreference(false);
    expect(readOrCreateChatIdentity()).toEqual({
      ...remembered,
      visitorToken: "session-token",
      memoryEnabled: false,
    });

    window.sessionStorage.clear();
    const nextVisit = readOrCreateChatIdentity();
    expect(nextVisit.memoryEnabled).toBe(false);
    expect(nextVisit.visitorId).not.toBe(remembered.visitorId);
    expect(nextVisit.visitorToken).toBeUndefined();
  });

  it("promotes the current session identity when memory is enabled again", () => {
    setChatMemoryPreference(false);
    const sessionIdentity = readOrCreateChatIdentity();
    saveChatIdentityToken("promoted-token");

    setChatMemoryPreference(true);
    window.sessionStorage.clear();

    expect(readOrCreateChatIdentity()).toEqual({
      ...sessionIdentity,
      visitorToken: "promoted-token",
      memoryEnabled: true,
    });
  });

  it("clears both persistent and session-only identity after confirmed deletion", () => {
    const oldIdentity = readOrCreateChatIdentity();
    setChatMemoryPreference(false);
    saveChatIdentityToken("delete-me");

    clearChatIdentity();
    const replacement = readOrCreateChatIdentity();

    expect(replacement.visitorId).not.toBe(oldIdentity.visitorId);
    expect(replacement.visitorToken).toBeUndefined();
  });
});
