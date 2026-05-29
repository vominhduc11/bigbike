export const meta = {
  name: "bigbike-web-visual-review",
  description: "Per-route visual + source review of bigbike-web responsive screenshots, adversarially verified",
  phases: [
    { title: "Review", detail: "one agent per route: inspect 4 screenshots + read source, report defects" },
    { title: "Verify", detail: "adversarially verify each medium+ finding is a real defect vs intended design" },
  ],
};

const SHOTS = "C:/Users/ADMIN/OneDrive/Documents/bigbike/bigbike-web/e2e/_audit/out/shots";
const VPS = ["390x844", "768x1024", "1280x900", "1920x1080"];

// route key (screenshot slug) -> { label, sources[] }
const ROUTES = [
  { slug: "root", label: "/ (home)", sources: ["app/page.tsx", "components/home/HeroSlider.tsx", "components/home/ExperienceCarousel.tsx", "components/home/HomeVideoCarousel.tsx", "components/home/MobileCategoryGrid.tsx"] },
  { slug: "san_pham", label: "/san-pham (product listing)", sources: ["app/san-pham/page.tsx", "components/catalog/ProductArchiveLayout.tsx", "components/catalog/CatalogFilters.tsx", "components/catalog/ProductCard.tsx"] },
  { slug: "danh_muc_san_pham", label: "/danh-muc-san-pham (categories)", sources: ["app/danh-muc-san-pham/page.tsx"] },
  { slug: "tin_tuc", label: "/tin-tuc (news list)", sources: ["app/tin-tuc/page.tsx"] },
  { slug: "dang_nhap", label: "/dang-nhap (login)", sources: ["app/dang-nhap/page.tsx"] },
  { slug: "gio_hang", label: "/gio-hang (cart, likely empty)", sources: ["app/gio-hang/page.tsx", "app/gio-hang/layout.tsx"] },
  { slug: "thanh_toan", label: "/thanh-toan (checkout, likely empty)", sources: ["app/thanh-toan/page.tsx"] },
  { slug: "gioi_thieu", label: "/gioi-thieu (about)", sources: ["app/gioi-thieu/page.tsx"] },
  { slug: "lien_he", label: "/lien-he (contact)", sources: ["app/lien-he/page.tsx"] },
  { slug: "brands", label: "/brands", sources: ["app/brands/page.tsx"] },
  { slug: "so_sanh", label: "/so-sanh (compare, likely empty)", sources: ["app/so-sanh/page.tsx"] },
  { slug: "product_tui_chong_nuoc_ilm_bl01", label: "/product/[slug] (PDP)", sources: ["app/product/[slug]/page.tsx", "components/catalog/ProductGallery.tsx"] },
];

const FINDINGS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["route", "clean", "findings"],
  properties: {
    route: { type: "string" },
    clean: { type: "boolean", description: "true if no real defects found" },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["viewport", "severity", "category", "title", "evidence", "rootCause", "suggestedFix", "confidence"],
        properties: {
          viewport: { type: "string", description: "e.g. 390x844, or 'all'" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          category: { type: "string", enum: ["spacing", "layout", "responsive", "typography", "image", "ui-sizing", "alignment", "other"] },
          title: { type: "string" },
          evidence: { type: "string", description: "what is visibly wrong in the screenshot AND/OR the source line proving it" },
          rootCause: { type: "string", description: "file + selector/class + why" },
          suggestedFix: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
  },
};

const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "isRealDefect", "reason"],
        properties: {
          title: { type: "string" },
          isRealDefect: { type: "boolean" },
          reason: { type: "string", description: "why it is a real defect, or why it is intended design / screenshot artifact / false positive" },
        },
      },
    },
  },
};

const KNOWN = `ALREADY KNOWN & SLATED FOR FIX (do NOT report these again):
1. Home featured-products carousel arrows (.bb-fp-arrow) bleed past viewport between ~640-1328px.
2. Catalog pages (/san-pham, /danh-muc-san-pham, /tim-kiem): PageHero rail (.bb-container, 1200) vs product grid rail (.bb-wp-container, stepped 1140) misalign below 1536px.
3. Home brand carousel .swiper sits 15px narrower than sibling rails.`;

