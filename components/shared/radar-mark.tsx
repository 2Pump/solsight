export function RadarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" stroke="url(#rm-ring)" strokeWidth="1.5" opacity="0.5" />
      <circle cx="16" cy="16" r="10" stroke="url(#rm-ring)" strokeWidth="1.5" opacity="0.7" />
      <circle cx="16" cy="16" r="2.5" fill="#7C5CFF" />
      <path
        d="M16 16 L16 3 A13 13 0 0 1 27 10 Z"
        fill="url(#rm-sweep)"
        opacity="0.9"
      />
      <defs>
        <linearGradient id="rm-ring" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#7C5CFF" />
          <stop offset="100%" stopColor="#00E5C7" />
        </linearGradient>
        <linearGradient id="rm-sweep" x1="16" y1="3" x2="27" y2="10">
          <stop offset="0%" stopColor="#7C5CFF" />
          <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
