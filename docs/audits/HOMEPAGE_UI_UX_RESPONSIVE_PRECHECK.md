# HOMEPAGE UI/UX RESPONSIVE PRECHECK

> **Audit type:** Static code audit (pre-runtime)
> **Date:** 2026-05-08
> **Scope:** `bigbike-web` homepage + layout chrome
> **Method:** File-level reading of all in-scope files. NO browser/Playwright was run.
> **Editor commit:** working tree (uncommitted: see git status). `revalidate = 3600` on `app/page.tsx`.
> **Hard rule honored:** Không sửa code, không tạo commit, không overwrite.

---

## 1. Executive Summary

### Score: **62 / 100**

Trang chủ đã có khung kiến trúc chuyên nghiệp (Next.js 16 server components + Embla carousels + ISR + JSON-LD đầy đủ + CSP + Sentry). Một số P0 cũ đã fix (ProductCardAddBar đã hỏi variants; footer menu/guide đã có fallback link cứng). Nhưng còn **4 trust risk thật** và **một loạt accessibility gap mở** trên modal/drawer/search. Mobile add-to-cart bị ẩn hoàn toàn vì addbar dùng `:hover`.

### Production ready?

**Chưa.** Có thể beta nhưng phải fix Group A trong "Recommended Fix Order" trước khi mở ra public traffic, đặc biệt là 3 trust gap (hotline giả, BCT badge giả, mã ĐKKD hardcode chưa verify).

### Top 5 vấn đề lớn nhất

