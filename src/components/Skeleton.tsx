export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-1 px-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 px-2 py-2" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="size-12 rounded bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/5 rounded bg-white/10" />
            <div className="h-3 w-2/5 rounded bg-white/[.06]" />
          </div>
        </div>
      ))}
    </div>
  );
}
