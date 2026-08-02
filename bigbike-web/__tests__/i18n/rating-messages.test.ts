import en from "@/messages/en.json";
import vi from "@/messages/vi.json";
import { describe, expect, it } from "vitest";

const requiredKeys = {
  Common: [
    "ratingEmptyStars",
    "ratingEmpty",
    "ratingUnavailable",
    "ratingCount",
    "ratingSummaryAria",
    "ratingEmptyAria",
    "ratingUnavailableAria",
  ],
  PdpBuyBox: ["ratingCount", "ratingAria", "emptyRatingAria", "unavailableRatingAria", "ratingUnavailable"],
  ProductReviews: [
    "ratingSummaryAria",
    "ratingEmptyAria",
    "ratingUnavailableAria",
    "ratingEmpty",
    "ratingUnavailable",
    "reviewStarsAria",
  ],
} as const;

function getSection(messages: typeof vi | typeof en, section: keyof typeof requiredKeys): Record<string, unknown> {
  if (section === "ProductReviews") {
    return (messages.Product as { reviews: Record<string, unknown> }).reviews;
  }
  return messages[section] as unknown as Record<string, unknown>;
}

describe("rating translations", () => {
  it.each([vi, en])("contains all VI/EN rating labels without mojibake", (messages) => {
    for (const [section, keys] of Object.entries(requiredKeys)) {
      const values = getSection(messages, section as keyof typeof requiredKeys);
      for (const key of keys) {
        expect(typeof values[key]).toBe("string");
        expect(values[key]).not.toMatch(/[�ÃÂ]/);
      }
    }
  });
});
