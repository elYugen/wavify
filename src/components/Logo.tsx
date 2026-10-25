export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img src="/favicon.svg" alt="" className="size-9" />
      <span className="font-display text-[22px] font-extrabold tracking-tight">
        wavi<span className="text-sunset">fy</span>
      </span>
    </div>
  );
}
