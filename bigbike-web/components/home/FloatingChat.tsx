"use client";

type FloatingChatProps = {
  href: string;
  isExternal?: boolean;
};

export function FloatingChat({ href, isExternal }: FloatingChatProps) {
  return (
    <div className="wp-chat-float">
      <span className="wp-chat-label">Bạn cần hỗ trợ?</span>
      <a
        href={href}
        className="wp-chat-btn"
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noreferrer noopener" : undefined}
        aria-label="Liên hệ hỗ trợ"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
        >
          <rect width="28" height="28" rx="8" fill="white" fillOpacity="0.15" />
          <text x="14" y="20" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="15" fill="white">Z</text>
          <ellipse cx="14" cy="14" rx="11" ry="9" stroke="white" strokeWidth="1.8" fill="none" />
          <path d="M6 22 Q5 24 8 23" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      </a>
    </div>
  );
}
