import Image from "next/image";
import { cn } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/utils/format";

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-b5-label",
  md: "h-10 w-10 text-a4-content",
  lg: "h-14 w-14 text-a3-section",
} as const;

const SIZE_PX = { sm: 32, md: 40, lg: 56 } as const;

type AvatarProps = {
  url?: string | null;
  name: string;
  size?: keyof typeof SIZE_CLASSES;
  /** "brand" = brand-red circular fallback (own-account contexts: sidebar, header).
   *  "neutral" = muted square fallback matching ReviewCard's pre-existing initials badge. */
  variant?: "brand" | "neutral";
  className?: string;
};

export function Avatar({ url, name, size = "md", variant = "neutral", className }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const px = SIZE_PX[size];
  const src = resolveMediaUrl(url);

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={px}
        height={px}
        className={cn(
          "shrink-0 object-cover",
          SIZE_CLASSES[size],
          // .bb-theme ép border-radius:0 lên img/span (globals.css) — Tailwind rounded-full
          // một mình bị đè. .bb-account-avatar là escape hatch có sẵn của theme cho ảnh tròn.
          variant === "brand" ? "rounded-full bb-account-avatar" : "",
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center font-body font-semibold",
        SIZE_CLASSES[size],
        variant === "brand"
          ? "rounded-full bb-account-avatar bg-brand text-white"
          : "bg-muted text-[var(--bb-text-primary)]",
        className,
      )}
    >
      {initial}
    </span>
  );
}
