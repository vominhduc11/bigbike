"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { Article, Brand, HomeVideo, Product } from "@/lib/contracts/public";

const HomeFeaturedProducts = dynamic(
  () => import("./HomeFeaturedProducts").then((mod) => mod.HomeFeaturedProducts),
  { ssr: false },
);
const ExperienceCarousel = dynamic(
  () => import("./ExperienceCarousel").then((mod) => mod.ExperienceCarousel),
  { ssr: false },
);
const HomeVideoCarousel = dynamic(
  () => import("./HomeVideoCarousel").then((mod) => mod.HomeVideoCarousel),
  { ssr: false },
);
const BrandCarousel = dynamic(() => import("./BrandCarousel").then((mod) => mod.BrandCarousel), {
  ssr: false,
});

function DeferredHomeCarousel({
  name,
  reserveClassName,
  children,
}: {
  name: string;
  reserveClassName: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || ready) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setReady(true);
        observer.disconnect();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div
      ref={ref}
      data-deferred-home-carousel={name}
      data-ready={ready ? "true" : "false"}
      className={ready ? undefined : reserveClassName}
      aria-busy={ready || undefined}
    >
      {ready ? children : <div aria-hidden="true" className="h-full w-full" />}
    </div>
  );
}

export function DeferredHomeFeaturedProducts({ initialProducts }: { initialProducts: Product[] }) {
  return (
    <DeferredHomeCarousel name="featured-products" reserveClassName="min-h-100 md:min-h-112.5">
      <HomeFeaturedProducts initialProducts={initialProducts} />
    </DeferredHomeCarousel>
  );
}

export function DeferredExperienceCarousel({ articles }: { articles: Article[] }) {
  return (
    <DeferredHomeCarousel name="experience" reserveClassName="min-h-125 md:min-h-160">
      <ExperienceCarousel articles={articles} />
    </DeferredHomeCarousel>
  );
}

export function DeferredHomeVideoCarousel({ videos }: { videos: HomeVideo[] }) {
  return (
    <DeferredHomeCarousel name="videos" reserveClassName="min-h-80 md:min-h-90">
      <HomeVideoCarousel videos={videos} />
    </DeferredHomeCarousel>
  );
}

export function DeferredBrandCarousel({ brands }: { brands: Brand[] }) {
  return (
    <DeferredHomeCarousel name="brands" reserveClassName="min-h-52">
      <BrandCarousel brands={brands} />
    </DeferredHomeCarousel>
  );
}
