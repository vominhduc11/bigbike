"use client";

import { useState, useEffect, useRef, useCallback, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { telHref } from "@/lib/utils/format";

// b24-widget FAB structure, inlined. KEEP (in globals.css): @keyframes socialRotate /
// b24-widget-button-visible (referenced via [animation:…]) + the .bb-floating-chat-anchor
// parent-state hides (set in app/layout.tsx). The open-state gray-bg + scale(0.7) the
// legacy CSS intended are DEAD — `.b24-widget-button-bottom` was scoped as a wrapper
// ancestor but the markup put it on the button itself — so the open FAB keeps the same
// colour and only swaps the chat icon for the close icon. !rounded-[50%] beats the
// unlayered .bb-theme border-radius reset. Both the closed FAB (in the anchor) and the
// open FAB (portal) use the same mobile 48/60px sizes and the same bottom-right offset, so
// toggling open/closed never makes the button jump — only the icon swaps.
const fabContainer = "relative inline-block";
const fabMask =
  "absolute -inset-1.5 !rounded-[50%] bg-[var(--bb-chat-title-bg)] opacity-10 pointer-events-none";
const fabBlock = "w-16.5 h-16.5 !rounded-[50%] box-border overflow-hidden";
const fabInnerBlock =
  "relative w-16.5 h-16.5 !rounded-[50%] bg-[var(--bb-chat-title-bg)] text-[var(--bb-chat-title-text)] border-none cursor-pointer flex items-center justify-center [outline:none] box-border focus-visible:[outline:2px_solid_#fff] focus-visible:[outline-offset:3px]";
// Open state: FAB + mask turn gray (WP sudovn parity). Same size/position as the closed
// FAB so toggling never makes the button jump — only the colour and icon change.
const fabInnerBlockOpen =
  "relative w-16.5 h-16.5 !rounded-[50%] bg-[var(--bb-chat-close-bg)] text-[var(--bb-chat-title-text)] border-none cursor-pointer flex items-center justify-center [outline:none] box-border [transition:background_0.3s_linear] focus-visible:[outline:2px_solid_#fff] focus-visible:[outline-offset:3px]";
const fabMaskOpen =
  "absolute -inset-1.5 !rounded-[50%] bg-[var(--bb-chat-close-bg)] opacity-10 pointer-events-none";
const fabIconWrap = "relative flex-1 w-full h-full";
const fabIconItem =
  "absolute top-0 left-0 flex items-center justify-center w-full h-full [transition:opacity_0.6s_ease-out]";
const fabBlockMobile = " max-md:w-12 max-md:h-12";
// Radiating halo ring — sits behind the closed FAB and rides the bb-chat-halo loop.
// inset-0 auto-matches the button size (66px / 48px mobile); hidden for reduced motion.
const fabHaloRing =
  "absolute inset-0 !rounded-[50%] bg-[var(--bb-chat-title-bg)] opacity-0 pointer-events-none motion-reduce:hidden";
// "Bạn cần hỗ trợ?" pill — cyan box up-left of the FAB, shown in both closed and open
// states (WP sudovn parity). Hidden on mobile to avoid covering the bottom nav.
// Reaches ~110px left of the FAB, which on wide desktop screens can land on top of
// nearby in-page controls (eg. carousel next-arrows in the same right gutter) since
// it's fixed to the viewport while they scroll with the page — so it's reveal-on-hover
// (of the FAB) rather than always-on, keeping the persistent footprint to just the
// circular button while still showing the hint the moment a visitor reaches for it.
const chatTitlePill =
  "absolute right-full bottom-1/2 mr-3 translate-y-1/2 bg-[var(--bb-chat-title-bg)] !rounded-[3px] px-[5px] py-0.5 text-[var(--bb-color-white)] text-a5-meta font-[Arial,sans-serif] whitespace-nowrap max-md:hidden opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100";
// WP .sudovn-btn-social-item: padding .5rem 1rem, color #333, hover #f2f2f2; icon
// margin-right 5px (= gap). The #333 text overrides the global blue <a> link colour.
// hover:!text keeps the row text #333 — overrides the global `a:hover` brand-red rule
// so the only hover change is the #f2f2f2 background, exactly like WP.
const chatItem =
  "flex items-center gap-[5px] px-4 py-2 no-underline text-[var(--bb-chat-text)] ![transition:none] hover:!bg-muted hover:!text-[var(--bb-chat-text)]";
// WP .sudovn-btn-social-item-icon img: 40×40px (svg or png both clamped to 40px)
const chatItemIcon =
  "shrink-0 inline-flex [&_svg]:block [&_svg]:w-10 [&_svg]:h-10 [&_img]:block [&_img]:w-10 [&_img]:h-10";
// WP .sudovn-btn-social-item-label: font-size 1.1em, line-height 40px, color #333; value in <strong> (bold)
const chatItemLabel =
  "min-w-0 m-0 text-a4-content leading-10 break-words text-[var(--bb-chat-text)] [&_strong]:font-bold";

type FloatingChatProps = {
  hotline?: string;
  zaloUrl?: string;
  messengerUrl?: string;
  // Optional display text shown in the popup (e.g. a phone number, or "Bigbike.vn").
  // When empty, the value is derived from the URL (last path segment / hostname).
  zaloDisplay?: string;
  messengerDisplay?: string;
};

type ContactItem = {
  key: "hotline" | "zalo" | "messenger";
  href: string;
  label: string;
  value: string;
  icon: ReactElement;
};

// WP sudovn widget icons are PNG assets (green rounded-square phone, Messenger
// gradient), not the circular SVGs used before — extracted verbatim from the WP theme.
function IconHotline() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static WP-parity icon, no optimization needed
    <img
      src="/brand/home/chat-hotline.png"
      width="40"
      height="40"
      alt=""
      aria-hidden="true"
    />
  );
}

