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
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        </svg>
      </a>
    </div>
  );
}
