---
name: bigbike-design
description: Use this skill to generate well-branded interfaces and assets for BigBike (shop đồ bảo hộ moto / biker gear, TP.HCM), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

Key files:
- `README.md` — brand context, content fundamentals, visual foundations, iconography.
- `colors_and_type.css` — drop-in CSS variables + base type classes (apply `bb-theme-dark` to body).
- `fonts/` — Bungee (display) + Exo (body, 9 weights).
- `assets/logo/`, `assets/favicon/`, `assets/icons/` (48-set), `assets/signage/`, `assets/social/`.
- `ui_kits/website/` — Bigbike.vn recreation. Copy components from here when building Bigbike screens.
- `preview/` — design system reference cards.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view.
If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Non-negotiables:
- Vietnamese copy with full diacritics, unless a slogan.
- Racing red `#F90606` is the single accent. No other "brand" hues.
- Display type is Bungee (uppercase). Body is Exo.
- No emoji, ever. No gradient-background AI slop, no rounded-soft UI.
- Dark-first surfaces (black/near-black) — or a white editorial body when mimicking the WP homepage style.
- Card hovers: red border fade, lift, no scale.
