"use client";

import { useRouter } from "next/navigation";
import { useWishlist } from "@/lib/wishlist-context";
import { useAuth } from "@/lib/auth/auth-store";
import { toLoginPath } from "@/lib/utils/routes";
import { CardIconButton } from "@/components/shared/CardIconButton";
import { cn } from "@/lib/utils";

type WishlistButtonProps = {
  productId: string;
  /**
   * "overlay" (mặc định): nút tròn absolute đè lên góc card (ProductCard,
   * WpProductSwipeItem). "inline": nút có nhãn, nằm đúng dòng chảy — dùng cho
   * trang chi tiết sản phẩm (PDP), tránh đè lên tiêu đề.
   */
  variant?: "overlay" | "inline";
};

function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function WishlistButton({ productId, variant = "overlay" }: WishlistButtonProps) {
  const auth = useAuth();
  const { toggle, isWishlisted } = useWishlist();
  const router = useRouter();
  const active = isWishlisted(productId);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (auth.status === "loading") return;
    if (auth.status !== "authenticated") {
      const returnTo = window.location.pathname + window.location.search;
      router.push(toLoginPath(returnTo));
      return;
    }
    void toggle(productId);
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        aria-label={active ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
        aria-pressed={active}
        disabled={auth.status === "loading"}
        onClick={handleClick}
        className={cn(
          "flex flex-1 min-w-[130px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap border-2 px-4 py-3 font-body text-sm font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          active
            ? "border-brand bg-brand-soft text-brand"
            : "border-border text-foreground hover:border-brand hover:text-brand",
        )}
      >
        <HeartIcon active={active} />
        <span>{active ? "Đã yêu thích" : "Yêu thích"}</span>
      </button>
    );
  }

  return (
    <CardIconButton
      active={active}
      ariaLabel={active ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
      top="top-[10px]"
      disabled={auth.status === "loading"}
      className="cursor-pointer"
      onClick={handleClick}
    >
      <HeartIcon active={active} />
    </CardIconButton>
  );
}