1. **[H-01] Hotline giả `0903 123 456` xuất hiện 2 chỗ** ([SiteHeader.tsx:56](bigbike-web/components/layout/SiteHeader.tsx#L56), [MobileHeaderMenu.tsx:274](bigbike-web/components/layout/MobileHeaderMenu.tsx#L274)) — khách bấm "tel:0903123456" → gọi nhầm số người khác. Trust + legal risk.
2. **[H-02] BCT badge link giả** — khi backend không có `bct_url`, footer vẫn link `https://online.gov.vn/` (homepage Bộ Công Thương) như thể đã đăng ký. Đây là legal risk vì website TMĐT phải có URL xác minh thật trên `online.gov.vn`. ([SiteFooter.tsx:323](bigbike-web/components/layout/SiteFooter.tsx#L323))
3. **[H-03] Mã ĐKKD `41K8017383` hardcode trong code** ([SiteFooter.tsx:318-319](bigbike-web/components/layout/SiteFooter.tsx#L318-L319)) — không có nguồn verify trong repo, không di động sang môi trường khác.
4. **[H-04] Mobile add-to-cart KHÔNG sử dụng được** — `.wp-product-addbar` chỉ trượt lên khi `:hover`, không có media query mobile. Trên touch device, button không bao giờ thấy. ([globals.css:4155, 4162](bigbike-web/app/globals.css#L4155))
5. **[H-05] Mobile drawer / Search modal / Video modal accessibility yếu** — không focus trap, không return focus về trigger, search modal thiếu `aria-modal`, search modal không lock body scroll. Khách dùng keyboard hoặc screen reader sẽ bị "lost" trong modal.

### Đáng khen (đã fix từ audit Haiku/Opus trước)

- ProductCardAddBar đã chuyển sang router.push(PDP) khi `hasVariants` → fix [FN-01] cũ.
- Footer column "Menu" và "Hướng dẫn" đã có `FALLBACK_FOOTER_LINKS` / `FALLBACK_GUIDE_LINKS` → fix một phần của [TRUST-01] cũ.
- Hero slider có thực sự dùng `next/image` cho fallback và CDN-friendly `<picture>` kèm `loading=eager` + `fetchPriority=high` cho slide đầu.
- ARIA labels cho dots / nav buttons / sliders đầy đủ.

---

## 2. What Was Verified

### Files đã đọc (toàn bộ)

- [bigbike-web/app/page.tsx](bigbike-web/app/page.tsx) — toàn bộ
- [bigbike-web/app/layout.tsx](bigbike-web/app/layout.tsx) — toàn bộ
- [bigbike-web/app/globals.css](bigbike-web/app/globals.css) — đọc selective, 6134 dòng
- [bigbike-web/styles/brand-tokens.css](bigbike-web/styles/brand-tokens.css) — đọc selective, 709 dòng
- [bigbike-web/components/home/HeroSlider.tsx](bigbike-web/components/home/HeroSlider.tsx)
- [bigbike-web/components/home/FeaturedProductsCarousel.tsx](bigbike-web/components/home/FeaturedProductsCarousel.tsx)
- [bigbike-web/components/home/ExperienceCarousel.tsx](bigbike-web/components/home/ExperienceCarousel.tsx)
- [bigbike-web/components/home/HomeVideoCarousel.tsx](bigbike-web/components/home/HomeVideoCarousel.tsx)
- [bigbike-web/components/home/BrandCarousel.tsx](bigbike-web/components/home/BrandCarousel.tsx)
- [bigbike-web/components/home/HomeAnalytics.tsx](bigbike-web/components/home/HomeAnalytics.tsx)
- [bigbike-web/components/home/FloatingChat.tsx](bigbike-web/components/home/FloatingChat.tsx)
- [bigbike-web/components/layout/SiteHeader.tsx](bigbike-web/components/layout/SiteHeader.tsx)
- [bigbike-web/components/layout/MobileHeaderMenu.tsx](bigbike-web/components/layout/MobileHeaderMenu.tsx)
- [bigbike-web/components/layout/SearchToggle.tsx](bigbike-web/components/layout/SearchToggle.tsx)
- [bigbike-web/components/layout/SiteFooter.tsx](bigbike-web/components/layout/SiteFooter.tsx)
- [bigbike-web/components/layout/BctBadge.tsx](bigbike-web/components/layout/BctBadge.tsx)
- [bigbike-web/components/layout/StickyHeaderShell.tsx](bigbike-web/components/layout/StickyHeaderShell.tsx)
- [bigbike-web/components/layout/HeaderNavItem.tsx](bigbike-web/components/layout/HeaderNavItem.tsx)
- [bigbike-web/components/layout/FloatingChatLoader.tsx](bigbike-web/components/layout/FloatingChatLoader.tsx)
- [bigbike-web/components/catalog/ProductCard.tsx](bigbike-web/components/catalog/ProductCard.tsx)
- [bigbike-web/components/catalog/ProductCardAddBar.tsx](bigbike-web/components/catalog/ProductCardAddBar.tsx)
- [bigbike-web/components/ui/MediaImage.tsx](bigbike-web/components/ui/MediaImage.tsx)
- [bigbike-web/lib/api/public-api.ts](bigbike-web/lib/api/public-api.ts)
- [bigbike-web/next.config.ts](bigbike-web/next.config.ts)
- [BIGBIKE_WEB_AUDIT_OPUS.md](BIGBIKE_WEB_AUDIT_OPUS.md) — audit cũ (so sánh)

### Tests/builds đã chạy

**Không.** Theo yêu cầu user "không sửa code". Mọi finding cần runtime measurement (CLS, Lighthouse, scrollWidth check) đều marked **Needs Runtime Verification** và liệt ở Section 5/6.

---

## 3. Findings

### [H-01] P0 — Hotline giả `0903 123 456` xuất hiện ở header strip + mobile drawer

- **Severity:** P0
- **Status:** Confirmed
- **Evidence:**
  - [bigbike-web/components/layout/SiteHeader.tsx:56](bigbike-web/components/layout/SiteHeader.tsx#L56)
    ```tsx
    const supportLabel = hotline || "0903 123 456";
    ```
  - [bigbike-web/components/layout/MobileHeaderMenu.tsx:274](bigbike-web/components/layout/MobileHeaderMenu.tsx#L274)
    ```tsx
    <b>{hotline || "0903 123 456"}</b>
    ```
  - Setting `hotline` được fetch từ `listPublicSettings()` ([SiteHeader.tsx:75-86](bigbike-web/components/layout/SiteHeader.tsx#L75-L86)). Nếu key chưa seed trong admin, fallback hardcode chạy.
- **Impact:**
  - **Trust:** Số `0903 123 456` là dải VinaPhone thật, có khả năng đang được người khác sở hữu. Khách bấm số này sẽ gọi nhầm.
  - **Legal:** Hiển thị số liên lạc giả trong "Hotline" có thể dẫn đến complaint từ chủ số thật.
  - **Conversion:** Khách gọi không có người nghe → bỏ shop.
- **Recommendation:**
  - Khi `hotline` rỗng: **ẩn toàn bộ phần hotline** thay vì show fallback giả.
    - Header: `{hotline ? `Hotline ${hotline}` : "Giao hàng toàn quốc"}` hoặc ẩn span.
    - Mobile drawer: chỉ render khối `wp-mobile-drawer-contact` khi có ít nhất 1 contact thật.
  - Hoặc dùng số chính chủ đã verify rồi mới hardcode.
  - Footer **đã đúng** — chỉ render khi có hotline ([SiteFooter.tsx:236-243](bigbike-web/components/layout/SiteFooter.tsx#L236-L243)). Header/mobile cần align theo logic footer.
- **Acceptance Criteria:**
  - Trong môi trường settings rỗng: không có chuỗi `0903 123 456` xuất hiện ở DOM.
  - `grep -rn "0903 123 456" bigbike-web/` chỉ trả về 0 kết quả trong runtime build (ngoại trừ test fixtures nếu có).

---

### [H-02] P0 — BCT badge link đến `online.gov.vn/` (homepage Bộ Công Thương) khi không có URL xác minh thật

- **Severity:** P0
- **Status:** Confirmed
- **Evidence:**
  - [bigbike-web/components/layout/SiteFooter.tsx:321-330](bigbike-web/components/layout/SiteFooter.tsx#L321-L330)
    ```tsx
    <div className="bb-footer-bottom-bct">
      <a
        href={bctUrl || "https://online.gov.vn/"}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Đã thông báo Bộ Công Thương"
      >
        <BctBadge alt="Đã thông báo Bộ Công Thương" height={36} />
      </a>
    </div>
    ```
  - [bigbike-web/components/layout/BctBadge.tsx:11-23](bigbike-web/components/layout/BctBadge.tsx#L11-L23) — render badge `/bct-logo.png` không phụ thuộc setting.
- **Impact:**
  - **Legal:** Theo Nghị định 52/2013 + 85/2021, website TMĐT phải đăng ký/thông báo và link tới URL xác minh cụ thể trên `online.gov.vn` (dạng `https://online.gov.vn/Home/WebsiteDetails?websiteId=XXX`). Hiển thị badge BCT mà link tới homepage chung là **giả mạo logo Bộ Công Thương** — có thể bị xử phạt.
  - **Trust:** Khách hiểu biết bấm vào sẽ thấy chuyển đến homepage chung → mất niềm tin.
- **Recommendation:**
  - Chỉ render badge khi `bctUrl` non-empty và là URL `online.gov.vn` thật:
    ```tsx
    {bctUrl && bctUrl.includes("online.gov.vn") ? (
      <a href={bctUrl} ...><BctBadge ... /></a>
    ) : null}
    ```
  - Nếu chưa đăng ký → ẩn badge hoàn toàn.
- **Acceptance Criteria:**
  - Khi `bct_url` rỗng / không phải URL `online.gov.vn` → không có icon BCT trong DOM.
  - Khi có URL hợp lệ → badge link tới đúng URL website-details, không phải homepage gov.

---

### [H-03] P1 — Mã ĐKKD, ngày cấp, nơi cấp hardcode trong source

- **Severity:** P1
- **Status:** Confirmed (legal verifiability not validated)
- **Evidence:**
  - [bigbike-web/components/layout/SiteFooter.tsx:318-319](bigbike-web/components/layout/SiteFooter.tsx#L318-L319)
    ```tsx
    <p>© {new Date().getFullYear()} BigBike. Mã ĐKKD: 41K8017383.</p>
    <p>Ngày cấp: 8/3/2016. Nơi cấp: Ủy Ban Nhân Dân Quận 11, TP.HCM.</p>
    ```
- **Impact:**
  - **Maintainability:** Đổi mã/đổi địa chỉ kinh doanh → phải redeploy code. Settings panel admin không edit được.
  - **Verifiability:** Mã `41K8017383` không tìm thấy trong `docs/business/` hoặc `docs/legacy/` — auditor không xác minh được mã đúng. Nếu mã sai, footer hiển thị thông tin pháp lý sai → vi phạm.
  - **Multi-env:** Nếu sau này có brand sister hoặc môi trường staging → text này vẫn hiển thị mã thật.
- **Recommendation:**
  - Move sang `public_settings` keys: `business_license_no`, `business_license_date`, `business_license_authority`.
  - Footer fallback: nếu thiếu thì ẩn 2 dòng đó (vì đây là legal info, sai còn tệ hơn không có).
  - **Trước launch:** verify mã `41K8017383` đúng với GPKD thực tế của BigBike (cần user/owner xác nhận).
- **Acceptance Criteria:**
  - 3 settings keys exist ở backend, populated với mã verify thật.
  - Footer render từ settings, không hardcode.
  - Nếu settings rỗng → 2 dòng legal copy không xuất hiện.

---

### [H-04] P0 — Mobile add-to-cart KHÔNG sử dụng được vì `wp-product-addbar` chỉ hover-only

- **Severity:** P0
- **Status:** Confirmed
- **Evidence:**
  - [bigbike-web/app/globals.css:4162](bigbike-web/app/globals.css#L4162)
    ```css
    .wp-product-addbar {
      ...
      transform: translateY(100%);
      transition: transform 220ms ...;
    }
    ```
  - [bigbike-web/app/globals.css:4155](bigbike-web/app/globals.css#L4155)
    ```css
    .wp-product-card:hover .wp-product-addbar { transform: translateY(0); }
    ```
  - Không có rule `@media (pointer: coarse)` hay `(hover: none)` show sẵn addbar trên touch.
  - [bigbike-web/components/catalog/ProductCardAddBar.tsx:37-45](bigbike-web/components/catalog/ProductCardAddBar.tsx#L37-L45) render button bình thường nhưng CSS không cho thấy.
- **Impact:**
  - Touch users (phần lớn traffic VN ecommerce) **không bao giờ thấy** nút "Thêm vào giỏ" / "Chọn biến thể" trên product card homepage carousel.
  - Khách phải tap vào card → vào PDP → mới mua được. Mất bước "quick add" trên card.
  - Conversion drop trên mobile cho carousel "Sản phẩm mới".
- **Recommendation:**
  - Thêm media query cho touch:
    ```css
    @media (hover: none), (pointer: coarse) {
      .wp-product-addbar { transform: translateY(0); }
    }
    ```
  - Hoặc redesign: button luôn visible trên mobile, ẩn trên desktop chỉ hover (giống Shopee/Tiki).
- **Acceptance Criteria:**
  - Test trên iPhone/Android viewport (≤768px hoặc `pointer: coarse`): addbar visible trên mọi product card.
  - Click `THÊM VÀO GIỎ HÀNG` đi vào flow add cart đúng.

---

### [H-05] P1 — Mobile drawer thiếu focus trap, return focus, ARIA dialog

- **Severity:** P1
- **Status:** Confirmed
- **Evidence:**
  - [bigbike-web/components/layout/MobileHeaderMenu.tsx:158-172](bigbike-web/components/layout/MobileHeaderMenu.tsx#L158-L172)
    ```tsx
    useEffect(() => {
      if (!open) return;
      function onKeyDown(event: KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
      }
      document.addEventListener("keydown", onKeyDown);
      document.body.classList.add("wp-mobile-menu-open");
      // Không có focus trap, không return focus
    }, [open]);
    ```
  - [bigbike-web/components/layout/MobileHeaderMenu.tsx:205](bigbike-web/components/layout/MobileHeaderMenu.tsx#L205)
    ```tsx
    <aside className="wp-mobile-drawer" aria-label={menuLabel}>
    ```
    Thiếu `role="dialog"` + `aria-modal="true"`.
  - Body scroll lock đã có (`wp-mobile-menu-open`) ở [globals.css:2058-2060](bigbike-web/app/globals.css#L2058-L2060) — ✅ OK.
  - Escape close — ✅ OK.
- **Impact:**
  - **Accessibility:**
    - Tab key đi xuyên drawer ra background → screen reader / keyboard user mất context.
    - Khi đóng drawer, focus về `<body>` thay vì button hamburger → user phải Tab lại từ đầu.
    - Screen reader không announce dialog modal → không biết phải Escape để thoát.
  - WCAG 2.1: vi phạm 2.1.2 (No Keyboard Trap), 2.4.3 (Focus Order), 4.1.2 (Name, Role, Value).
- **Recommendation:**
  - Add `role="dialog"` + `aria-modal="true"` vào `<aside>`.
  - Implement focus trap (e.g. `react-focus-lock` hoặc tự `getElementsByTagName` + boundary).
  - Trên close: `triggerButtonRef.current?.focus()`.
- **Acceptance Criteria:**
  - Tab quanh drawer chỉ vòng trong drawer.
  - Escape đóng drawer + focus về hamburger button.
  - axe-core 0 vi phạm về dialog.

---

### [H-06] P1 — Search modal thiếu `aria-modal`, không lock body scroll, focus trap, return focus

- **Severity:** P1
- **Status:** Confirmed
- **Evidence:**
  - [bigbike-web/components/layout/SearchToggle.tsx:162](bigbike-web/components/layout/SearchToggle.tsx#L162)
    ```tsx
    <div className="wp-search-shell" role="dialog" aria-label="Tìm kiếm">
    ```
    Thiếu `aria-modal="true"`.
  - [bigbike-web/components/layout/SearchToggle.tsx:51-61](bigbike-web/components/layout/SearchToggle.tsx#L51-L61) — `useEffect(open)` setup focus input + Escape close, **không** lock body overflow, **không** trap focus, **không** return focus.
  - Focus input khi mở — ✅ OK ([SearchToggle.tsx:55](bigbike-web/components/layout/SearchToggle.tsx#L55)).
  - Escape close — ✅ OK ([SearchToggle.tsx:96](bigbike-web/components/layout/SearchToggle.tsx#L96)).
  - Cmd/Ctrl+K toggle — ✅ OK.
- **Impact:**
  - Khách scroll background khi modal mở (touch & scroll wheel) → confusing.
  - Tab key đi xuyên modal → suggestions ngoài modal nhận focus.
  - Đóng modal: focus về `<body>` không phải search button.
- **Recommendation:**
  - Add `aria-modal="true"`.
  - `useEffect`: `document.body.style.overflow = "hidden"` + cleanup (giống VideoModal trong [HomeVideoCarousel.tsx:36-39](bigbike-web/components/home/HomeVideoCarousel.tsx#L36-L39)).
  - Focus trap + return focus về search trigger button.
- **Acceptance Criteria:**
  - Open search → body scroll bị khoá.
  - Tab quanh modal vòng trong modal.
  - Escape close → focus về search icon trigger.

---

### [H-07] P2 — Video modal thiếu focus trap, return focus, không có fallback fail-safe rõ ràng

- **Severity:** P2
- **Status:** Confirmed
- **Evidence:**
  - [bigbike-web/components/home/HomeVideoCarousel.tsx:50-56](bigbike-web/components/home/HomeVideoCarousel.tsx#L50-L56)
    ```tsx
    <div className="wp-video-modal-backdrop" onClick={onClose}
         role="dialog" aria-modal="true" aria-label={...}>
    ```
    `aria-modal` ✅ OK.
  - [bigbike-web/components/home/HomeVideoCarousel.tsx:28-32](bigbike-web/components/home/HomeVideoCarousel.tsx#L28-L32) — Escape close ✅ OK.
  - [bigbike-web/components/home/HomeVideoCarousel.tsx:35-39](bigbike-web/components/home/HomeVideoCarousel.tsx#L35-L39) — body overflow lock ✅ OK.
  - **Thiếu** focus trap, **thiếu** return focus về thumbnail button.
  - Embed URL được build từ backend `video.embedUrl`. `isSafeHomeVideoUrl` được dùng làm filter ([page.tsx:117](bigbike-web/app/page.tsx#L117) và [HomeVideoCarousel.tsx:70](bigbike-web/components/home/HomeVideoCarousel.tsx#L70)) nhưng **không** được áp dụng cho `video.embedUrl` trước khi đặt vào `<iframe src>`. Phụ thuộc 100% vào backend.
- **Impact:**
  - A11y: keyboard user mở video sẽ Tab loanh quanh và không quay về được vị trí cũ.
  - Security: nếu admin nhập `embedUrl` vô tình trỏ đến origin lạ → embed iframe không kiểm tra. Backend nên có whitelist nhưng nếu không, frontend hiện tại tin tưởng tuyệt đối.
  - CSP `frame-src` ([next.config.ts:374](bigbike-web/next.config.ts#L374)) đã giới hạn `youtube.com`, `youtube-nocookie.com`, `google.com`, `maps.google.com` → CSP sẽ chặn iframe khác origin → mitigated nhưng vẫn nên defense-in-depth.
- **Recommendation:**
  - Thêm focus trap + return focus.
  - Validate `video.embedUrl` ở client trước khi đặt vào `<iframe src>` — chỉ cho phép `youtube.com/embed/`, `youtube-nocookie.com/embed/`.
  - Trigger button của video card cần được store trong ref và `.focus()` lại khi modal đóng.
- **Acceptance Criteria:**
  - Tab vòng trong modal video.
  - Đóng modal → focus về VideoCard button đã trigger.
  - URL không match whitelist → fallback "BIGBIKE" placeholder.

---

### [H-08] P2 — `toHeroSlide` bỏ qua slide chỉ có mobile image (admin/CMS UX trap)

- **Severity:** P2
- **Status:** Confirmed
- **Evidence:**
  - [bigbike-web/app/page.tsx:96-110](bigbike-web/app/page.tsx#L96-L110)
    ```tsx
    function toHeroSlide(slider: HomeSlider) {
      const desktopSrc = resolveMediaUrl(slider.desktopImage?.url?.trim());
      if (!desktopSrc) return null;  // ← bỏ qua nếu chỉ có mobile image
      const mobileSrc = resolveMediaUrl(slider.mobileImage?.url?.trim()) || desktopSrc;
      ...
    }
    ```
- **Impact:**
  - Admin trong dashboard upload **chỉ mobile image** → slide biến mất hoàn toàn ở homepage. Không có warning, không có log, không có error toast.
  - Confusing cho content team: "Tôi đã upload sao không thấy?".
  - Không đồng bộ với fallback "use desktop nếu mobile thiếu" (logic ngược không có).
- **Recommendation:**
  - Cho phép slide với chỉ mobile image: dùng mobile cho cả desktop nếu desktop thiếu (chấp nhận crop ngang).
  - Hoặc admin UI: enforce `desktopImage` required với validation rõ.
- **Acceptance Criteria:**
  - Slide với chỉ `mobileImage` vẫn render.
  - Hoặc: docs admin nói rõ desktop image là bắt buộc và admin form block save khi thiếu.

---

### [H-09] P2 — Hero dùng raw `<img>` thay vì `next/image`; CLS risk Needs Runtime Verification

- **Severity:** P2
- **Status:** Confirmed (code) + Needs Runtime Verification (CLS measurement)
- **Evidence:**
  - [bigbike-web/components/home/HeroSlider.tsx:84-96](bigbike-web/components/home/HeroSlider.tsx#L84-L96)
    ```tsx
    <picture className="wp-slide-picture">
      {slide.mobileSrc && (
        <source media="(max-width: 768px)" srcSet={slide.mobileSrc} />
      )}
      <img
        src={slide.desktopSrc}
        alt={slide.alt}
        className="wp-slide-img"
        loading={i === 0 ? "eager" : "lazy"}
        fetchPriority={i === 0 ? "high" : "auto"}
        decoding="async"
      />
    </picture>
    ```
  - `.wp-slide` aspect-ratio: `16 / 5.5` desktop, `4 / 5` ≤600px ([globals.css:2474, 5388](bigbike-web/app/globals.css#L2474)) → container reserve space — CLS-mitigated nhờ aspect-ratio.
  - Không có `width`/`height` attribute trên `<img>` — relying on `object-fit: cover` + container aspect-ratio.
  - Mobile/desktop swap qua `<source media>` đúng pattern responsive.
- **Impact:**
  - **Pros:** không bị Next.js image optimization overhead trên hero (FCP friendly), `<picture>` chuẩn responsive, eager + fetchPriority high cho LCP.
  - **Cons:** không tận dụng AVIF/WebP optimization của Next.js, không có `sizes` để pick chính xác breakpoint.
  - **CLS:** aspect-ratio đã reserve không gian → có khả năng OK, nhưng cần Lighthouse/CrUX để xác nhận thực tế.
- **Recommendation:**
  - **Option A (giữ raw `<img>`):** thêm `width`/`height` attribute để browser native CLS protection trở mạnh hơn ngay cả khi CSS bị strip.
  - **Option B (chuyển `next/image`):** dùng `<Image fill priority sizes="100vw">` cho slide đầu, các slide sau `loading="lazy"`. Phải accept Next.js image transformation overhead nhưng được AVIF.
  - Verify CLS bằng Lighthouse/PageSpeed trước khi quyết.
- **Acceptance Criteria:**
  - Hero LCP < 2.5s ở mobile 4G.
  - Hero CLS < 0.1 ở mobile + desktop.
  - **Needs runtime verification.**

---

### [H-10] P2 — `ExperienceCarousel` hardcode legacy WP media + 11 copies cho infinite-loop fake

- **Severity:** P2
- **Status:** Confirmed
- **Evidence:**
  - [bigbike-web/components/home/ExperienceCarousel.tsx:12-38](bigbike-web/components/home/ExperienceCarousel.tsx#L12-L38)
    ```tsx
    const SLIDE_COPY_COUNT = 11;
    const LEGACY_EXPERIENCE_MEDIA: Record<LegacyExperienceKey, ...> = {
      ls2:    { ..., coverImage: "/wp-content/uploads/2020/06/LS2-FF352_background.jpg", ... },
      scoyco: { ..., coverImage: "/wp-content/uploads/2020/06/scoyco-jk37_background.jpg", ... },
      agv:    { ..., coverImage: "/wp-content/uploads/2020/06/avg_background.jpg", ... },
    };
    ```
  - [bigbike-web/components/home/ExperienceCarousel.tsx:104-110](bigbike-web/components/home/ExperienceCarousel.tsx#L104-L110)
    ```tsx
    const slides = useMemo(
      () =>
        n > 0
          ? Array.from({ length: SLIDE_COPY_COUNT }, () => orderedArticles).flat()
          : orderedArticles,
      ...
    );
    ```
- **Impact:**
  - **Maintainability:** UI component contains business content (image paths, titles theo brand). Sửa cover image của bài "AGV" phải đụng code, không qua admin.
  - **DOM size:** 3 articles × 11 copies = 33 DOM nodes / 33 `next/image` cho carousel. Trên mobile có thể 1-2MB extra image weight nếu chưa lazy.
  - **A11y:** screen reader đọc 11 copies same article → confusing. Slides ngoài center phải có `aria-hidden`. Hiện tại code không set `aria-hidden` cho copies inactive.
  - **Sort/slug coupling:** logic `getLegacyExperienceKey` match string `scoyco`, `ls2-ff352`, `agv` — nếu admin đổi slug sẽ break ordering.
- **Recommendation:**
  - Move `LEGACY_EXPERIENCE_MEDIA` ra CMS settings (per-article cover override).
  - Reduce `SLIDE_COPY_COUNT`: nếu có 3 article thì 5 copies là đủ cho center logic. Hoặc dùng `loop: true` của Embla thay vì copy thủ công.
  - Set `aria-hidden="true"` + `tabIndex={-1}` cho slides inactive.
- **Acceptance Criteria:**
  - 0 hardcoded `/wp-content/uploads/...` trong source code (or migrated to settings).
  - DOM size carousel ≤ 2× number of articles.
  - axe-core: 0 violations về repeated content.

---

### [H-11] P2 — `FeaturedProductsCarousel` + `BrandCarousel` không disable prev/next ở edges, ARIA carousel chưa hoàn chỉnh

- **Severity:** P2
- **Status:** Confirmed
- **Evidence:**
  - [bigbike-web/components/home/FeaturedProductsCarousel.tsx:23-47](bigbike-web/components/home/FeaturedProductsCarousel.tsx#L23-L47)
    ```tsx
    <button className="wp-car-btn wp-car-prev" onClick={scrollPrev} aria-label="Cuộn trái">‹</button>
    ...
    <button className="wp-car-btn wp-car-next" onClick={scrollNext} aria-label="Cuộn phải">›</button>
    ```
    Không track `canScrollPrev/canScrollNext` từ Embla → button luôn enabled.
  - [bigbike-web/components/home/BrandCarousel.tsx:25-63](bigbike-web/components/home/BrandCarousel.tsx#L25-L63) — same pattern, `loop: true` nên không cần disable nhưng vẫn ok.
  - HomeVideoCarousel **đã** đúng pattern: `disabled={selectedIndex === 0}` và `disabled={isLastSnap}` ([HomeVideoCarousel.tsx:181-192](bigbike-web/components/home/HomeVideoCarousel.tsx#L181-L192)).
  - Carousels không có wrap `role="region" aria-roledescription="carousel"`. Slides không có `role="group" aria-roledescription="slide"`.
- **Impact:**
  - Click prev tại slide đầu / next tại slide cuối → no-op nhưng UI không cho biết.
  - Screen reader không hiểu đây là carousel (`role` chuẩn W3C).
- **Recommendation:**
  - FeaturedProductsCarousel: track `selectedIndex` + `scrollSnaps` như HomeVideoCarousel để disable button at edges.
  - Add `role="region"` + `aria-roledescription="carousel"` + `aria-label` ở wrap.
  - Slides: `role="group" aria-roledescription="slide" aria-label="Slide N of M"`.
- **Acceptance Criteria:**
  - Button disabled correctly at edges (non-loop carousels).
  - axe-core no carousel-specific violations.

---

### [H-12] P1 — Homepage gọi 9 API parallel, public-api silent-fails với empty arrays

- **Severity:** P1
- **Status:** Confirmed
- **Evidence:**
  - [bigbike-web/app/page.tsx:261-281](bigbike-web/app/page.tsx#L261-L281) — 9 calls trong `Promise.all`:
    1. `listHomeSliders()`
    2. `listCategories({ size: 100, ... })`
    3. `listArticles({ category: "trai-nghiem", ... })`
    4. `listArticles({ category: "blog", ... })`
    5. `listBrands({ size: 12, ... })`
    6. `listPublicSettings()`
    7. `listProducts({ filterFeatured: true, size: 12, ... })`
    8. `listProducts({ size: 5, ... })`
    9. `listHomeVideos()`
  - [bigbike-web/lib/api/public-api.ts:142-156](bigbike-web/lib/api/public-api.ts#L142-L156) — `loadList` catch error trả `{ data: [], error }`.
  - [bigbike-web/lib/api/public-api.ts:159-176](bigbike-web/lib/api/public-api.ts#L159-L176) — `loadData` cũng catch trả `{ data: null, error }`.
  - HomePage không check `result.error` ở bất kỳ chỗ nào, chỉ dùng `result.data ?? []`.
- **Impact:**
  - **Silent-fail:** Backend xuống → khách thấy homepage "thiếu một số block" (không có slider, không có sản phẩm) nhưng không có error message → khách nghĩ shop nghèo nội dung.
  - **Monitoring blind:** Sentry chỉ catch unhandled exception. `loadList` đã swallow error → không có signal cho ops biết backend đang fail.
  - **Cache poisoning risk thấp:** ISR cache 3600s → nếu mọt fetch fail và Next cache empty, 1 giờ tới mọi user thấy empty.
- **Recommendation:**
  - Trong `loadList`/`loadData` catch block: `Sentry.captureException(error)` + `console.error` (đã có Sentry config trong `next.config.ts`).
  - HomePage có thể track aggregate failure: nếu ≥ 5/9 calls fail → render error banner top.
  - Health check endpoint riêng để monitoring dashboard kiểm tra.
- **Acceptance Criteria:**
  - Backend xuống → Sentry alert trigger trong 5 phút.
  - Homepage error rate visible trên Sentry/Datadog.

---

### [H-13] P2 — `listPublicSettings()` được gọi 5 lần trong cùng 1 request render

- **Severity:** P2
- **Status:** Confirmed (deduplication in Next.js fetch cache Needs Runtime Verification)
- **Evidence:**
  - Calls:
    1. `app/page.tsx::generateMetadata` — [page.tsx:73](bigbike-web/app/page.tsx#L73)
    2. `app/page.tsx::HomePage` — [page.tsx:277](bigbike-web/app/page.tsx#L277)
    3. `components/layout/SiteHeader.tsx` — [SiteHeader.tsx:77](bigbike-web/components/layout/SiteHeader.tsx#L77)
    4. `components/layout/SiteFooter.tsx` — [SiteFooter.tsx:130](bigbike-web/components/layout/SiteFooter.tsx#L130)
    5. `components/layout/FloatingChatLoader.tsx` — [FloatingChatLoader.tsx:18](bigbike-web/components/layout/FloatingChatLoader.tsx#L18)
  - Underlying: `fetch("/api/v1/settings/public", { next: { revalidate: 3600, tags: ["settings"] }})` — Next.js 16 `fetch` cache deduplicates cùng URL trong 1 render cycle theo docs, nhưng behaviour với `next: { revalidate, tags }` cần verify khi `cache` config thay đổi.
- **Impact:**
  - Best case (cache dedupe works): 1 fetch / request — OK.
  - Worst case: 5 fetch / homepage request → backend pressure × 5, latency.
  - Mỗi component re-implement key lookup (`hotline`, `phone`, `support_phone`, ...) → drift risk: cùng setting key hiểu khác nhau.
- **Recommendation:**
  - Tạo `lib/server/site-config.ts` với `getPublicSiteConfig()` cached via `cache()` từ React → guarantee 1 fetch / render.
  - Có schema mapped: `{ siteName, hotline, zaloUrl, ..., bctUrl, ... }` được resolve tập trung.
  - Header, Footer, FloatingChatLoader, page.tsx import schema thay vì raw settings array.
- **Acceptance Criteria:**
  - 1 GET `/api/v1/settings/public` per homepage render trong dev tab Network.
  - Verify trong test: spy fetch và assert 1 call.
  - **Needs runtime verification** for current code (test cache behavior).

---

### [H-14] P2 — Homepage rất nhiều client component (~6+) trên trang chủ

- **Severity:** P2
- **Status:** Confirmed
- **Evidence:**
  - Client components active trên homepage:
    1. `HeroSlider` — Embla
    2. `FeaturedProductsCarousel` — Embla
    3. `ExperienceCarousel` — Embla, complex re-center logic
    4. `HomeVideoCarousel` — Embla + Video modal
    5. `BrandCarousel` — Embla
    6. `MobileHeaderMenu` — drawer
    7. `SearchToggle` — modal
    8. `StickyHeaderShell` — scroll listener
    9. `HeaderUserMenu`, `HeaderNavItem` (Tippy) — interactive
    10. `FloatingChat` (qua `FloatingChatLoader`)
    11. `ProductCardAddBar` (× n products)
    12. `BctBadge` (`use client` chỉ vì onError)
    13. `HomeAnalytics`
- **Impact:**
  - JS bundle nặng — Embla carousel x4 instances + Tippy + Sentry SDK + cart-context + auth-store + react-query.
  - TTI (Time to Interactive) chậm trên mid-tier mobile.
  - Cần Lighthouse runtime để biết bundle size thật.
- **Recommendation:**
  - `BctBadge` không cần `"use client"` — `onError` có thể replace bằng srcSet fallback hoặc Next/Image.
  - `HomeAnalytics` chỉ chạy 1 lần — có thể inline trong layout đơn giản hơn.
  - Lazy load: `ExperienceCarousel`, `BrandCarousel`, `HomeVideoCarousel` với `next/dynamic({ loading: skeleton })` để trì hoãn JS cho phần dưới fold.
- **Acceptance Criteria:**
  - Lighthouse mobile TTI < 5s.
  - JS bundle homepage initial < 250KB gzipped.
  - **Needs runtime verification.**

---

### [H-15] P3 — Footer còn `Đang cập nhật thông tin liên hệ` khi tất cả contact rỗng

- **Severity:** P3
- **Status:** Confirmed
- **Evidence:**
  - [bigbike-web/components/layout/SiteFooter.tsx:266-268](bigbike-web/components/layout/SiteFooter.tsx#L266-L268)
    ```tsx
    {!hotline && !email && !address ? (
      <p className="bb-footer-muted">Đang cập nhật thông tin liên hệ.</p>
    ) : null}
    ```
  - Menu/guide cột đã có fallback links — cải thiện so với audit cũ.
- **Impact:**
  - Trong production, nếu admin chưa seed `hotline`, `email`, `address` → footer hiển thị "Đang cập nhật thông tin liên hệ." → trust hit.
  - Different from header behaviour (header hardcode fallback giả) — inconsistency.
- **Recommendation:**
  - **Best:** ẩn hoàn toàn cột "Thông tin" nếu rỗng, hoặc render hardcode contact verify thật (một lần) thay vì fallback message.
  - **Min:** thay text bằng link tới page `/lien-he/` để khách click sang trang liên hệ thay vì thấy placeholder.
- **Acceptance Criteria:**
  - Trong môi trường settings rỗng: footer không có chuỗi "Đang cập nhật".
  - Có ít nhất 1 cách để khách liên lạc (link, page, etc.).

---

### [H-16] P3 — `revalidate = 3600` toàn bộ + `staleTimes` short → balance OK nhưng homepage có CSR analytics block

- **Severity:** P3
- **Status:** Confirmed
- **Evidence:**
  - [bigbike-web/app/page.tsx:45](bigbike-web/app/page.tsx#L45) `export const revalidate = 3600;`
  - [bigbike-web/next.config.ts:160-165](bigbike-web/next.config.ts#L160-L165) staleTimes static 180s, dynamic 30s.
  - [bigbike-web/components/home/HomeAnalytics.tsx:5-10](bigbike-web/components/home/HomeAnalytics.tsx#L5-L10) — only `pushDataLayer("page_view", { page_type: "home" })`.
- **Impact:**
  - Settings ISR 3600s → admin update setting mất tới 1h hiệu lực. WebRevalidationService trong backend (đang ở git status modified) có thể đẩy nhanh.
  - HomeAnalytics renders "use client" chỉ để gọi GTM dataLayer — minimal overhead.
- **Recommendation:**
  - OK. Verify `WebRevalidationService` có gọi `revalidateTag("settings")` khi admin update — nếu có, OK.
- **Acceptance Criteria:**
  - Admin sửa setting → footer reflect trong 30s (không phải 60min).
  - **Needs runtime verification** with backend.

---

### [H-17] P3 — Sticky header attribute scroll listener trên `documentElement` không cleanup thật

- **Severity:** P3
- **Status:** Confirmed minor
- **Evidence:**
  - [bigbike-web/components/layout/StickyHeaderShell.tsx:8-22](bigbike-web/components/layout/StickyHeaderShell.tsx#L8-L22) — `useEffect` add scroll listener và remove on unmount. Cleanup correct.
  - Sticky header ([globals.css:1488-1497](bigbike-web/app/globals.css#L1488-L1497)) `position: fixed` + `transition: box-shadow ...` + scroll attribute on `<html>` ([globals.css:1795-1815](bigbike-web/app/globals.css#L1795-L1815)) → header height shrinks 4.5rem → 3.75rem trên scroll.
  - `--bb-header-stack` recompute → `bb-main` padding-top transitions in lockstep — clean.
- **Impact:** OK. Nice pattern.
- **Recommendation:** —
- **Acceptance Criteria:** —

---

### [H-18] P2 — SEO `metadataBase` hardcode `https://bigbike.vn`, không dùng `NEXT_PUBLIC_SITE_URL`

- **Severity:** P2
- **Status:** Confirmed
- **Evidence:**
  - [bigbike-web/app/layout.tsx:45](bigbike-web/app/layout.tsx#L45)
    ```tsx
    metadataBase: new URL("https://bigbike.vn"),
    ```
  - Không reference `process.env.NEXT_PUBLIC_SITE_URL` ở đây.
- **Impact:**
  - Staging environment vẫn có canonical URL = `https://bigbike.vn` → Google index staging về production URL → confusing.
  - Hardcode mạnh, không dễ đổi env.
  - **Note:** previous audit `BIGBIKE_WEB_AUDIT_OPUS.md` flag sitemap dump localhost — vấn đề khác nhưng cùng nguyên nhân (env không được dùng nhất quán).
- **Recommendation:**
  - `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://bigbike.vn")`.
  - Verify sitemap, JSON-LD, OG image build dùng cùng env.
- **Acceptance Criteria:**
  - Build với `NEXT_PUBLIC_SITE_URL=https://staging.bigbike.vn` → canonical = staging URL.
  - Production build → canonical = `https://bigbike.vn`.

---

### [H-19] P3 — `<h1>` ẩn `bb-sr-only` cho SEO H1 + `<h2>` "About" mặc định khi settings thiếu

- **Severity:** P3
- **Status:** Confirmed (intentional, OK)
- **Evidence:**
  - [bigbike-web/app/page.tsx:334](bigbike-web/app/page.tsx#L334) `<h1 className="bb-sr-only">{homeH1}</h1>`
  - [bigbike-web/app/page.tsx:357-399](bigbike-web/app/page.tsx#L357-L399) — `hasSettingsAbout` fallback có hardcode H2/copy về BigBike "Garage đồ chơi cao cấp..." → vẫn có content khi backend rỗng.
- **Impact:**
  - H1 ẩn nhưng có text → Google index OK. Chú ý: ẩn bằng `bb-sr-only` (visually hidden) không phải `display: none` → semantic OK.
- **Recommendation:**
  - OK. Verify `bb-sr-only` đúng pattern visually-hidden (clip-path / position absolute width 1px) — cần check CSS class.

---

### [H-20] P2 — Home video iframe `allow="autoplay"` + autoPlay trong fallback `<video>` → có thể trigger autoplay block

- **Severity:** P2
- **Status:** Confirmed minor UX
- **Evidence:**
  - [bigbike-web/components/home/HomeVideoCarousel.tsx:67](bigbike-web/components/home/HomeVideoCarousel.tsx#L67)
    ```tsx
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    ```
  - [bigbike-web/components/home/HomeVideoCarousel.tsx:72-79](bigbike-web/components/home/HomeVideoCarousel.tsx#L72-L79) — fallback `<video autoPlay muted playsInline>`.
- **Impact:**
  - Modern browsers: muted autoplay ok, unmuted blocked. Hiện code có muted → OK.
  - Khách phải un-mute bằng tay → có thể frustrating cho tutorial videos.
- **Recommendation:** OK as-is. Optional add control to unmute.

---

## 4. Findings From Previous Audit That Are Already Fixed

> Source: `BIGBIKE_WEB_AUDIT_OPUS.md` (2026-05-08, audit Opus trước). Verify lại với code hiện tại.

| Old finding | Status hiện tại | Evidence |
|---|---|---|
| **[FN-01] ProductCardAddBar không hỏi variant, add ngay vào cart** | **Already Fixed** | [ProductCardAddBar.tsx:23-26](bigbike-web/components/catalog/ProductCardAddBar.tsx#L23-L26) — nếu `hasVariants` thì `router.push(toProductPath(slug))`. Button label động `CHỌN BIẾN THỂ` vs `THÊM VÀO GIỎ HÀNG` ([line 43](bigbike-web/components/catalog/ProductCardAddBar.tsx#L43)). Has error catch + toast. ✅ |
| **[TRUST-01] Footer "Đang cập nhật" 3/5 cột** | **Partially Fixed** | Cột Menu + Hướng dẫn đã có `FALLBACK_FOOTER_LINKS`/`FALLBACK_GUIDE_LINKS` ([SiteFooter.tsx:13-25](bigbike-web/components/layout/SiteFooter.tsx#L13-L25), 153-154). Cột Thông tin **vẫn còn** "Đang cập nhật thông tin liên hệ." ở [SiteFooter.tsx:267](bigbike-web/components/layout/SiteFooter.tsx#L267) — see [H-15]. |
| **[TRUST-02] Header navigation rỗng nếu menu chưa seed** | **NOT Fixed** | [SiteHeader.tsx:96](bigbike-web/components/layout/SiteHeader.tsx#L96) `resolvedMenuTree = menuResult.data ? buildMenuTree(menuResult.data.items) : []` — vẫn render nav rỗng. Có `console.warn` ([line 91](bigbike-web/components/layout/SiteHeader.tsx#L91)) nhưng không có fallback menu cho user. Nếu primary menu chưa seed → khách không có navigation. **P0 vẫn còn.** |
| (mới) **Hotline giả `0903 123 456`** ở header & mobile | **NOT Fixed** | Xem [H-01]. |
| (mới) **BCT badge link giả** | **NOT Fixed** | Xem [H-02]. |
| (mới) **Mobile add-to-cart hover-only** | **NOT Fixed** | Xem [H-04]. |

---

## 5. Responsive Risk Matrix

> Tất cả các ô đánh dấu **NRV** (Needs Runtime Verification) chưa được test thật bằng browser/Playwright. Các ô khác là kết luận từ đọc CSS + media queries.

| Viewport | Header | Hero | Carousel | Category Grid | Footer | Floating Chat | Overflow Risk | Notes |
|---|---|---|---|---|---|---|---|---|
| **360 × 800** (low-end Android) | `wp-nav` ẩn ([globals.css:3392-3394](bigbike-web/app/globals.css#L3392-L3394)). Header height 4rem ([brand-tokens.css:707](bigbike-web/styles/brand-tokens.css#L707)). Promo strip 30px. Hamburger button shown. **Touch ≥44px** ([globals.css:5391-5419](bigbike-web/app/globals.css#L5391-L5419)). | aspect-ratio 4/5 ([globals.css:5388](bigbike-web/app/globals.css#L5388)) → tall hero, mobileSrc selected via `<source>`. Logos `priority`. | Featured grid 1 column ([globals.css:4089-4091](bigbike-web/app/globals.css#L4089-L4091)). Product carousel item flex 0 0 160px → 2 cards visible — narrow. | 2 columns ([globals.css:4107-4110](bigbike-web/app/globals.css#L4107-L4110)). Aspect 3/2 OK. | Inner stack 1 col → 2 col @640 → 3 col @1024 ([globals.css:51-72](bigbike-web/app/globals.css#L51-L72)). Bottom row `flex-wrap` ([globals.css:179-184](bigbike-web/app/globals.css#L179-L184)). | Bottom-right, safe-area aware ([globals.css:5422-5437](bigbike-web/app/globals.css#L5422-L5437)). Label hidden @≤480px. | **NRV** — promo strip last span ẩn @≤768 OK, nhưng kicker text "BIGBIKE SINCE 2013 garage gear..." có thể overflow. `wp-tile-3-cta`/`wp-cat-img-label` `letter-spacing: .06em` có thể cause overflow trên text Việt dài. | Highest risk: ExperienceCarousel slide width % vs viewport. Search modal `max-height: calc(100dvh - var(--bb-header-stack))` ([globals.css:4887, 5611](bigbike-web/app/globals.css#L4887)) OK. |
| **375 × 812** (iPhone X/SE 3rd) | Same as 360 | Same | Same. Featured grid 1 col vẫn áp dụng (≤600px breakpoint). | Same | Same | Same | NRV | iOS safe-area `env(safe-area-inset-bottom)` cho FloatingChat. ✅ |
| **430 × 932** (iPhone 14 Pro Max) | Promo strip 30px, header 4rem (≤600 cap @600px breakpoint? — actually `--bb-header-height: 4rem` only @≤600. 430 < 600 → applies). | Same `aspect-ratio: 4/5` (≤600). | Featured 1 col (≤600). Carousel 160px items. | 2 cols. | Same | Same | NRV | iPhone Pro Max safe area large — should test pinned floating chat clears home indicator. |
| **768 × 1024** (iPad portrait) | `wp-nav` shown? — `display: none` đến `max-width: 600px` only? Looking again: `[globals.css:3392-3394]` is in `@media (max-width: 600px)` block. Need verify nav breakpoint. **NRV**. | aspect 16/8 @≤768 ([globals.css:3396-3398](bigbike-web/app/globals.css#L3396-L3398)). | Featured 2 cols (`max-width: 900px`). Carousel item 220px. | 2 cols (`max-width: 900px`). | 2 col grid. | Same. | NRV | iPad: hamburger menu hidden? Need check. |
| **1024 × 768** (iPad landscape / small laptop) | Nav shown. Promo strip 34px. Header 4.5rem. | aspect 16/5.5. | Featured 3 cols. Carousel item 20% min 180px (5 visible). | 4 cols default. | 3 col grid `@1024`. | Bottom right. | NRV | Mega-menu Tippy strategy `fixed` width 100vw ([HeaderNavItem.tsx:43-80](bigbike-web/components/layout/HeaderNavItem.tsx#L43-L80)) — may need horizontal padding match container. |
| **1440 × 900** (desktop) | All visible. Logo emblem visible (≥768px) per CSS comment ([SiteHeader.tsx:109-110](bigbike-web/components/layout/SiteHeader.tsx#L109-L110)). Nav full. | aspect 16/5.5 = ~440px tall. | Featured 3 cols. | 4 cols. | 5 col grid `@1280`. | Bottom right. | Low | Container `min(100% - 64px, 1440px)`. |
| **1920 × 1080** (FHD) | Same | Same | Same | Same | Same | Same | Low | Container max 1440 → ~240px gutter each side. ✅ |

### Specific overflow concerns to verify in browser

1. **Hero slider** at 360px width: `<picture>` swaps to `mobileSrc`. If admin uploads only desktop image (high-res landscape), image is `object-fit: cover` in `aspect-ratio: 4/5` container → may crop badly. **NRV**.
2. **`wp-cat-img-label`** text "Mũ bảo hiểm full-face" (long) at 360px width — potential overflow inside small cell. **NRV**.
3. **`wp-mobile-drawer`** width `min(23rem, 100vw)` ([globals.css:2078](bigbike-web/app/globals.css#L2078)) → at 320px viewport drawer = 320px (matches), but `wp-mobile-drawer-contact` flex layout may overflow with long URLs. **NRV**.
4. **`wp-search-shell`** `max-height: calc(100dvh - var(--bb-header-stack))` — with iOS soft keyboard, `100dvh` shrinks correctly. ✅ in theory.
5. **Floating chat** with `wp-chat-popup min-width: 260px` — ensure doesn't push into right safe-area at 320px viewport.
6. **Footer bottom row** `flex-wrap: wrap` — at 360px with all 3 children (logo + copy + bct badge) wraps to 3 lines. ✅.

---

## 6. Recommended Fix Order

### A. Must fix before launch (P0)

1. **[H-01]** Remove fallback hotline `0903 123 456` from header + mobile drawer — render conditionally or use real verified hotline.
2. **[H-02]** BCT badge: only render when `bct_url` is a verified `online.gov.vn/.../WebsiteDetails?websiteId=...` URL. Hide badge entirely if not registered.
3. **[H-03]** Replace hardcoded `Mã ĐKKD: 41K8017383` and license date/authority with settings keys + verify the correct legal info before launch.
4. **[H-04]** Fix mobile add-to-cart: add `@media (hover: none), (pointer: coarse) { .wp-product-addbar { transform: translateY(0); } }`.
5. **[TRUST-02 unfixed]** Add static fallback header navigation when `getPublicMenu("primary")` returns empty (or seed menu in admin before launch).

### B. Should fix before launch (P1)

6. **[H-05]** Mobile drawer: add `role="dialog" aria-modal="true"` + focus trap + return focus.
7. **[H-06]** Search modal: add `aria-modal="true"`, body scroll lock, focus trap, return focus.
8. **[H-12]** Wire Sentry into `loadList`/`loadData` catch blocks for backend visibility. Add health check endpoint.
9. **[H-13]** Consolidate `listPublicSettings()` into a single `getPublicSiteConfig()` cached helper — reduce duplicated key lookups.
10. **[H-15]** Remove "Đang cập nhật thông tin liên hệ" placeholder in footer; either render real contact or hide column.
11. **[H-18]** `metadataBase` from `process.env.NEXT_PUBLIC_SITE_URL` so staging/preview don't pollute SEO.

### C. Can fix after launch (P2/P3)

12. **[H-07]** Video modal: focus trap + return focus + client-side embedUrl whitelist.
13. **[H-08]** Allow hero slides with only mobile image (or enforce in admin UI).
14. **[H-09]** Decide raw `<img>` vs `next/image` for hero based on Lighthouse runtime.
15. **[H-10]** Move ExperienceCarousel legacy media to settings + reduce SLIDE_COPY_COUNT + add `aria-hidden` to inactive copies.
16. **[H-11]** Disable carousel prev/next at edges; add `role="region" aria-roledescription="carousel"` to all carousels.
17. **[H-14]** Lazy-load below-the-fold carousels via `next/dynamic`. Demote `BctBadge` and `HomeAnalytics` from client-only.
18. **[H-16]** Verify `WebRevalidationService` calls `revalidateTag("settings")` so admin updates propagate fast.
19. **[H-19/20]** OK as-is. Optional polish.

---

## 7. Final Verdict

### Beta ready?

**Yes** — code structure, ISR, JSON-LD, CSP, and major flows are professional. Khách beta tester có thể vào trải nghiệm.

### Production ready?

**No.** 4 trust/legal risks (hotline giả, BCT badge giả, mã ĐKKD chưa verify, mobile add-to-cart không hoạt động) plus header empty-menu fallback chưa fix là blocker thật cho public launch. Risk pháp lý của BCT + ĐKKD đặc biệt cần xử lý trước khi mở traffic.

### Production gate conditions

Để pass gate production, **must complete tất cả Group A** plus runtime verification (Group B chưa cần block nhưng nên trước 30 ngày sau launch):

- [ ] `[H-01]` Hotline fallback removed/replaced with verified number.
- [ ] `[H-02]` BCT badge gated by valid `online.gov.vn` URL.
- [ ] `[H-03]` Legal info (ĐKKD) moved to settings + verified by owner.
- [ ] `[H-04]` Mobile add-to-cart visible on touch.
- [ ] `[TRUST-02]` Header has fallback nav OR primary menu seeded in admin.
- [ ] **Runtime verification**:
  - [ ] Lighthouse mobile: LCP < 2.5s, CLS < 0.1.
  - [ ] axe-core or pa11y on homepage: 0 critical violations.
  - [ ] `document.documentElement.scrollWidth === window.innerWidth` ở mọi viewport 360→1920.
  - [ ] Backend down → Sentry alert triggered.
  - [ ] Settings deduplicate to 1 fetch per render.
  - [ ] Admin update setting → visible in <60s on prod homepage.

**Khi tất cả checked → production gate PASS.** Hiện tại: 0/11 conditions explicitly verified — gate **OPEN** chờ fix.