function IconZalo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 172 172" aria-hidden="true">
      <g fill="none" fillRule="nonzero">
        <path d="M0,172v-172h172v172z" fill="none" />
        <g fill="#3498db">
          <path d="M30.96,13.76c-9.45834,0 -17.2,7.74166 -17.2,17.2v110.08c0,9.45834 7.74166,17.2 17.2,17.2h110.08c9.45834,0 17.2,-7.74166 17.2,-17.2v-110.08c0,-9.45834 -7.74166,-17.2 -17.2,-17.2zM30.96,20.64h22.63547c-12.28454,12.78196 -19.19547,29.30221 -19.19547,46.44c0,17.7504 7.25894,34.74346 20.33094,47.60906c0.4128,0.7224 0.756,4.26452 -0.8264,8.35812c-0.9976,2.58 -2.99361,5.94986 -6.8464,7.22266c-1.4792,0.4816 -2.44133,1.93231 -2.33813,3.48031c0.1032,1.548 1.24109,2.85493 2.75469,3.16453c9.8728,1.9608 16.2661,-1.00002 21.4261,-3.33922c4.644,-2.1328 7.71017,-3.57921 12.42297,-1.65281c9.632,3.7496 19.88105,5.67735 30.47625,5.67735c14.08228,0 27.62822,-3.43749 39.56,-9.93031v13.37031c0,5.73958 -4.58042,10.32 -10.32,10.32h-110.08c-5.73958,0 -10.32,-4.58042 -10.32,-10.32v-110.08c0,-5.73958 4.58042,-10.32 10.32,-10.32zM113.52,51.6c1.892,0 3.44,1.548 3.44,3.44v30.96c0,1.892 -1.548,3.44 -3.44,3.44c-1.892,0 -3.44,-1.548 -3.44,-3.44v-30.96c0,-1.892 1.548,-3.44 3.44,-3.44zM61.92,55.04h17.2c1.2384,0 2.41095,0.68639 3.03015,1.78719c0.5848,1.0664 0.5461,2.4072 -0.1075,3.4736l-13.92797,22.25922h11.00531c1.892,0 3.44,1.548 3.44,3.44c0,1.892 -1.548,3.44 -3.44,3.44h-17.2c-1.2384,0 -2.41095,-0.68639 -3.03015,-1.78719c-0.5848,-1.0664 -0.5461,-2.4072 0.1075,-3.4736l13.92797,-22.25922h-11.00531c-1.892,0 -3.44,-1.548 -3.44,-3.44c0,-1.892 1.548,-3.44 3.44,-3.44zM94.6,65.36c2.0984,0 4.05732,0.58211 5.81172,1.54531c0.6192,-0.8944 1.58428,-1.54531 2.78828,-1.54531c1.892,0 3.44,1.548 3.44,3.44v17.2c0,1.892 -1.548,3.44 -3.44,3.44c-1.204,0 -2.16908,-0.65091 -2.78828,-1.54531c-1.7544,0.9632 -3.71332,1.54531 -5.81172,1.54531c-6.6392,0 -12.04,-5.4008 -12.04,-12.04c0,-6.6392 5.4008,-12.04 12.04,-12.04zM132.44,65.36c6.6392,0 12.04,5.4008 12.04,12.04c0,6.6392 -5.4008,12.04 -12.04,12.04c-6.6392,0 -12.04,-5.4008 -12.04,-12.04c0,-6.6392 5.4008,-12.04 12.04,-12.04zM94.6,72.24c-0.3569,0 -0.70513,0.0389 -1.0414,0.1075c-0.67255,0.1372 -1.29873,0.40218 -1.84766,0.77265c-0.54892,0.37047 -1.02031,0.84186 -1.39078,1.39078c-0.37047,0.54892 -0.63546,1.17511 -0.77265,1.84766c-0.0686,0.33627 -0.1075,0.6845 -0.1075,1.0414c0,0.3569 0.0389,0.70513 0.1075,1.0414c0.0686,0.33627 0.16528,0.65871 0.29563,0.9675c0.13034,0.3088 0.29179,0.6057 0.47703,0.88016c0.18524,0.27446 0.39829,0.52594 0.63156,0.75922c0.23328,0.23327 0.48476,0.44633 0.75922,0.63156c0.54892,0.37047 1.17511,0.63546 1.84766,0.77265c0.33627,0.0686 0.6845,0.1075 1.0414,0.1075c0.3569,0 0.70513,-0.0389 1.0414,-0.1075c2.35392,-0.48019 4.1186,-2.5542 4.1186,-5.0525c0,-2.8552 -2.3048,-5.16 -5.16,-5.16zM132.44,72.24c-0.3569,0 -0.70513,0.0389 -1.0414,0.1075c-0.33627,0.0686 -0.65871,0.16528 -0.9675,0.29563c-0.3088,0.13034 -0.6057,0.29179 -0.88016,0.47703c-0.27446,0.18524 -0.52594,0.39829 -0.75922,0.63156c-0.46655,0.46655 -0.8479,1.02179 -1.10859,1.63938c-0.13035,0.30879 -0.22703,0.63123 -0.29563,0.9675c-0.0686,0.33627 -0.1075,0.6845 -0.1075,1.0414c0,0.3569 0.0389,0.70513 0.1075,1.0414c0.0686,0.33627 0.16528,0.65871 0.29563,0.9675c0.13034,0.3088 0.29179,0.6057 0.47703,0.88016c0.18524,0.27446 0.39829,0.52594 0.63156,0.75922c0.23328,0.23327 0.48476,0.44633 0.75922,0.63156c0.27446,0.18523 0.57136,0.34669 0.88016,0.47703c0.30879,0.13035 0.63123,0.22703 0.9675,0.29563c0.33627,0.0686 0.6845,0.1075 1.0414,0.1075c0.3569,0 0.70513,-0.0389 1.0414,-0.1075c2.35392,-0.48019 4.1186,-2.5542 4.1186,-5.0525c0,-2.8552 -2.3048,-5.16 -5.16,-5.16z" />
        </g>
      </g>
    </svg>
  );
}

