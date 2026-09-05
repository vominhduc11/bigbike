/**
 * Account, commerce & form skeletons: checkout, account layout/inner, order
 * list/detail, order confirmation. Compose the shared primitives.
 * Re-exported via components/ui/Skeletons.tsx.
 *
 * Mỗi khung chờ tách làm 2 phần khi nó được dùng ở CẢ hai chỗ (khung chờ cấp
 * route và khối chờ bên trong component): phần `…PageSkeleton` gồm tiêu đề +
 * rail, phần `…BodySkeleton` chỉ gồm ruột. Nhờ vậy khách không thấy tiêu đề /
 * đường dẫn hiện hai lần, cũng không thấy khung chờ nhảy độ rộng giữa hai lần.
 */

"use client";

import { Container } from "@/components/layout/Container";
import { accountHeaderShell, skelCol, skelRow, skelStack } from "@/lib/ui-classes";
import {
  CheckoutHeadingSkel,
  SkeletonRoot,
  SkelBlock,
  SkelButton,
  SkelCircle,
  SkelText,
  SkelTitle,
} from "./primitives";

/* ── Đặt hàng ────────────────────────────────────────────────── */

/**
 * Ruột trang Đặt hàng — sao lại components/checkout/CheckoutClient.tsx: 3 khối
 * biểu mẫu có viền bên trái + khối tổng đơn dính bên phải
 * (`md:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]`). Trang thật KHÔNG có thanh
 * 3 bước — bản khung chờ cũ tự vẽ thêm.
 */
export function CheckoutBodySkeleton() {
  return (
    <div
      className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]"
      aria-hidden="true"
    >
      <div className="space-y-4">
        {/* Thông tin nhận hàng */}
        <section className="border border-border bg-background p-6">
          <SkelTitle w="42%" h="1.5em" />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <SkelText w="40%" />
                <SkelBlock w="100%" h={44} />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <SkelText w="25%" />
            <SkelBlock w="100%" h={88} />
          </div>
        </section>

        {/* Địa chỉ giao hàng khác */}
        <section className="border border-border bg-background p-6">
          <div className={skelRow}>
            <SkelBlock w={20} h={20} />
            <SkelText w="45%" />
          </div>
        </section>

        {/* Hình thức thanh toán + nút đặt hàng */}
        <section className="border border-border bg-background p-6">
          <SkelTitle w="38%" h="1.5em" />
          <div className={`${skelStack} mt-6`}>
            <SkelBlock w="100%" h={56} />
            <SkelBlock w="100%" h={56} />
          </div>
          <div className="mt-6">
            <SkelBlock w="100%" h={56} />
          </div>
          <div className="mt-3 flex justify-center">
            <SkelText w="60%" />
          </div>
        </section>
      </div>

      {/* Tổng đơn hàng */}
      <div className="space-y-4 md:sticky md:top-24 md:self-start">
        <div className="border border-border bg-background p-6">
          <SkelTitle w="55%" h="1.5em" />
          <div className={`${skelStack} mt-6`}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className={skelRow}>
                <SkelBlock w={56} h={56} />
                <div className={skelCol} style={{ flex: 1 }}>
                  <SkelText w="85%" />
                  <SkelText w="40%" />
                </div>
                <SkelText w={60} />
              </div>
            ))}
            <div className="border-t border-border pt-4">
              <SkelText w="100%" />
            </div>
            <SkelText w="100%" />
            <SkelTitle w="60%" h="1.4em" />
          </div>
        </div>
        <div className="border border-border bg-background p-6">
          <SkelText w="70%" />
        </div>
      </div>
    </div>
  );
}

/** Trang Đặt hàng cấp route: rail + tiêu đề + đường dẫn + ruột. */
export function CheckoutSkeleton() {
  return (
    <SkeletonRoot labelKey="checkout" className="bb-checkout-page bb-heroless">
      <Container>
        <CheckoutHeadingSkel />
        <div className="pb-15">
          <CheckoutBodySkeleton />
        </div>
      </Container>
    </SkeletonRoot>
  );
}

/* ── Tài khoản ───────────────────────────────────────────────── */

/**
 * Ruột khu tài khoản — sao lại components/account/AccountNav.tsx: đường dẫn
 * `py-8`, rồi lưới `md:grid-cols-4` (menu 1 cột + nội dung 3 cột trên nền thẻ
 * trắng). Bản cũ dùng lưới cố định 282px của giao diện đã bỏ và thiếu đường dẫn.
 */
export function AccountLayoutSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      <div className="py-8">
        <SkelText w={210} />
      </div>

      <div className="grid gap-8 pb-10 md:grid-cols-4">
        <div>
          <div className="relative mb-8 pr-10">
            <SkelCircle size={64} />
            <div className="mt-2 flex flex-col gap-2">
              <SkelText w="55%" />
              <SkelText w="80%" />
              <SkelText w="65%" />
            </div>
          </div>

          <div className="bg-card px-8 shadow-sm">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="border-b border-border py-7 last:border-b-0">
                <SkelText w={i % 2 === 0 ? "70%" : "55%"} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card p-5 shadow-sm md:col-span-3">
          <AccountBodySkeleton rows={rows} />
        </div>
      </div>
    </div>
  );
}

/** Chỉ phần nội dung bên phải — dùng khi menu tài khoản thật đã hiện. */
export function AccountBodySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      <div className={accountHeaderShell}>
        <div className={skelCol} style={{ flex: 1 }}>
          <SkelTitle w="35%" h="1.5em" />
        </div>
      </div>
      <div className={skelStack}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkelBlock key={i} w="100%" h={120} />
        ))}
      </div>
    </div>
  );
}

/** Trang tài khoản cấp route — cùng khung ngoài với components/layout/AccountShell.tsx. */
export function AccountPageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <SkeletonRoot labelKey="accountPage" className="bb-heroless">
      <Container>
        <AccountLayoutSkeleton rows={rows} />
      </Container>
    </SkeletonRoot>
  );
}

/** Chi tiết đơn — tiêu đề mục + 3 khối thẻ, khớp OrderDetailContent. */
export function OrderDetailSkeleton() {
  return <AccountBodySkeleton rows={3} />;
}

/* ── Xác nhận đơn hàng ───────────────────────────────────────── */

/** Màn cảm ơn sau khi đặt hàng. */
export function OrderConfirmSkeleton() {
  return (
    <SkeletonRoot labelKey="orderConfirm" className="bb-checkout-page bb-heroless">
      <div className="mx-auto flex w-full max-w-170 flex-col items-center px-4 py-8 text-center max-sm:px-3 max-sm:py-4">
        <SkelCircle size={88} />
        <div className={`${skelStack} mt-6 flex flex-col items-center`}>
          <SkelText w={120} />
          <SkelTitle w={340} h="2em" />
          <SkelText w={280} />
        </div>
        <div className="mt-6 grid w-full grid-cols-1 gap-4 border border-border bg-card p-6 text-left sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={skelStack}>
              <SkelText w="50%" />
              <SkelTitle w="80%" h="1.2em" />
            </div>
          ))}
        </div>
        <div className="mt-6 flex w-full flex-col justify-center gap-3 sm:flex-row">
          <SkelButton w={180} />
          <SkelButton w={200} />
        </div>
      </div>
    </SkeletonRoot>
  );
}
