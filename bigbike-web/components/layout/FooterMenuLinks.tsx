"use client";

import Link from "@/i18n/StorefrontLink";
import { useLocale } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { getGuideLayout } from "@/lib/content/static-pages";
import { getPolicyLinks, getRetainedPolicyLinks } from "@/lib/content/policy-pages";
import { translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

type FooterSection = {
  value: "menu" | "support" | "social" | "about";
  title: ReactNode;
  content: ReactNode;
};

/** One navigation tree: compact on phones, fully expanded on desktop.
 * forceMount keeps every link in the HTML; hidden + inert prevents keyboard
 * focus from entering a collapsed panel. Mobile choices survive resizing. */
export function FooterSections({
  contact,
  sections,
}: {
  contact: ReactNode;
  sections: FooterSection[];
}) {
  const desktop = useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, () => false);
  const [expanded, setExpanded] = useState<string[]>(["social"]);

  return (
    <Accordion
      type="multiple"
      value={desktop ? sections.map((section) => section.value) : expanded}
      onValueChange={setExpanded}
      className="grid grid-cols-1 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-6"
    >
      <div className="min-w-0 pb-6 lg:col-span-4 lg:pb-0">{contact}</div>
      {sections.map((section) => {
        const open = desktop || expanded.includes(section.value);
        return (
          <AccordionItem
            key={section.value}
            value={section.value}
            data-footer-section={section.value}
            {...{ [`data-footer-${section.value}`]: "" }}
            className={cn(
              "min-w-0 border-b border-white/15 lg:border-b-0",
              section.value === "menu" && "border-t lg:col-span-3 lg:border-t-0",
              section.value === "support" && "lg:col-span-3",
              section.value === "social" && "lg:col-span-2",
              section.value === "about" && "lg:col-span-12 lg:border-t lg:pt-5",
            )}
          >
            <AccordionTrigger
              disabled={desktop}
              tabIndex={desktop ? -1 : undefined}
              className="group min-h-14 justify-start gap-3 py-3 text-left text-white hover:text-brand-inverse focus-visible:outline-brand-inverse disabled:cursor-default disabled:opacity-100 lg:mb-3 lg:min-h-11 lg:py-0"
              indicator={
                <span
                  key="indicator"
                  className="order-first shrink-0 text-brand-inverse lg:hidden"
                  aria-hidden
                >
                  <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
                  <Minus className="hidden h-4 w-4 group-data-[state=open]:block" />
                </span>
              }
            >
              <span key="title">{section.title}</span>
            </AccordionTrigger>
            <AccordionContent
              forceMount
              data-footer-content
              aria-hidden={!open}
              inert={!open}
              panelClassName="data-[state=closed]:hidden lg:block! lg:h-auto lg:animate-none"
              className="pb-5 text-a4-content leading-body lg:pb-0"
            >
              {section.content}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

/** Liên kết chính sách và hướng dẫn size — client component để
 * đổi ngôn ngữ ngay khi bấm nút chuyển vi/en, không cần tải lại trang (cùng cơ chế
 * với menu header - xem HeaderMenu.tsx). Không còn gọi API/Menu admin. */
function buildRetainedMenuItems(locale: string) {
  const isEn = locale === "en";

  const guideLayout = getGuideLayout(locale);
  const sizeMuEntry = guideLayout.entries.find((e) => e.pageSlug === "cach-do-size-dau");
  const sizeTrangPhucEntry = guideLayout.entries.find(
    (e) => e.pageSlug === "cach-do-size-trang-phuc",
  );

  return [
    ...getRetainedPolicyLinks(locale),
    {
      id: "helmet-sizing",
      href: "/huong-dan/size-mu/",
      label:
        sizeMuEntry?.title || (isEn ? "Helmet Sizing Guide" : "Cách xác định size mũ bảo hiểm"),
    },
    {
      id: "clothing-sizing",
      href: "/huong-dan/size-trang-phuc/",
      label:
        sizeTrangPhucEntry?.title ||
        (isEn ? "Clothing Sizing Guide" : "Cách đo size trang phục bảo hộ"),
    },
  ];
}

function renderLink(item: { href: string; label: string }, locale: string) {
  return (
    <Link
      href={translatePath(item.href, locale as Locale)}
      className="flex min-h-11 items-center py-2 text-[var(--bb-text-inverse-secondary)]! no-underline! hover:text-brand-inverse! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-inverse"
    >
      {item.label}
    </Link>
  );
}

export function FooterMenuLinks() {
  const locale = useLocale();
  const policies = getPolicyLinks(locale);

  return (
    <ul data-footer-policy-list className="m-0 flex list-none flex-col gap-1 p-0">
      {policies.map((item) => (
        <li key={item.href} data-footer-menu-link={item.id}>
          {renderLink(item, locale)}
        </li>
      ))}
    </ul>
  );
}

export function FooterSupportLinks() {
  const locale = useLocale();
  const items = buildRetainedMenuItems(locale);

  return (
    <ul data-footer-retained-links className="m-0 flex list-none flex-col gap-1 p-0">
      {items.map((item) => (
        <li key={item.href} data-footer-support-link={item.id}>
          {renderLink(item, locale)}
        </li>
      ))}
    </ul>
  );
}
