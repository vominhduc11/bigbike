import { PaginationNav } from "@/components/ui/PaginationNav";

export function CatalogPagination({
  page,
  totalPages,
  baseHref,
}: {
  page: number;
  totalPages: number;
  baseHref: string;
}) {
  return (
    <PaginationNav
      page={page}
      totalPages={totalPages}
      baseHref={baseHref}
      variant="archive"
    />
  );
}
