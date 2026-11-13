import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { getStoreHours, isStoreOpenAt, resolveStoreHours } from "@/lib/content/store-hours";
import { getStaticPage } from "@/lib/content/static-pages";
import rawPages from "@/lib/content/static-pages.json";
import { listPublicSettings } from "@/lib/api/public-api";
import {
  ContactMap,
  ContactPageContent,
  type ContactInfo,
} from "@/components/contact/ContactPageContent";
import { ClothingSizeGuideContent } from "@/components/guide/ClothingSizeGuideContent";

const contact: ContactInfo = {
  address: "Current public address",
  hotline: "",
  hotline2: "",
  zaloUrl: "",
  facebookUrl: "",
  hoursWeekday: "Legacy weekday",
  hoursWeekend: "Legacy Sunday",
  hoursHoliday: "Legacy holiday",
};
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shared shop schedule", () => {
  it.each(["vi", "en"])(
    "expands editable prose and size fallback from the same source (%s)",
    async (locale) => {
      const hours = Object.values(getStoreHours(locale)).join(" · ");
      expect(resolveStoreHours("<p>Before ({{store_hours}}). After.</p>", locale)).toBe(
        `<p>Before (${hours}). After.</p>`,
      );
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              data: [
                {
                  settingKey: "home_content_bottom_html",
                  settingValue: "<p>{{store_hours}}</p>",
                  settingGroup: "seo",
                },
                {
                  settingKey: "unrelated",
                  settingValue: "Support: 6 PM; {{store_hours}}",
                  settingGroup: "other",
                },
              ],
            }),
            { headers: { "content-type": "application/json" } },
          ),
        ),
      );
      const result = await listPublicSettings(locale);
      expect(result.data?.[0].settingValue).toBe(`<p>${hours}</p>`);
      expect(result.data?.[1].settingValue).toBe("Support: 6 PM; {{store_hours}}");
      expect(rawPages["cach-do-size-trang-phuc"].body).toContain("{{store_hours}}");
      expect(rawPages["cach-do-size-trang-phuc"].body).not.toMatch(/18:00|18h00/);
      if (locale === "vi")
        expect(getStaticPage("cach-do-size-trang-phuc", locale)?.body).toContain(hours);
      render(<ClothingSizeGuideContent locale={locale} />);
      expect(screen.getByText((text) => text.includes(hours))).toBeInTheDocument();
    },
  );

  it.each([
    ["2026-11-07T20:59:00", true],
    ["2026-11-07T21:00:00", false],
    ["2026-11-08T08:59:00", false],
    ["2026-11-08T09:00:00", true],
    ["2026-11-08T16:59:00", true],
    ["2026-11-08T17:00:00", false],
  ])("uses shared opening and closing boundaries at %s", (time, open) => {
    expect(isStoreOpenAt(new Date(time))).toBe(open);
  });

  it.each(["vi", "en"])(
    "renders each day once and uses the exact shop Maps destination (%s)",
    (locale) => {
      const { container } = render(
        <NextIntlClientProvider locale={locale} messages={{}}>
          <ContactMap contact={contact} />
          <ContactPageContent contact={contact} />
        </NextIntlClientProvider>,
      );
      const hours = container.querySelector("[data-contact-hours]")!;
      expect(hours.children).toHaveLength(3);
      for (const line of Object.values(getStoreHours(locale))) {
        expect(within(hours as HTMLElement).getByText(line, { exact: true })).toBeInTheDocument();
      }
      const iframe = container.querySelector("iframe")!;
      expect(iframe.src).toBe("https://maps.google.com/maps?cid=10172478217895770333&output=embed");
      expect(iframe.title).toBeTruthy();
      const directions = screen.getByRole("link", {
        name: locale === "vi" ? "Chỉ đường" : "Directions",
      });
      expect(directions).toHaveAttribute(
        "href",
        "https://www.google.com/maps/dir/?api=1&destination=Shop+Bigbike&destination_place_id=ChIJeXyMi5UudTER3XgTBwvnK40",
      );
      expect(directions).toHaveAttribute("target", "_blank");
      expect(directions).toHaveAttribute("rel", "noopener noreferrer");
    },
  );
});
