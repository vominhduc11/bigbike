type LoadingGridProps = {
  title?: string;
  count?: number;
};

export function LoadingGrid({ title = "Đang tải dữ liệu", count = 8 }: LoadingGridProps) {
  return (
    <section className="bb-page">
      <div className="bb-container">
        <p className="mb-3 font-cta text-sm font-semibold uppercase tracking-normal text-brand">{title}</p>
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-hidden="true"
        >
          {Array.from({ length: count }).map((_, index) => (
            <div
              key={index}
              className="min-h-[280px] border border-border bg-secondary animate-pulse"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
