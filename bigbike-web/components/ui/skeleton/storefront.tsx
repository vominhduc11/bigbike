/**
 * Storefront skeletons: home, product detail, catalog/category/brand archives,
 * search, article list. Compose the shared primitives. Re-exported via
 * components/ui/Skeletons.tsx.
 *
 * Mỗi khung chờ ở đây phải dựng lại ĐÚNG những khối trang thật có — cùng băng-rôn,
 * cùng số cột, cùng chiều cao — và KHÔNG dựng khối trang thật không có. Bản trước
 * đây dùng các class bố cục cũ (bb-page-head, bb-breadcrumb, bb-product-card…) mà
 * không trang nào còn dùng, nên khung chờ lệch hẳn so với nội dung hiện ra sau đó.
 */

"use client";

import { Container } from "@/components/layout/Container";
import { skelStack } from "@/lib/ui-classes";
import {
  ArticleCardSkel,
  BrandCardSkel,
  CategoryTileSkel,
  HomeBlockHeadingSkel,
  HomeHighlightCardSkel,
  HomeNewsCardSkel,
  PageHeroSkel,
  ProductCardSkel,
  SkeletonRoot,
  SkelBlock,
  SkelButton,
  SkelChip,
  SkelText,
  SkelTitle,
} from "./primitives";

/** Lưới sản phẩm dùng chung cho /sp, /danh-muc, /tim-kiem — khớp CatalogResults. */
const CATALOG_GRID = "grid grid-cols-2 gap-x-5 md:grid-cols-4 md:gap-x-8";

/**
 * Trang chủ — băng-rôn + 3 ô nổi bật + khối giới thiệu + khối sản phẩm nổi bật +
 * lưới danh mục. Dừng ở đây: các khối dưới (trải nghiệm, tin tức, video, thương
 * hiệu) nằm quá xa màn hình đầu, dựng thêm chỉ tốn công mà khách không thấy.
 *
 * Băng-rôn phải giữ ĐÚNG tỉ lệ của HeroSlider (12/5 máy tính, 411/548 điện thoại,
 * ngưỡng md) — sai tỉ lệ là trang nhảy vài trăm pixel khi ảnh thật vào.
 */
export function HomeSkeleton() {
  return (
    <SkeletonRoot labelKey="home">
      {/* 1. Băng-rôn chính */}
      <div className="relative aspect-[12/5] h-auto w-full overflow-hidden bg-black max-md:aspect-[411/548]">
        <SkelBlock w="100%" h="100%" style={{ position: "absolute", inset: 0 }} />
      </div>

      {/* 2. Ba ô sản phẩm nổi bật */}
      <section className="py-15">
        <Container>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <HomeHighlightCardSkel key={i} />
            ))}
          </div>
        </Container>
      </section>

      {/* 3. Khối giới thiệu BigBike */}
      <section className="py-10">
        <Container>
          <HomeBlockHeadingSkel className="mb-10" />
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-2">
            <SkelText w="100%" />
            <SkelText w="94%" />
            <SkelText w="97%" />
            <SkelText w="60%" />
          </div>
        </Container>
      </section>

      {/* 4. Sản phẩm nổi bật + lưới danh mục */}
      <section className="py-10">
        <Container>
          <HomeBlockHeadingSkel className="mb-10" />
          <div className="grid grid-cols-2 gap-x-5 md:grid-cols-4 md:gap-x-[30px]">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkel key={i} />
            ))}
          </div>

          <div className="mb-10 mt-32 max-md:mt-18">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <CategoryTileSkel key={i} />
              ))}
            </div>
          </div>
        </Container>
      </section>
    </SkeletonRoot>
  );
}

/**
 * Chi tiết sản phẩm — sao lại components/catalog/ProductView.tsx: breadcrumb,
 * hai cột ảnh/thông tin, rồi khối mô tả + sản phẩm liên quan.
 */
