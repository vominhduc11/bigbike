export const BB_BREAKPOINTS = {
  xs: 360,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1440,
} as const;

export type BigBikeBreakpoint = keyof typeof BB_BREAKPOINTS;
