/**
 * Viewport matrix for bigbike-admin responsive testing.
 *
 * The admin shell (AdminShell.jsx + admin-prototype.css) switches the sidebar
 * to an off-canvas drawer + hamburger at <=900px, with extra tuning at 640px
 * and 1400px. The `kind` field below mirrors those breakpoints so specs can
 * assert behaviour (drawer vs fixed rail) without re-deriving the math.
 */
export type ViewportKind = 'mobile' | 'tablet' | 'desktop'

export interface NamedViewport {
  name: string
  width: number
  height: number
  kind: ViewportKind
  /** True when the sidebar should be an off-canvas drawer (<=900px wide). */
  sidebarIsDrawer: boolean
}

export const VIEWPORTS: NamedViewport[] = [
  { name: '375x812', width: 375, height: 812, kind: 'mobile', sidebarIsDrawer: true },
  { name: '390x844', width: 390, height: 844, kind: 'mobile', sidebarIsDrawer: true },
  { name: '430x932', width: 430, height: 932, kind: 'mobile', sidebarIsDrawer: true },
  { name: '768x1024', width: 768, height: 1024, kind: 'tablet', sidebarIsDrawer: true },
  { name: '1024x768', width: 1024, height: 768, kind: 'tablet', sidebarIsDrawer: false },
  { name: '1280x800', width: 1280, height: 800, kind: 'desktop', sidebarIsDrawer: false },
  { name: '1440x900', width: 1440, height: 900, kind: 'desktop', sidebarIsDrawer: false },
  { name: '1920x1080', width: 1920, height: 1080, kind: 'desktop', sidebarIsDrawer: false },
]

/** The breakpoint (px) at/below which the sidebar becomes a drawer. */
export const SIDEBAR_DRAWER_MAX_WIDTH = 900

export const DESKTOP_VIEWPORT = VIEWPORTS.find((v) => v.name === '1440x900')!
export const MOBILE_VIEWPORT = VIEWPORTS.find((v) => v.name === '390x844')!
