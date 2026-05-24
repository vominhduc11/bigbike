"use client";

import { useState, useEffect, useRef, type ReactElement } from "react";

type FloatingChatProps = {
  hotline?: string;
  zaloUrl?: string;
  messengerUrl?: string;
};

type ContactItem = {
  key: "hotline" | "zalo" | "messenger";
  href: string;
  label: string;
  value: string;
  icon: ReactElement;
};

function IconHotline() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#00b14f" />
      <path
        d="M14.6 13.2a1.6 1.6 0 0 1 1.6-1.2h2.1c.7 0 1.3.5 1.4 1.2l.5 2.5a1.4 1.4 0 0 1-.4 1.3l-1.4 1.3c1 1.9 2.5 3.4 4.4 4.4l1.3-1.4a1.4 1.4 0 0 1 1.3-.4l2.5.5c.7.1 1.2.7 1.2 1.4v2.1a1.6 1.6 0 0 1-1.6 1.6c-7.7 0-14-6.3-14-14Z"
        fill="#fff"
      />
    </svg>
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
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="bb-msg-grad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#00B2FF" />
          <stop offset="100%" stopColor="#006AFF" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill="url(#bb-msg-grad)" />
      <path
        fill="#fff"
        d="M20 9C13.925 9 9 13.582 9 19.2c0 3.265 1.628 6.178 4.175 8.099V31l3.778-2.078c1.01.28 2.08.428 3.19.428 6.075 0 11-4.582 11-10.15C31 13.582 26.075 9 20 9zm1.082 13.652L18.64 20.1l-4.86 2.677 5.35-5.685 2.523 2.552 4.86-2.677-5.35 5.685z"
      />
    </svg>
  );
}

function IconToggleOpen() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 29" fill="none" aria-hidden="true">
      <path
        fill="#fff"
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
        fill="#fff"
        fillRule="evenodd"
        d="M18.866 14.45l9.58-9.582L24.03.448l-9.587 9.58L4.873.447.455 4.866l9.575 9.587-9.583 9.57 4.418 4.42 9.58-9.577 9.58 9.58 4.42-4.42"
      />
    </svg>
  );
}

function extractTrailingValue(url: string, fallback: string): string {
  const match = /\/([^/?#]+)(?:[?#].*)?$/.exec(url);
  return match?.[1] ?? fallback;
}

export function FloatingChat({ hotline, zaloUrl, messengerUrl }: Readonly<FloatingChatProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  const items: ContactItem[] = [];

  if (hotline) {
    const tel = hotline.replace(/[^\d+]/g, "");
    if (tel) {
      items.push({
        key: "hotline",
        href: `tel:${tel}`,
        label: "Hotline",
        value: hotline,
        icon: <IconHotline />,
      });
    }
  }

  if (zaloUrl) {
    items.push({
      key: "zalo",
      href: zaloUrl,
      label: "Zalo",
      value: extractTrailingValue(zaloUrl, "0764640679"),
      icon: <IconZalo />,
    });
  }

  if (messengerUrl) {
    items.push({
      key: "messenger",
      href: messengerUrl,
      label: "Messenger",
      value: "Bigbike.vn",
      icon: <IconMessenger />,
    });
  }

  if (items.length === 0) return null;

  return (
    <>
      {/* Full-screen overlay — position:fixed escapes parent stacking, closes popup on click */}
      <div
        id="sudovn-btn-shadow"
        className={`b24-widget-button-shadow${isOpen ? " b24-widget-button-show" : ""}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Main wrapper — flex column-reverse: toggle button at bottom, social above, title floats beside button via CSS */}
      <div
        ref={wrapperRef}
        id="sudovn-btn-wrapper"
        dir="ltr"
        className={`bb-chat-float b24-widget-button-visible${isOpen ? " b24-widget-button-bottom" : ""}`}
      >
        {/* Title — positioned beside toggle button via position:relative + bottom/right in CSS */}
        <div id="sudovn-btn-title" className="bb-chat-title">
          Bạn cần hỗ trợ?
        </div>

        {/* Social popup — absolute, appears above the toggle button */}
        <div
          id="sudovn-btn-social"
          className={`bb-chat-social${isOpen ? " b24-widget-button-show" : ""}`}
        >
          {items.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className="sudovn-btn-social-item bb-chat-item"
              target="_blank"
              rel="nofollow noreferrer"
            >
              <div className="sudovn-btn-social-item-icon bb-chat-item-icon">{item.icon}</div>
              <div className="sudovn-btn-social-item-label bb-chat-item-label">
                {item.label}: <strong>{item.value}</strong>
              </div>
            </a>
          ))}
        </div>

        {/* Toggle button area */}
        <div className="b24-widget-button-inner-container" id="sudovn-btn-inner-container">
          <div className="b24-widget-button-inner-mask" aria-hidden="true" />
          {/* Circle clip wrapper */}
          <div className="b24-widget-button-block">
            <button
              type="button"
              className="b24-widget-button-inner-block"
              onClick={() => setIsOpen((v) => !v)}
              aria-label={isOpen ? "Đóng hỗ trợ" : "Mở hỗ trợ"}
              aria-expanded={isOpen}
            >
              <div className="b24-widget-button-icon-container" id="sudovn-btn-icon-container">
                {/* Chat icon — CSS shows this by default, hides when b24-widget-button-bottom */}
                <div className="b24-widget-button-inner-item b24-widget-button-icon-animation">
                  <IconToggleOpen />
                </div>
                {/* Close icon — CSS shows this when b24-widget-button-bottom */}
                <div className="b24-widget-button-inner-item b24-widget-button-close" id="sudovn-btn-close">
                  <IconToggleClose />
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
