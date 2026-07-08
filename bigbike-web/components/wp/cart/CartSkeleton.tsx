import { Skeleton } from "@/components/ui/skeleton";

export function CartSkeleton({ label }: { label: string }) {
  return (
    <div className="row" aria-busy="true" aria-label={label}>
      <div className="col-md-8">
        <Skeleton className="mb-30 h-8 w-48" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-4 border-b border-border-default py-[30px]">
            <Skeleton className="h-[110px] w-[110px] shrink-0" />
            <div className="flex-1 space-y-3 pt-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <Skeleton className="h-9 w-[120px]" />
          </div>
        ))}
      </div>
      <div className="col-md-4">
        <Skeleton className="h-[220px] w-full" />
      </div>
    </div>
  );
}