const DESIGN = `INTENTIONAL DESIGN (do NOT flag as defects):
- Sharp corners everywhere (border-radius 0) — industrial brand identity.
- Dark (#141414/#000) header & footer on a light (#fff) page body.
- Fonts: Oswald (display/heading), Barlow (body), Barlow Condensed (CTA/nav). UPPERCASE headings/CTA/nav.
- Narrow centered reading/form columns (e.g. max-w-[560px], 970px, 68ch) are intentional.
- WP-parity layout: this is a faithful re-creation of a WordPress theme; stepped Bootstrap grids exist on catalog pages by design.
- Empty cart/checkout/compare states render a minimal empty-state card — that is correct, not "broken".`;

phase("Review");
const results = await pipeline(
  ROUTES,
  (r) => {
    const shots = VPS.map((vp) => `${SHOTS}/baseline__${r.slug}__${vp}.png`);
    const prompt = `You are a senior frontend + UI/UX engineer auditing the responsive visual quality of the BigBike e-commerce web app (Next.js + Tailwind, WP-parity industrial design).

ROUTE: ${r.label}

Inspect these 4 full-page screenshots (Read each image file):
${shots.map((s) => "  - " + s).join("\n")}
(filenames encode viewport: 390x844=mobile, 768x1024=tablet, 1280x900=desktop, 1920x1080=large desktop)

Then read the route source for ground truth (cwd = bigbike-web):
${r.sources.map((s) => "  - " + s).join("\n")}
You may also Grep app/globals.css for any class you see, to confirm root cause.

${KNOWN}

${DESIGN}

Report ONLY real, defensible defects in spacing / layout / responsive behavior / typography scaling / image-media scaling / ui-element sizing / alignment that a discerning user would notice as "off" or unprofessional at some viewport. For each: give the viewport, severity, category, what's visibly wrong (or the exact source line proving it, e.g. a hardcoded fixed width / missing responsive variant / next/image without sizes / aspect-ratio distortion), a root-cause hypothesis (file + class/selector), and a concrete suggested fix. Be conservative: do NOT invent nitpicks, do NOT propose restyles, respect the intentional design above. If the route looks clean and professional at all 4 viewports, set clean=true with an empty findings array. Return ONLY the structured object.`;
    return agent(prompt, { label: `review:${r.slug}`, phase: "Review", schema: FINDINGS_SCHEMA });
  },
  (rev, r) => {
    const med = (rev?.findings || []).filter((f) => f.severity !== "low");
    if (!rev || med.length === 0) return { route: r.label, verified: [], all: rev?.findings || [] };
    const prompt = `Adversarially verify these candidate UI defects for route "${r.label}" of the BigBike web app. For EACH, decide if it is a REAL defect worth fixing, or whether it is intended design / a screenshot artifact / a false positive. Default to isRealDefect=false unless the evidence clearly holds up.

${DESIGN}

You may Read the screenshots (${SHOTS}/baseline__${r.slug}__*.png) and the source files (${r.sources.join(", ")}) and Grep app/globals.css to check. Candidates:
${med.map((f, i) => `${i + 1}. [${f.severity}/${f.category}] ${f.title}\n   evidence: ${f.evidence}\n   rootCause: ${f.rootCause}`).join("\n")}

Return a verdict for each by its exact title.`;
    return agent(prompt, { label: `verify:${r.slug}`, phase: "Verify", schema: VERDICT_SCHEMA }).then((v) => ({
      route: r.label,
      all: rev.findings,
      verified: med
        .map((f) => ({ f, vd: (v?.verdicts || []).find((x) => x.title === f.title) }))
        .filter((x) => x.vd && x.vd.isRealDefect)
        .map((x) => ({ ...x.f, verifyReason: x.vd.reason })),
    }));
  },
);

const confirmed = results.filter(Boolean).flatMap((r) => (r.verified || []).map((f) => ({ route: r.route, ...f })));
const lows = results.filter(Boolean).flatMap((r) => (r.all || []).filter((f) => f.severity === "low").map((f) => ({ route: r.route, ...f })));
log(`Visual review done: ${confirmed.length} verified medium+ defects, ${lows.length} low-severity notes`);
return { confirmedDefects: confirmed, lowSeverityNotes: lows, perRoute: results.filter(Boolean).map((r) => ({ route: r.route, total: (r.all || []).length, verified: (r.verified || []).length })) };
