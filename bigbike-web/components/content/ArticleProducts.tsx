import type { Product } from "@/lib/contracts/public";
import { ProductCard } from "@/components/catalog/ProductCard";

type ArticleProductsProps = {
  products: Product[];
  title: string;
};

export function ArticleProducts({ products, title }: ArticleProductsProps) {
  if (!products || products.length === 0) return null;

  return (
    <section className="mt-10 pt-9 border-t border-border" aria-label={title}>
      <h2 className="font-display text-lg font-semibold uppercase tracking-[0.08em] text-foreground text-center m-0 mb-6">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} variant="featured" />
        ))}
      </div>
    </section>
  );
}
