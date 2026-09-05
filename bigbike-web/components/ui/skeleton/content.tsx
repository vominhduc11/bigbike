/**
 * Content, static-page & auth skeletons: generic CMS page, auth card, contact,
 * guide. Compose the shared primitives. Re-exported via components/ui/Skeletons.tsx.
 */

"use client";

import { Container } from "@/components/layout/Container";
import { skelStack } from "@/lib/ui-classes";
import { PageHeroSkel, SkeletonRoot, SkelBlock, SkelText, SkelTitle } from "./primitives";

/**
 * Biểu mẫu đăng nhập / đăng ký / quên mật khẩu khi đang tải.
 *
 * Khung ngoài (2 nửa màn hình: ảnh thương hiệu trái + cột biểu mẫu phải) do
 * app/[locale]/(auth)/layout.tsx → AuthRouteShell dựng và GIỮ NGUYÊN khi đổi
 * trang, nên khung chờ chỉ được thay phần biểu mẫu. Dựng lại cả khung ngoài ở
 * đây sẽ lồng thêm một tấm ảnh thương hiệu thứ hai vào trong cột biểu mẫu.
 */
export function AuthFormSkeleton({ withTitle = true }: { withTitle?: boolean } = {}) {
  return (
    <div className="w-full" aria-hidden="true">
      {/* Tiêu đề (AuthTitleBlock: header mb-6, h1 mb-2) */}
      {withTitle ? (
        <div className="mb-6">
          <SkelTitle w={200} h="1.6em" />
        </div>
      ) : null}
      <div className={skelStack}>
        <SkelText w="30%" />
        <SkelBlock w="100%" h={48} />
        <SkelText w="30%" />
        <SkelBlock w="100%" h={48} />
        <div className="flex items-center gap-2 py-2">
          <SkelBlock w={20} h={20} />
          <SkelText w="35%" />
        </div>
        <SkelBlock w="100%" h={52} />
        <div className="flex flex-col items-center gap-2 pt-2">
          <SkelText w="60%" />
          <SkelText w="45%" />
        </div>
      </div>
    </div>
  );
}

/** Khung chờ cấp route cho 3 trang xác thực — chỉ phần biểu mẫu, xem ghi chú trên. */
export function AuthSkeleton() {
  return (
    <SkeletonRoot labelKey="auth">
      <AuthFormSkeleton />
    </SkeletonRoot>
  );
}

/**
 * Trang nội dung tĩnh (Giới thiệu, chính sách…) — băng-rôn tiêu đề rồi thân bài.
 * Trang thật mở đầu bằng băng-rôn cao 250/450px; bản cũ bỏ hẳn băng-rôn nên trang
 * nhảy gần nửa màn hình khi nội dung vào.
 */
export function StaticPageSkeleton({
  title,
  withHero = true,
}: {
  title?: string;
  withHero?: boolean;
}) {
  return (
    <SkeletonRoot label={title} labelKey={title ? undefined : "staticPage"}>
      {withHero ? <PageHeroSkel /> : null}
      <Container>
        <div className={`${skelStack} pb-15`}>
          <SkelText w="100%" />
          <SkelText w="94%" />
          <SkelText w="98%" />
          <SkelText w="62%" />
          <div className="pt-6">
            <SkelTitle w="45%" h="1.5em" />
          </div>
          <SkelText w="100%" />
          <SkelText w="88%" />
          <SkelText w="93%" />
          <SkelText w="55%" />
        </div>
      </Container>
    </SkeletonRoot>
  );
}

/**
 * Liên hệ — bản đồ tràn viền cao 420px (`mb-7.5 h-105`) rồi lưới 2 cột thông tin
 * ngăn nhau bằng đường kẻ 1px. Trang này KHÔNG có băng-rôn tiêu đề.
 */
export function ContactSkeleton() {
  return (
    <SkeletonRoot labelKey="contact" className="bb-contact-page bb-heroless">
      <div className="relative mb-7.5 h-105 w-full overflow-hidden bg-secondary">
        <SkelBlock w="100%" h="100%" style={{ position: "absolute", inset: 0 }} />
      </div>
      <Container>
        <div className="grid grid-cols-1 border-t border-border md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, col) => (
            <div key={col} className="border-b border-border bg-background p-5 md:border-l md:first:border-l-0">
              <div className="mb-5 flex items-center gap-2 border-b-2 border-brand pb-3">
                <SkelBlock w={18} h={18} />
                <SkelTitle w="55%" h="1.3em" />
              </div>
              <div className="flex flex-col gap-4.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <SkelBlock w={36} h={36} />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <SkelText w="35%" />
                      <SkelText w="75%" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </SkeletonRoot>
  );
}

/**
 * Hướng dẫn / trang có menu bên — băng-rôn + lưới 12 cột (menu 3 cột + nội dung 9
 * cột) khớp components/layout/StaticSidebarLayout.tsx, và GỘP về 1 cột trên điện
 * thoại. Bản cũ dùng lưới cố định "260px 1fr" viết thẳng vào style nên không co
 * được, điện thoại bị ép ngang.
 */
export function GuideSkeleton({ label }: { label?: string }) {
  return (
    <SkeletonRoot label={label} labelKey={label ? undefined : "content"}>
      <PageHeroSkel />
      <Container className="grid grid-cols-1 gap-8 pb-10 md:grid-cols-12">
        <div className="md:col-span-3">
          <div className="flex flex-col gap-3">
            <SkelTitle w="60%" h="1.2em" />
            {Array.from({ length: 6 }).map((_, i) => (
              <SkelBlock key={i} w="100%" h={44} />
            ))}
          </div>
        </div>
        <div className="min-w-0 md:col-span-9">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-border bg-white p-6">
                <SkelBlock w={44} h={44} />
                <div className="mb-2 mt-4">
                  <SkelTitle w="70%" h="1.2em" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <SkelText w="100%" />
                  <SkelText w="80%" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </SkeletonRoot>
  );
}
