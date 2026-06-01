"use client";

import { useRouter } from "next/navigation";
import { useWishlist } from "@/lib/wishlist-context";
import { useAuth } from "@/lib/auth/auth-store";
import { toLoginPath } from "@/lib/utils/routes";
import { CardIconButton } from "@/components/shared/CardIconButton";

type WishlistButtonProps = {
  productId: string;
};

export function WishlistButton({ productId }: WishlistButtonProps) {
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

  return (
    <CardIconButton
      active={active}
      ariaLabel={active ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
      top="top-[10px]"
      disabled={auth.status === "loading"}
      className="cursor-pointer"
      onClick={handleClick}
    >
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
    </CardIconButton>
  );
}
