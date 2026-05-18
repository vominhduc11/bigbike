import type { Product } from "@/lib/contracts/public";
import { ProductCard } from "@/components/catalog/ProductCard";

type ArticleProductsProps = {
  products: Product[];
};

/**
 * "SẢN PHẨM SỬ DỤNG TRONG BÀI VIẾT" — catalog products showcased inside a blog article.
 * Renders nothing when the article links no products.
 */
export function ArticleProducts({ products }: ArticleProductsProps) {
  if (!products || products.length === 0) return null;

  return (
    <section className="mt-10 pt-9 border-t border-border" aria-label="Sản phẩm sử dụng trong bài viết">
      <h2 className="font-display text-lg font-semibold uppercase tracking-[0.08em] text-foreground text-center m-0 mb-6">
        Sản phẩm sử dụng trong bài viết
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} variant="featured" />
        ))}
      </div>
    </section>
  );
}
