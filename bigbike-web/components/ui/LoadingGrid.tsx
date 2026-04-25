type LoadingGridProps = {
  title?: string;
  count?: number;
};

export function LoadingGrid({ title = "Đang tải dữ liệu", count = 8 }: LoadingGridProps) {
  return (
    <section className="bb-page">
      <div className="bb-container">
        <p className="bb-kicker">{title}</p>
        <div className="bb-skeleton-grid" aria-hidden="true">
          {Array.from({ length: count }).map((_, index) => (
            <div key={index} className="bb-skeleton-item" />
          ))}
        </div>
      </div>
    </section>
  );
}

