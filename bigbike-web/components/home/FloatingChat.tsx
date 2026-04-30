"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";

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
      <circle cx="20" cy="20" r="20" fill="#0068ff" />
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

function IconChat() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" fill="none">
      <path
        d="M7 9.5C7 7.6 8.6 6 10.5 6h11C23.4 6 25 7.6 25 9.5v7.3c0 1.9-1.6 3.5-3.5 3.5h-4.3l-4.8 3.9V20.3h-1.9c-1.9 0-3.5-1.6-3.5-3.5V9.5Z"
        fill="#fff"
      />
      <path d="M11 11.6h10M11 15h7" stroke="#20c4f4" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
      <path d="M3 3l8 8M11 3l-8 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function FloatingChat({ hotline, zaloUrl, messengerUrl }: FloatingChatProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
      value: zaloUrl.replace(/^https?:\/\/(?:www\.)?zalo\.me\//i, ""),
      icon: <IconZalo />,
    });
  }
  if (messengerUrl) {
    items.push({
      key: "messenger",
      href: messengerUrl,
      label: "Messenger",
      value: messengerUrl.replace(/^https?:\/\/(?:www\.)?m\.me\//i, "Bigbike.vn"),
      icon: <IconMessenger />,
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="wp-chat-float" ref={wrapperRef}>
      {!open && <span className="wp-chat-label">Bạn cần hỗ trợ?</span>}
      {open && (
        <div className="wp-chat-popup" role="dialog" aria-label="Liên hệ hỗ trợ">
          {items.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className="wp-chat-item"
              target={item.key === "hotline" ? undefined : "_blank"}
              rel={item.key === "hotline" ? undefined : "noreferrer noopener"}
            >
              <span className="wp-chat-item-icon">{item.icon}</span>
              <span className="wp-chat-item-label">
                {item.label}: <strong>{item.value}</strong>
              </span>
            </a>
          ))}
        </div>
      )}
      <button
        type="button"
        className="wp-chat-btn"
        aria-label={open ? "Đóng hỗ trợ" : "Mở liên hệ hỗ trợ"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <IconClose /> : <IconChat />}
      </button>
    </div>
  );
}