function IconMessenger() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static WP-parity icon, no optimization needed
    <img
      src="/brand/home/chat-messenger.png"
      width="40"
      height="40"
      alt=""
      aria-hidden="true"
    />
  );
}

function IconToggleOpen() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 29" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M14 3C8 3 3 7.5 3 13c0 3.2 1.6 6 4.1 7.9V25l3.8-2.1c1 .2 2 .3 3.1.3 6 0 11-4.5 11-10S20 3 14 3Z"
      />
    </svg>
  );
}

function IconToggleClose() {
  return (
    <svg width="29" height="29" viewBox="0 0 29 29" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M18.866 14.45l9.58-9.582L24.03.448l-9.587 9.58L4.873.447.455 4.866l9.575 9.587-9.583 9.57 4.418 4.42 9.58-9.577 9.58 9.58 4.42-4.42"
      />
    </svg>
  );
}

function extractDisplayValue(url: string): string {
  const match = /\/([^/?#]+)(?:[?#].*)?$/.exec(url);
  if (match?.[1]) return match[1];
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

// Toàn bộ overlay (backdrop + panel + FAB) render qua portal khi mở
// → FAB button luôn nổi trên mọi thứ, chỉ bấm FAB mới đóng được
function ChatOverlay({
  items,
  onClose,
  onToggle,
}: {
  items: ContactItem[];
  onClose: () => void;
  onToggle: () => void;
}) {
  const t = useTranslations("Support");
  // Scroll lock
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    const prevBodyScrollbarGutter = document.body.style.scrollbarGutter;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.scrollbarGutter = "auto";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      document.body.style.scrollbarGutter = prevBodyScrollbarGutter;
    };
  }, []);

  // Escape đóng
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const portal = (
    <>
      {/* Backdrop — click ra ngoài để đóng. Dim/blur chỉ ở mobile (dễ chạm đóng);
          desktop trong suốt để giống WP — popup nổi trên nội dung trang, không che tối. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-[2147483644] cursor-default bg-black/55 [backdrop-filter:blur(2px)] [-webkit-backdrop-filter:blur(2px)] md:bg-transparent md:[backdrop-filter:none] md:[-webkit-backdrop-filter:none]"
      />

      {/* Contact panel — WP #sudovn-btn-social: white card, min-width 300px,
          8px radius, 8px 0 padding, no border, down-arrow pointer toward the FAB. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("ariaPanel")}
        className="bb-floating-chat-panel fixed z-[2147483645] w-[min(86vw,320px)] min-w-75 !rounded-[8px] bg-[var(--bb-color-white)] py-2 text-[var(--bb-chat-text)] shadow-[0_6px_24px_rgba(0,0,0,0.18)] before:content-[''] before:absolute before:-bottom-[7px] before:right-[25px] before:border-x-[8px] before:border-x-transparent before:border-t-[8px] before:border-t-[var(--bb-color-white)]"
      >
        {items.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className={chatItem}
            target="_blank"
            rel="nofollow noreferrer"
          >
            <span className={chatItemIcon}>{item.icon}</span>
            <span className={chatItemLabel}>
              {item.label}: <strong>{item.value}</strong>
            </span>
          </a>
        ))}
      </div>

      {/* FAB — cùng kích thước & vị trí với lúc đóng (không nhảy), chỉ đổi icon */}
      <div className="bb-floating-chat-portal-fab fixed z-[2147483647]">
        <div dir="ltr" className="group relative flex flex-col-reverse items-end">
          <div className={chatTitlePill}>{t("needHelp")}</div>
          <div className={fabContainer}>
          <div className={fabMaskOpen} aria-hidden="true" />
          <div className={`${fabBlock}${fabBlockMobile}`}>
            <button
              type="button"
              className={`${fabInnerBlockOpen}${fabBlockMobile}`}
              onClick={onToggle}
              aria-label={t("close")}
              aria-expanded={true}
              aria-haspopup="dialog"
            >
              <div className={fabIconWrap}>
                <div className={`${fabIconItem} opacity-100 [animation:socialRotate_0.4s]`}>
                  <IconToggleClose />
                </div>
              </div>
            </button>
          </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(portal, document.body);
}

export function FloatingChat({
  hotline,
  zaloUrl,
  messengerUrl,
  zaloDisplay,
  messengerDisplay,
}: Readonly<FloatingChatProps>) {
  const t = useTranslations("Support");
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleOpen = useCallback(() => setIsOpen(true), []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    // Restore focus về FAB button sau khi đóng
    setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  const items: ContactItem[] = [];

  if (hotline) {
    const tel = telHref(hotline);
    // telHref keeps only digits/"+"; an empty result is just "tel:" — skip it.
    if (tel !== "tel:") {
      items.push({
        key: "hotline",
        href: tel,
        label: "Hotline",
        // WP popup shows the hotline number with no spaces
        value: hotline.replace(/\s+/g, ""),
        icon: <IconHotline />,
      });
    }
  }

  if (zaloUrl) {
    items.push({
      key: "zalo",
      href: zaloUrl,
      label: "Zalo",
      value: zaloDisplay?.trim() || extractDisplayValue(zaloUrl),
      icon: <IconZalo />,
    });
  }

  if (messengerUrl) {
    items.push({
      key: "messenger",
      href: messengerUrl,
      // "Messager" matches the WP sudovn widget label verbatim (WP's own typo).
      label: "Messager",
      value: messengerDisplay?.trim() || extractDisplayValue(messengerUrl),
      icon: <IconMessenger />,
    });
  }

  if (items.length === 0) return null;

  return (
    <>
      {/* FAB trong anchor — chỉ hiện khi đóng. Khi mở, FAB chuyển vào portal */}
      {!isOpen && (
        <div
          id="sudovn-btn-wrapper"
          dir="ltr"
          className="group relative font-[Arial,sans-serif] flex flex-col-reverse items-end [animation:b24-widget-button-visible_1s_ease-out_forwards_1]"
        >
          <div id="sudovn-btn-title" className={chatTitlePill}>
            {t("needHelp")}
          </div>
          <div className={fabContainer} id="sudovn-btn-inner-container">
            <div className={`${fabHaloRing} [animation:bb-chat-halo_2.4s_ease-out_infinite]`} aria-hidden="true" />
            <div className={`${fabHaloRing} [animation:bb-chat-halo_2.4s_ease-out_1.2s_infinite]`} aria-hidden="true" />
            <div className={fabMask} aria-hidden="true" />
            <div className={`${fabBlock}${fabBlockMobile}`}>
              <button
                ref={triggerRef}
                type="button"
                className={`${fabInnerBlock}${fabBlockMobile}`}
                onClick={handleOpen}
                aria-label={t("open")}
                aria-expanded={false}
                aria-haspopup="dialog"
              >
                <div className={fabIconWrap} id="sudovn-btn-icon-container">
                  <div className={`${fabIconItem} opacity-100`}>
                    <IconToggleOpen />
                  </div>
                  <div className={`${fabIconItem} opacity-0`} id="sudovn-btn-close">
                    <IconToggleClose />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Khi mở: backdrop + panel + FAB (với icon X) đều trong portal — nổi trên tất cả */}
      {isOpen && (
        <ChatOverlay
          items={items}
          onClose={handleClose}
          onToggle={handleClose}
        />
      )}
    </>
  );
}
