import { Skeleton } from "@/components/ui/skeleton";

export function CartSkeleton({ label }: { label: string }) {
  return (
    <div className="grid gap-8 md:grid-cols-12" aria-busy="true" aria-label={label}>
      <div className="md:col-span-8">
        <Skeleton className="mb-30 h-8 w-48" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-4 border-b border-border-default py-7.5">
            <Skeleton className="h-27.5 w-27.5 shrink-0" />
            <div className="flex-1 space-y-3 pt-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <Skeleton className="h-9 w-30" />
          </div>
        ))}
      </div>
      <div className="md:col-span-4">
        <Skeleton className="h-55 w-full" />
      </div>
    </div>
  );
}
