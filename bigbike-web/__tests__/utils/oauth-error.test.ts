import { describe, it, expect } from "vitest";
import viMessages from "@/messages/vi.json";
import enMessages from "@/messages/en.json";
import { oauthErrorKey } from "@/lib/auth/oauth-error";

describe("oauthErrorKey — social login failure messages", () => {
  it("maps each backend error code to its own message key", () => {
    expect(oauthErrorKey("oauth_cancelled")).toBe("errorCancelled");
    expect(oauthErrorKey("oauth_unconfigured")).toBe("errorUnconfigured");
    expect(oauthErrorKey("oauth_blocked")).toBe("errorBlocked");
    expect(oauthErrorKey("oauth_registration_consent_required")).toBe(
      "errorRegistrationConsentRequired",
    );
    expect(oauthErrorKey("oauth_failed")).toBe("errorFailed");
  });

  it("shows nothing when the customer simply opened the login page", () => {
    expect(oauthErrorKey(null)).toBeUndefined();
    expect(oauthErrorKey(undefined)).toBeUndefined();
    expect(oauthErrorKey("")).toBeUndefined();
  });

  it("still says something for an unknown code rather than failing silently", () => {
    // `oauth` is what the backend sent before 2026-08-07; links in the wild may still carry it.
    expect(oauthErrorKey("oauth")).toBe("errorFailed");
    expect(oauthErrorKey("something-else")).toBe("errorFailed");
  });

  it("has a Vietnamese and English string for every key it can return", () => {
    const keys = [
      "oauth_cancelled",
      "oauth_unconfigured",
      "oauth_blocked",
      "oauth_registration_consent_required",
      "oauth_failed",
      "oauth",
    ];
    for (const code of keys) {
      const key = oauthErrorKey(code) as string;
      expect(viMessages.Auth.social).toHaveProperty(key);
      expect(enMessages.Auth.social).toHaveProperty(key);
      expect((viMessages.Auth.social as Record<string, string>)[key]).not.toBe("");
      expect((enMessages.Auth.social as Record<string, string>)[key]).not.toBe("");
    }
  });
});

describe("Auth.social + Account.edit message parity", () => {
  it("keeps vi and en in sync for the social block", () => {
    expect(Object.keys(viMessages.Auth.social).sort()).toEqual(
      Object.keys(enMessages.Auth.social).sort(),
    );
  });

  it("keeps vi and en in sync for the account edit block (incl. oauthManagedNotice)", () => {
    expect(Object.keys(viMessages.Account.edit).sort()).toEqual(
      Object.keys(enMessages.Account.edit).sort(),
    );
  });

  it("translates the oauth-managed notice separately in vi and en", () => {
    expect(viMessages.Account.edit.oauthManagedNotice).not.toBe(
      enMessages.Account.edit.oauthManagedNotice,
    );
  });
});
