import { cn } from "@/lib/utils";

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id="aura-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2cc2b1" />
            <stop offset="1" stopColor="#0b7d72" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#aura-g)" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="white" strokeOpacity=".35" strokeWidth="1.5" />
        <path d="M16 9.5v13M9.5 16h13" stroke="white" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {!compact && (
        <span className="text-[15px]">
          Aura <span className="text-primary">Saúde</span>
        </span>
      )}
    </span>
  );
}
