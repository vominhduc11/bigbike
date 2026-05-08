# Homepage P0/P1 Fix Report

**Date:** 2026-05-08
**Engineer:** Claude (Opus 4.7)
**Scope:** PHẠM VI FIX LẦN 1 — 4 confirmed P0/P1 findings from `HOMEPAGE_UI_UX_RESPONSIVE_PRECHECK.md`
**Branch:** main

---

## Summary

| Fix | Finding | File(s) | Status |
|-----|---------|---------|--------|
| 1 | H-05 — Hotline giả `0903 123 456` | SiteHeader.tsx, MobileHeaderMenu.tsx | ✅ Fixed |
| 2 | H-06 — BCT badge/link giả | SiteFooter.tsx | ✅ Fixed |
| 3 | H-07 — Mã ĐKKD hardcode | SiteFooter.tsx | ✅ Fixed |
| 4 | H-04 — Mobile add-to-cart hover-only | globals.css | ✅ Fixed |

---

## Fix 1 — Hotline giả `0903 123 456` (H-05)

### Files changed
- [bigbike-web/components/layout/SiteHeader.tsx](../../bigbike-web/components/layout/SiteHeader.tsx)
- [bigbike-web/components/layout/MobileHeaderMenu.tsx](../../bigbike-web/components/layout/MobileHeaderMenu.tsx)

### Before → After

**SiteHeader.tsx `PromoStrip`** (line 56 removed):
```diff
- const supportLabel = hotline || "0903 123 456";
  ...
- Hotline {supportLabel}
- {zaloUrl ? " · Zalo hỗ trợ nhanh" : " · Giao hàng toàn quốc"}
+ {hotline ? `Hotline ${hotline} · ` : ""}
+ {zaloUrl ? "Zalo hỗ trợ nhanh" : "Giao hàng toàn quốc"}
```

When `hotline` is empty the promo strip now shows only "Zalo hỗ trợ nhanh" or "Giao hàng toàn quốc" — no hotline prefix.

**MobileHeaderMenu.tsx** (line 274):
```diff
- <div className="wp-mobile-drawer-contact">
-   <span>HOTLINE</span>
-   <b>{hotline || "0903 123 456"}</b>
-   {zaloUrl && <a ...>Zalo hỗ trợ nhanh</a>}
- </div>
+ {(hotline || zaloUrl) && (
+   <div className="wp-mobile-drawer-contact">
+     {hotline && (
+       <>
+         <span>HOTLINE</span>
+         <b>{hotline}</b>
+       </>
+     )}
+     {zaloUrl && <a ...>Zalo hỗ trợ nhanh</a>}
+   </div>
+ )}
```

Contact block hidden entirely when both `hotline` and `zaloUrl` are empty. Hotline line hidden when only `zaloUrl` is set.

### Acceptance verified
```
grep -rn "0903 123 456" bigbike-web/components/ bigbike-web/app/ → 0 results ✅
```

---

## Fix 2 — BCT badge/link giả (H-06)

### File changed
- [bigbike-web/components/layout/SiteFooter.tsx](../../bigbike-web/components/layout/SiteFooter.tsx)

### Before → After

```diff
- <div className="bb-footer-bottom-bct">
-   <a href={bctUrl || "https://online.gov.vn/"} ...>
-     <BctBadge ... />
-   </a>
- </div>
+ {bctUrl && (
+   <div className="bb-footer-bottom-bct">
+     <a href={bctUrl} ...>
+       <BctBadge ... />
+     </a>
+   </div>
+ )}
```

BCT block and badge are now rendered only when `bct_url` setting is non-empty. When the setting is absent the DOM contains no BCT element.

### Acceptance verified
```
grep -n "online.gov.vn" bigbike-web/components/layout/SiteFooter.tsx → 0 results ✅
```

---

## Fix 3 — Mã ĐKKD hardcode (H-07)

### File changed
- [bigbike-web/components/layout/SiteFooter.tsx](../../bigbike-web/components/layout/SiteFooter.tsx)

### Before → After

Added three new settings reads (after `bctUrl`):
```tsx
const businessLicenseNo       = getSettingValue(settings, ["business_license_no"], "");
const businessLicenseDate      = getSettingValue(settings, ["business_license_date"], "");
const businessLicenseAuthority = getSettingValue(settings, ["business_license_authority"], "");
```

Footer bottom copy:
```diff
- <p>© {new Date().getFullYear()} BigBike. Mã ĐKKD: 41K8017383.</p>
- <p>Ngày cấp: 8/3/2016. Nơi cấp: Ủy Ban Nhân Dân Quận 11, TP.HCM.</p>
+ <p>© {new Date().getFullYear()} {siteName}.</p>
+ {businessLicenseNo && (
+   <p>
+     Mã ĐKKD: {businessLicenseNo}.
+     {businessLicenseDate ? ` Ngày cấp: ${businessLicenseDate}.` : ""}
+     {businessLicenseAuthority ? ` Nơi cấp: ${businessLicenseAuthority}.` : ""}
+   </p>
+ )}
```

Legal lines render only when `business_license_no` is set. Date and authority appear only when their respective keys are set.

**Backend action required:** Add these three keys to the admin settings panel so the store owner can fill in the correct values:
- `business_license_no`
- `business_license_date`
- `business_license_authority`

### Acceptance verified
```
grep -rn "41K8017383|8/3/2016|Ủy Ban Nhân Dân Quận 11" bigbike-web/components/ bigbike-web/app/ → 0 results ✅
```

---

## Fix 4 — Mobile add-to-cart hover-only (H-04)

### File changed
- [bigbike-web/app/globals.css](../../bigbike-web/app/globals.css)

### Before → After

Added one line after `.wp-product-addbar` rule (line 4163):
```css
@media (hover: none), (pointer: coarse) { .wp-product-addbar { transform: translateY(0); } }
```

On touch devices the addbar is permanently visible (translated to `Y(0)`) regardless of hover state. The existing `translateY(100%)` default and hover transition remain intact for pointer devices.

### Acceptance verified
```
grep -n "hover: none" bigbike-web/app/globals.css → line 4163 ✅
```

---

## TypeScript verification

```
npx tsc --noEmit --project bigbike-web/tsconfig.json → 0 errors ✅
```

---

## Remaining P0/P1 findings NOT in this scope

| Finding | Description | Status |
|---------|-------------|--------|
| H-01 | HeroSlider `toHeroSlide` drops slides with no desktopImage | Out of scope — requires CMS data / design decision |
| H-02 | ExperienceCarousel LEGACY_EXPERIENCE_MEDIA dead image paths | Out of scope — requires new media assets |
| H-03 | Settings fetched 5× per page load (no deduplication) | Out of scope — performance task, not P0 UX |
| H-08 | SearchModal missing focus trap + return focus | Out of scope — a11y task, separate PR |
| H-09 | VideoModal missing focus trap + return focus | Out of scope — a11y task, separate PR |
| H-10 | MobileDrawer missing role="dialog" + focus trap | Out of scope — a11y task, separate PR |
