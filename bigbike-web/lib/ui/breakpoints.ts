/* Canonical breakpoint scale — aligned with Tailwind theme tokens in globals.css.
   sm/md/lg/xl/xxl/xxxl/xxxxl map 1:1 to Tailwind sm/md/lg/xl/2xl/3xl/4xl.
   xs (360) has no Tailwind equivalent; used as Swiper carousel floor only. */
export const BB_BREAKPOINTS = {
  xs:    360,  // mobile floor (no Tailwind equiv)
  sm:    640,  // Tailwind sm
  md:    768,  // Tailwind md
  lg:   1024,  // Tailwind lg
  xl:   1280,  // Tailwind xl
  xxl:  1536,  // Tailwind 2xl
  xxxl: 1920,  // Tailwind 3xl
  xxxxl: 2560, // Tailwind 4xl
} as const;

export type BigBikeBreakpoint = keyof typeof BB_BREAKPOINTS;
