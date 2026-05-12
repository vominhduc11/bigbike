import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MediaImage } from "@/components/ui/MediaImage";
import { listCategories } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import { toCategoryListPath, toCategoryPath, toHomePath } from "@/lib/utils/routes";
import type { Category } from "@/lib/contracts/public";

export const metadata: Metadata = buildPublicMetadata({
  title: "Danh mục sản phẩm",
  description: "Khám phá tất cả danh mục đồ bảo hộ biker tại BigBike — mũ bảo hiểm, áo giáp, găng tay, giày và phụ kiện rider chính hãng.",
  canonicalPath: toCategoryListPath(),
  noIndex: false,
});

const DESC_MAX = 100;

function stripAndTruncate(raw: string): string {
  const plain = raw.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
  return plain.length > DESC_MAX ? plain.slice(0, DESC_MAX).trimEnd() + "…" : plain;
}

type TreeNode = Category & { children: TreeNode[] };

function buildTree(all: Category[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(all.map((c) => [c.id, { ...c, children: [] }]));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (arr: TreeNode[]) =>
    arr.sort((a, b) => {
      if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
      if (a.sortOrder != null) return -1;
      if (b.sortOrder != null) return 1;
      return a.name.localeCompare(b.name);
    });
  const sortAll = (nodes: TreeNode[]) => {
    sort(nodes);
    nodes.forEach((n) => sortAll(n.children));
    return nodes;
  };
  return sortAll(roots);
}

export default async function CategoryListPage() {
  const result = await listCategories({ page: 1, size: 100, sort: "sortOrder:asc" });

  const visible = result.data.filter((c) => c.isVisible);
  const roots = buildTree(visible);

  return (
    <>
      <div className="wp-breadcrumb">
        <Link href={toHomePath()}>Trang chủ</Link>
        <span className="sep">/</span>
        <span className="wp-breadcrumb-active">Danh mục sản phẩm</span>
      </div>

      <div className="wp-page-head">
        <span className="kicker">Shop gear biker</span>
        <h1>Danh mục sản phẩm</h1>
      </div>

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 24px 64px" }}>
        {result.error && visible.length === 0 ? (
          <ErrorState message={result.error.message} retryHref={toCategoryListPath()} />
        ) : roots.length === 0 ? (
          <EmptyState
            title="Chưa có danh mục"
            description="Danh sách danh mục sản phẩm hiện đang rỗng."
          />
        ) : (
          <div className="bb-cat-sections">
            {roots.map((root) => (
              <section key={root.id} className="bb-cat-section">
                {/* Root category card */}
                <article className="bb-card bb-card-hover bb-category-card">
                  <Link href={toCategoryPath(root.slug)} className="bb-category-card-link">
                    <MediaImage
                      image={root.image ?? root.icon}
                      altFallback={safeText(root.name, "Danh mục")}
                      className="bb-category-image"
                      width={1200}
                      height={675}
                    />
                    <div className="bb-category-body">
                      <h2>{safeText(root.name, "Danh mục")}</h2>
                      {root.description && (
                        <p>{stripAndTruncate(root.description)}</p>
                      )}
                    </div>
                  </Link>
                </article>

                {/* Sub-categories chips */}
                {root.children.length > 0 && (
                  <div className="bb-cat-children">
                    {root.children.map((child) => (
                      <Link
                        key={child.id}
                        href={toCategoryPath(child.slug)}
                        className="bb-cat-child-chip"
                      >
                        {safeText(child.name, child.slug)}
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
