import Link from "next/link";

/**
 * kdc_pagination() — port 1:1 từ inc/utils-functions.php (WP paginate_links,
 * mid_size=1, end_size=1). Prev/next dùng icon icomoon `fal fa-angle-*`
 * (fa-angle-left không có trong icomoon nên ẩn — y hệt WP gốc).
 *
 * `baseHref` đã gồm sẵn query filter (nếu có). Trang >1 nối `paged=N`.
 */
function archiveHref(baseHref: string, p: number): string {
  if (p <= 1) return baseHref;
  return `${baseHref}${baseHref.includes("?") ? "&" : "?"}paged=${p}`;
}

/** WP paginate_links window: 1 … (cur-1) cur (cur+1) … last, with dots in gaps. */
function buildWindow(current: number, total: number, end = 1, mid = 1): (number | "dots")[] {
  const out: (number | "dots")[] = [];
  let prev = 0;
  for (let p = 1; p <= total; p++) {
    const inRange =
      p <= end || p > total - end || (p >= current - mid && p <= current + mid);
    if (!inRange) continue;
    if (prev && p - prev > 1) out.push("dots");
    out.push(p);
    prev = p;
  }
  return out;
}

export function WpCategoryPagination({
  page,
  totalPages,
  baseHref,
}: {
  page: number;
  totalPages: number;
  baseHref: string;
}) {
  if (totalPages <= 1) return null;
  const window = buildWindow(page, totalPages);

  return (
    <div className="pagination pb-40 pt-20 text-right">
      <div className="paginate-links">
        <ul className="page-numbers">
          {page > 1 && (
            <li>
              <Link className="prev page-numbers" href={archiveHref(baseHref, page - 1)}>
                <i className="fal fa-angle-left" aria-hidden="true" />
              </Link>
            </li>
          )}
          {window.map((p, i) =>
            p === "dots" ? (
              <li key={`dots-${i}`}>
                <span className="page-numbers dots">…</span>
              </li>
            ) : p === page ? (
              <li key={p}>
                <span aria-current="page" className="page-numbers current">
                  {p}
                </span>
              </li>
            ) : (
              <li key={p}>
                <Link className="page-numbers" href={archiveHref(baseHref, p)}>
                  {p}
                </Link>
              </li>
            ),
          )}
          {page < totalPages && (
            <li>
              <Link className="next page-numbers" href={archiveHref(baseHref, page + 1)}>
                <i className="fal fa-angle-right" aria-hidden="true" />
              </Link>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
