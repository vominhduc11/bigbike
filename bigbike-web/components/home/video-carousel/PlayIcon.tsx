export function PlayIcon() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2 text-white transition-transform duration-300 group-hover:scale-[1.03]"
    >
      <svg
        className="ml-1 h-10 w-10 shrink-0 drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] max-[599px]:h-9 max-[599px]:w-9"
        viewBox="0 0 14 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <polygon points="1,1 1,15 13,8" />
      </svg>
    </span>
  );
}
