/**
 * Account, commerce & form skeletons: checkout, account layout/inner, order
 * list/detail, generic form, order confirmation. Compose the shared primitives.
 * Re-exported via components/ui/Skeletons.tsx.
 */

"use client";

import { accountHeaderShell, accountSidebar, skelCol, skelRow, skelStack } from "@/lib/ui-classes";
import {
  SkeletonRoot,
  SkelBlock,
  SkelButton,
  SkelCircle,
  SkelText,
  SkelTitle,
} from "./primitives";

/** Checkout - breadcrumb + page-head + stepper + 2-col form+summary. */
export function CheckoutSkeleton() {
  return (
    <SkeletonRoot labelKey="checkout">
      <div className="bb-breadcrumb"><SkelText w={180} /></div>
      <div className="bb-page-head">
        <SkelText w="10%" />
        <SkelTitle w="25%" h="2em" />
      </div>
      <div className="mx-auto mb-10 grid max-w-[var(--bb-container-wide)] grid-cols-[1fr_420px] gap-8 px-6 max-[1025px]:grid-cols-1 max-md:mb-7 max-md:gap-3.5 max-md:px-[var(--bb-mobile-page-x)]">
        <div>
          {/* Stepper */}
          <div className="flex gap-0 mb-6 max-md:mb-3.5 border-b border-b-border max-[601px]:overflow-x-auto max-[601px]:flex-nowrap max-[601px]:[scrollbar-width:none] max-[601px]:[&::-webkit-scrollbar]:hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-1 items-center gap-3 py-3.5 px-4 max-md:py-2.5 max-md:px-3 border-b-[3px] border-b-transparent text-muted-foreground cursor-pointer [transition:all_140ms] max-md:min-w-33 max-md:min-h-[var(--bb-touch-target)]"
              >
                <SkelCircle size={28} />
                <div className={skelCol} style={{ flex: 1 }}>
                  <SkelText w="60%" />
                  <SkelText w="80%" />
                </div>
              </div>
            ))}
          </div>
          {/* Form section 1 */}
          <div className="bg-card border border-border rounded-none py-5.5 px-6 max-md:py-4 max-md:px-3.5 mb-4.5 max-md:mb-3">
            <SkelTitle w="40%" />
            <div
              style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr", marginTop: 18 }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={skelStack}>
                  <SkelText w="40%" />
                  <SkelBlock w="100%" h={42} />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-none py-5.5 px-6 max-md:py-4 max-md:px-3.5 mb-4.5 max-md:mb-3">
            <SkelTitle w="35%" />
            <div className={skelStack} style={{ marginTop: 18 }}>
              <SkelBlock w="100%" h={56} />
              <SkelBlock w="100%" h={56} />
            </div>
          </div>
        </div>
        <aside className="bg-card border border-border rounded-none p-5.5 max-md:py-4 max-md:px-3.5 sticky max-[769px]:static top-[calc(var(--bb-header-height)+34px+16px)] [align-self:start] max-md:mb-3">
          <div className={skelStack}>
            <SkelTitle w="60%" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className={skelRow}>
                <SkelBlock w={56} h={56} />
                <div className={skelCol} style={{ flex: 1 }}>
                  <SkelText w="40%" />
                  <SkelText w="85%" />
                </div>
                <SkelText w={60} />
              </div>
            ))}
            <SkelText w="100%" />
            <SkelText w="100%" />
            <SkelTitle w="60%" h="1.4em" />
          </div>
        </aside>
      </div>
    </SkeletonRoot>
  );
}


/** Full account layout (sidebar + main) used before AccountShell loads. */
export function AccountLayoutSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <SkeletonRoot labelKey="accountPage" className="bb-account-layout bb-heroless">
      <aside className={accountSidebar}>
        <div style={{ padding: "24px 22px", borderBottom: "1px solid var(--bb-border-subtle)" }}>
          <SkelCircle size={56} />
          <div className={skelStack} style={{ marginTop: 12 }}>
            <SkelText w="60%" />
            <SkelText w="80%" />
          </div>
        </div>
        <div className={skelStack} style={{ padding: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkelBlock key={i} w="100%" h={36} />
          ))}
        </div>
      </aside>
      <div className="min-w-0">
        <div className={accountHeaderShell}>
          <div className={skelCol} style={{ flex: 1 }}>
            <SkelTitle w="30%" h="1.6em" />
            <SkelText w="50%" />
          </div>
        </div>
        <div className={skelStack}>
          {Array.from({ length: rows }).map((_, i) => (
            <SkelBlock key={i} w="100%" h={120} />
          ))}
        </div>
      </div>
    </SkeletonRoot>
  );
}


/** Order detail - header + summary card + items + totals + addresses. */
export function OrderDetailSkeleton() {
  return (
    <SkeletonRoot labelKey="orderDetail">
      <div className={accountHeaderShell}>
        <div className={skelCol} style={{ flex: 1 }}>
          <SkelTitle w="30%" h="1.6em" />
          <SkelText w="20%" />
        </div>
      </div>
      <div className={skelStack}>
        <SkelBlock w="100%" h={200} />
        <SkelBlock w="100%" h={160} />
        <SkelBlock w="100%" h={140} />
      </div>
    </SkeletonRoot>
  );
}


/** Order confirmation / success screen */
export function OrderConfirmSkeleton() {
  return (
    <SkeletonRoot labelKey="orderConfirm">
      <div className="mx-auto flex w-full max-w-170 flex-col items-center px-4 py-10 text-center md:py-16">
        <SkelCircle size={88} />
        <div className={`${skelStack} mt-6 items-center`}>
          <SkelText w={120} />
          <SkelTitle w="60%" h="2.2em" />
          <SkelText w="80%" />
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
