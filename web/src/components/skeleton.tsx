/** Shimmering placeholder blocks shown instantly while a page loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-200/60 ${className}`} />
  );
}

export function PageSkeleton({ panels = 2 }: { panels?: number }) {
  return (
    <div className="mx-auto max-w-xl space-y-5 xl:max-w-6xl">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex flex-col gap-5 xl:flex-row">
        {Array.from({ length: panels }).map((_, i) => (
          <div
            key={i}
            className="flex-1 space-y-3 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
