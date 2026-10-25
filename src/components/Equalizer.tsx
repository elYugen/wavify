export function Equalizer({ playing = true, className = '' }: { playing?: boolean; className?: string }) {
  return (
    <span className={`inline-flex h-3.5 items-end gap-[2px] ${className}`} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="eq-bar w-[3px] rounded-sm bg-sunset"
          style={{ animationDelay: `${i * 0.18}s`, animationPlayState: playing ? 'running' : 'paused' }}
        />
      ))}
    </span>
  );
}
