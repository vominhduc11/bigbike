"use client";

/**
 * Nút "BỘ LỌC" trên mobile (.product-list-filter .filter-mobile) — phát sự kiện
 * mở drawer sidebar (WpCategorySidebar lắng nghe "wp:catfilter-open").
 * Port DOM 1:1 từ archive-product.php.
 */
export function WpMobileFilterTrigger() {
  return (
    <div className="col-sm-6 filter-mobile-wrapper">
      <div
        className="filter-mobile"
        role="button"
        tabIndex={0}
        onClick={() => window.dispatchEvent(new CustomEvent("wp:catfilter-open"))}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") &&
          window.dispatchEvent(new CustomEvent("wp:catfilter-open"))
        }
      >
        <p>
          BỘ LỌC <i className="far fa-sliders-v" aria-hidden="true" />
        </p>
      </div>
    </div>
  );
}
