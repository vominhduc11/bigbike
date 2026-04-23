import Link from "next/link";
import type { Category } from "@/lib/contracts/public";
import { safeText } from "@/lib/utils/format";
import { toCategoryPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";

type CategoryCardProps = {
  category: Category;
};

export function CategoryCard({ category }: CategoryCardProps) {
  const title = safeText(category.name, "Danh mục");
  const description = safeText(category.description, "Danh mục đang cập nhật nội dung.");

  return (
    <article className="bb-category-card bb-card bb-card-hover">
      <Link href={toCategoryPath(category.slug)} className="bb-category-card-link">
        <MediaImage
          image={category.image}
          altFallback={title}
          className="bb-category-image"
          width={1200}
          height={720}
        />
        <div className="bb-category-body">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </Link>
    </article>
  );
}