export function PdpSkeleton() {
  return (
    <SkeletonRoot labelKey="product" className="bb-product-page bb-heroless">
      <div className="mx-auto w-full max-w-300 px-4">
        <div className="hidden py-8 md:block">
          <SkelText w={260} />
        </div>

        <div className="grid items-start gap-8 min-[1024px]:grid-cols-12">
          {/* Ảnh: ảnh lớn vuông + dải ảnh nhỏ (ProductGallery) */}
          <div className="min-w-0 min-[1024px]:col-span-7">
            <div className="flex w-full min-w-0 flex-col gap-2.5 max-md:gap-2">
              <div className="relative aspect-square w-full overflow-hidden bg-white max-md:border max-md:border-border">
                <SkelBlock w="100%" h="100%" style={{ position: "absolute", inset: 0 }} />
              </div>
              <div className="grid grid-cols-5 gap-2.5 px-9 max-md:px-10">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="aspect-square">
                    <SkelBlock w="100%" h="100%" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Thông tin + mua hàng */}
          <div className="flex min-w-0 flex-col gap-4 min-[1024px]:col-span-5">
            <SkelText w="30%" />
            <div className="flex flex-col gap-2">
              <SkelTitle w="90%" h="1.7em" />
              <SkelTitle w="55%" h="1.7em" />
            </div>
            <SkelText w="35%" />
            <div className="my-2 border-y border-border py-4">
              <SkelTitle w="40%" h="1.8em" />
            </div>
            <SkelText w="22%" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkelChip key={i} w={62} />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <SkelButton w={150} h={52} />
              <SkelButton w={150} h={52} />
            </div>
            <div className={`${skelStack} mt-4`}>
              <SkelText w="100%" />
              <SkelText w="85%" />
            </div>
          </div>
        </div>

        {/* Mô tả + sản phẩm liên quan */}
        <div className="mt-12 border-t border-border pt-10">
          <div className={skelStack}>
            <SkelText w="100%" />
            <SkelText w="93%" />
            <SkelText w="98%" />
            <SkelText w="62%" />
          </div>

          <div className="mt-12">
            <SkelTitle w={260} h="1.5em" />
            <div className={CATALOG_GRID}>
              {Array.from({ length: 4 }).map((_, i) => (
                <ProductCardSkel key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** Cột lọc bên trái — ẩn trên điện thoại đúng như CatalogSidebar thật. */
function CatalogSidebarSkel() {
  return (
    <div className="hidden min-w-0 pr-3 md:block">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border-b border-border">
          <div className="flex items-center justify-between py-3">
            <SkelText w={i % 2 === 0 ? "55%" : "42%"} />
            <SkelBlock w={16} h={16} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Hàng công cụ phía trên lưới — khớp CatalogResults (đếm số SP, sắp xếp, nút lọc mobile). */
function CatalogToolbarSkel() {
  return (
    <div className="py-4">
      <div className="-mx-4 grid grid-cols-2 items-center sm:-mx-6 md:mx-0 md:flex md:justify-between md:gap-6">
        <div className="order-3 col-span-2 mt-4 px-4 sm:px-6 md:order-1 md:mt-0 md:px-0">
          <SkelText w={150} />
        </div>
        <div className="order-2 md:order-2">
          <SkelBlock w={200} h={44} />
        </div>
        <div className="order-1 md:hidden">
          <SkelBlock w="100%" h={52} />
        </div>
      </div>
    </div>
  );
}

/**
 * Danh sách sản phẩm (/sp) và danh mục (/danh-muc) — băng-rôn + cột lọc + lưới 4
 * cột (2 cột trên điện thoại), khớp CatalogClient/CatalogResults.
 */
export function CatalogSkeleton({ labelKey = "category" }: { labelKey?: string }) {
  return (
    <SkeletonRoot labelKey={labelKey}>
      <PageHeroSkel className="mb-4 md:mb-22.5" />
      <Container>
        <CatalogGridSkeleton />
      </Container>
    </SkeletonRoot>
  );
}

/**
 * Chỉ phần dưới băng-rôn của trang danh mục — dùng cho khối chờ đặt BÊN TRONG
 * trang chi tiết danh mục (băng-rôn thật đã hiện trước, chỉ lưới còn đang tải).
 */
export function CatalogGridSkeleton() {
  return (
    <div className="grid gap-8 pb-10 md:grid-cols-[minmax(220px,1fr)_3fr]" aria-hidden="true">
      <CatalogSidebarSkel />
      <div className="min-w-0">
        <div className="pb-10">
          <CatalogToolbarSkel />
          <div className={CATALOG_GRID}>
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkel key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Danh sách thương hiệu — băng-rôn + lưới thẻ 2/3/5 cột khớp BrandListClient. */
export function BrandListSkeleton() {
  return (
    <SkeletonRoot labelKey="brandList">
      <PageHeroSkel />
      <Container>
        <div className="grid grid-cols-2 gap-3 pb-10 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <BrandCardSkel key={i} />
          ))}
        </div>
      </Container>
    </SkeletonRoot>
  );
}

/**
 * Trang tìm kiếm — cùng khung với danh sách sản phẩm (băng-rôn + cột lọc + lưới).
 * Bản cũ vẽ một "biểu mẫu tìm kiếm 2 ô + nút" mà trang thật không hề có.
 */
export function SearchSkeleton({ label }: { label?: string }) {
  return (
    <SkeletonRoot label={label} labelKey={label ? undefined : "search"}>
      <PageHeroSkel className="mb-4 md:mb-22.5" />
      <Container>
        <CatalogGridSkeleton />
      </Container>
    </SkeletonRoot>
  );
}

/**
 * Danh sách bài viết (/tin-tuc) — băng-rôn + đoạn dẫn + lưới thẻ 1/2/3 cột chiếm
 * TRỌN bề ngang. Trang thật KHÔNG có cột menu bên trái.
 */
export function ArticleListSkeleton() {
  return (
    <SkeletonRoot labelKey="content">
      <PageHeroSkel />
      <Container>
        <div className="flex flex-col gap-2 pb-15">
          <SkelText w="100%" />
          <SkelText w="96%" />
          <SkelText w="72%" />
        </div>
        <div className="grid grid-cols-1 gap-6 pb-10 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ArticleCardSkel key={i} />
          ))}
        </div>
      </Container>
    </SkeletonRoot>
  );
}

/** Chi tiết bài viết — băng-rôn + thân bài + bài liên quan. */
export function ArticleDetailSkeleton() {
  return (
    <SkeletonRoot labelKey="content">
      <PageHeroSkel />
      <Container>
        <div className="pb-15">
          <div className="mb-6 flex flex-col gap-3">
            <SkelTitle w="85%" h="1.9em" />
            <SkelText w={200} />
          </div>
          <div className="mb-8 aspect-[16/9]">
            <SkelBlock w="100%" h="100%" />
          </div>
          <div className={skelStack}>
            <SkelText w="100%" />
            <SkelText w="97%" />
            <SkelText w="93%" />
            <SkelText w="99%" />
            <SkelText w="68%" />
            <SkelText w="100%" />
            <SkelText w="88%" />
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <HomeNewsCardSkel key={i} />
            ))}
          </div>
        </div>
      </Container>
    </SkeletonRoot>
  );
}
