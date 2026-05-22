"use client";

import { type ReactElement } from "react";

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
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#3498db" />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fontFamily="Arial, sans-serif"
        fill="#fff"
      >
        Zalo
      </text>
    </svg>
  );
}

function IconMessenger() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#0084ff" />
      <path
        d="M20 10c-5.5 0-10 4.1-10 9.2 0 2.9 1.5 5.5 3.8 7.2v3.5l3.5-1.9c.9.2 1.8.4 2.7.4 5.5 0 10-4.1 10-9.2S25.5 10 20 10Zm1 12.5-2.5-2.7-4.9 2.7 5.4-5.7 2.6 2.7 4.8-2.7-5.4 5.7Z"
        fill="#fff"
      />
    </svg>
  );
}

function extractTrailingValue(url: string, fallback: string): string {
  const match = url.match(/\/([^/?#]+)(?:[?#].*)?$/);
  return match?.[1] ?? fallback;
}

export function FloatingChat({ hotline, zaloUrl, messengerUrl }: FloatingChatProps) {
  const items: ContactItem[] = [];

  if (hotline) {
    const tel = hotline.replace(/[^\d+]/g, "");
    if (tel) {
      items.push({
        key: "hotline",
        href: `tel:${tel}`,
        label: "Hotline",
        value: tel,
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
    <div
      id="sudovn-btn-wrapper"
      className="bb-chat-float b24-widget-button-wrapper b24-widget-button-position-bottom-right b24-widget-button-visible"
      dir="ltr"
    >
      <div id="sudovn-btn-title" className="bb-chat-title">
        Bạn cần hỗ trợ?
      </div>
      <div id="sudovn-btn-social" className="bb-chat-social">
        {items.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className="bb-chat-item sudovn-btn-social-item"
            target="_blank"
            rel="nofollow noreferrer"
          >
            <span className="bb-chat-item-icon sudovn-btn-social-item-icon">{item.icon}</span>
            <span className="bb-chat-item-label sudovn-btn-social-item-label">
              {item.label}: <strong>{item.value}</strong>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
