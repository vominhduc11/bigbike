# AGENTS.md

> Operating instructions for AI coding agents working on the BigBike monorepo.
>
> This file is the first document an AI agent should read before modifying code, docs, configs, or tests.
>
> Repository scope:
> - `bigbike-web`: public website / SEO commerce website for end customers
> - `bigbike-admin`: internal admin dashboard
> - `bigbike-backend`: Spring Boot backend
>
> If this file conflicts with a more specific document inside `docs/`, follow the more specific document and update this file if the rule should be global.

---

## 1. Purpose

`AGENTS.md` defines how AI agents must work in this repository.

It exists to prevent the usual charming disaster where an agent fixes a button, invents three order statuses, hardcodes brand colors, rewrites API payloads, and calls it “minor refactor”. No. Behave.

This file tells agents:

- Which docs to read before making changes.
- How to respect project boundaries.
- How to handle business rules, API contracts, data contracts, design rules and tokens.
- How to avoid breaking SEO, admin workflows and backend contracts.
- How to report changes clearly.
- What must never be invented without documentation.

---

## 2. Project Overview

BigBike is a retail / D2C commerce project for motorcycle riders and biker gear.

The project includes:

```text
bigbike/
├── bigbike-web/       # Public SEO + sales website
├── bigbike-admin/     # Internal admin dashboard
├── bigbike-backend/   # Spring Boot backend
└── docs/              # Source of truth documentation
```

Primary product domain:

- Motorcycle helmets.
- Riding jackets / pants.
- Gloves.
- Riding shoes.
- Protection gear.
- Bags / bike luggage.
- Helmet intercom / Bluetooth accessories.
- Other biker accessories.

Brand direction:

- Bold.
- Fast.
- Sporty.
- Mechanical.
- Biker-focused.
- Red / black identity.
- Commercially clear.
- Not cute.
- Not generic SaaS.
- Not random starter-template UI.

---

## 3. Required Reading Order

Before modifying anything, read the relevant docs.

### 3.1 Always read first

```text
AGENTS.md
docs/brand/BRAND_GUIDELINES.md
docs/business/BUSINESS_RULES.md
docs/contracts/DATA_CONTRACT.md
docs/contracts/API_CONTRACT.md
```

### 3.2 For `bigbike-web` changes

Read:

```text
docs/design/DESIGN_SYSTEM.md
docs/design/WEB_DESIGN.md
docs/tokens/WEB_DESIGN_TOKENS.md
docs/business/BUSINESS_PROCESS.md
docs/business/WORKFLOW.md
docs/contracts/STATE_MACHINES.md
```

Use these for:

- Homepage.
- Category/listing.
- Product detail page.
- Search.
- Cart.
- Checkout.
- SEO content.
- Public pages.
- Responsive/mobile behavior.

### 3.3 For `bigbike-admin` changes

Read:

```text
docs/design/DESIGN_SYSTEM.md
docs/design/ADMIN_DESIGN.md
docs/tokens/ADMIN_DESIGN_TOKENS.md
docs/business/WORKFLOW.md
docs/contracts/STATE_MACHINES.md
docs/contracts/PERMISSION_MATRIX.md
```

Use these for:

- Dashboard.
- Product management.
- Order management.
- Content management.
- Support/contact.
- Settings.
- CRUD screens.
- Admin tables/forms.
- Role/permission behavior.

### 3.4 For backend changes

Read:

```text
docs/business/BUSINESS_RULES.md
docs/business/BUSINESS_PROCESS.md
docs/business/WORKFLOW.md
docs/contracts/API_CONTRACT.md
docs/contracts/DATA_CONTRACT.md
docs/contracts/STATE_MACHINES.md
docs/contracts/PERMISSION_MATRIX.md
```

Use these for:

- API endpoints.
- Request/response shapes.
- Validation.
- Order/payment/product state transitions.
- Permissions.
- Business enforcement.
- Data model alignment.

### 3.5 For docs-only changes

Read the related neighboring docs before editing. Do not create contradictions.

Example:

If editing `API_CONTRACT.md`, also check:

```text
DATA_CONTRACT.md
STATE_MACHINES.md
PERMISSION_MATRIX.md
BUSINESS_RULES.md
```

---

## 4. Source of Truth Map

| Concern | Source of truth |
|---|---|
| Brand identity, logo, colors, typography meaning | `docs/brand/BRAND_GUIDELINES.md` |
| Shared UI rules | `docs/design/DESIGN_SYSTEM.md` |
| Public website UX | `docs/design/WEB_DESIGN.md` |
| Admin dashboard UX | `docs/design/ADMIN_DESIGN.md` |
| Web tokens | `docs/tokens/WEB_DESIGN_TOKENS.md` |
| Admin tokens | `docs/tokens/ADMIN_DESIGN_TOKENS.md` |
| Business rules | `docs/business/BUSINESS_RULES.md` |
| Business processes | `docs/business/BUSINESS_PROCESS.md` |
| User/admin workflows | `docs/business/WORKFLOW.md` |
| API contract | `docs/contracts/API_CONTRACT.md` |
| Data model contract | `docs/contracts/DATA_CONTRACT.md` |
| State transitions | `docs/contracts/STATE_MACHINES.md` |
| Roles and permissions | `docs/contracts/PERMISSION_MATRIX.md` |

Do not move responsibility between files unless explicitly asked.

---

## 5. Global Agent Rules

### 5.1 Do not invent business rules

Do not invent:

- Order statuses.
- Payment statuses.
- Product stock states.
- Warranty rules.
- Return/exchange rules.
- Promotion logic.
- Shipping fee rules.
- Permission rules.
- API fields.
- Database columns.

If a rule is missing, mark it as `TBD` or explain the gap. Do not fill the gap with confident nonsense, the official language of many broken systems.

### 5.2 Backend enforces business logic

Frontend may validate for UX, but backend must enforce:

- Price.
- Quantity.
- Stock.
- Product availability.
- Order status transition.
- Payment status.
- Permissions.
- Checkout validity.
- Admin actions.

### 5.3 Respect contracts

If changing API response, update:

```text
docs/contracts/API_CONTRACT.md
docs/contracts/DATA_CONTRACT.md
```

If changing status transition, update:

```text
docs/contracts/STATE_MACHINES.md
```

If changing admin permission behavior, update:

```text
docs/contracts/PERMISSION_MATRIX.md
```

If changing behavior/business rule, update:

```text
docs/business/BUSINESS_RULES.md
docs/business/WORKFLOW.md
```

### 5.4 No hardcoded design drift

Do not hardcode brand colors, spacing, radius, typography or shadows if token docs already define them.

Bad:

```tsx
className="bg-[#F90606] px-[17px] rounded-[11px]"
```

Better:

```tsx
className="bg-web-action-primary px-web-button-md rounded-web-button"
```

Exact syntax depends on the project stack, but the principle is not optional.

### 5.5 No random UI style

Do not introduce:

- New gradient style without brand reason.
- Random font.
- Random icon set.
- Random animation style.
- Vite/Next starter visuals.
- Cute/pastel UI.
- Generic SaaS dashboard look.

BigBike has a brand. Use it.

### 5.6 No raw null rendering

Never render raw:

```text
null
undefined
NaN
[object Object]
```

Use designed fallback states.

### 5.7 All screens need states

Every screen/component must handle:

- Loading.
- Empty.
- Error.
- Success.
- Disabled.
- Permission denied when relevant.
- Updating/submitting.
- Partial data if relevant.
- Unknown status fallback.
- Network failure where relevant.

---

## 6. Repository Boundaries

### 6.1 `bigbike-web`

Purpose:

- Public website.
- SEO.
- Product discovery.
- Product detail.
- Cart/checkout.
- Content/blog/policy pages.
- Trust and conversion.

Rules:

- Mobile-first.
- SEO-friendly.
- Product-first.
- Fast loading.
- Clear CTA.
- Crawlable content.
- Stable URLs.
- Internal links.
- Optimized images.
- No admin UX patterns unless truly appropriate.

Do not turn public web into a dashboard. Customers do not want to “manage entity rows”, they want to buy gear and leave with dignity.

### 6.2 `bigbike-admin`

Purpose:

- Internal operations.
- Product management.
- Order handling.
- Customer/support/content/campaign/settings management.

Rules:

- Data-first.
- Dense but readable.
- Tables/forms/filters must be strong.
- Destructive actions require confirmation.
- Permissions must be respected.
- Use admin tokens, not web campaign styling.
- No hero/campaign visuals inside operational screens unless a module preview specifically needs it.

Do not turn admin into a biker poster gallery.

### 6.3 `bigbike-backend`

Purpose:

- Business enforcement.
- API.
- Data persistence.
- Auth/permissions.
- Status transitions.
- Validation.
- Integration boundary.

Rules:

- Validate all incoming data.
- Enforce permissions.
- Never trust frontend totals.
- Never expose secrets.
- Align responses with contract.
- Use consistent error shape.
- Reject invalid state transitions.
- Preserve historical order snapshots.

---

## 7. Data Contract Rules

### 7.1 Canonical media fields

Use canonical fields:

```text
image.url
gallery[]
videos[]
```

Avoid reintroducing legacy field drift:

```text
imageUrl
images
videoUrl
```

Fallback for legacy data may exist temporarily, but new writes should use canonical shape.

### 7.2 Money

Money must use integer VND amount.

Do not use float for money.

Good:

```json
{
  "retailPrice": 1250000,
  "currency": "VND"
}
```

Bad:

```json
{
  "retailPrice": 1250000.50
}
```

### 7.3 Order snapshot

Orders must preserve snapshots:

- Product name.
- Product image.
- Variant/options.
- Unit price.
- Quantity.
- Customer info.
- Shipping address.

Do not depend only on live product/customer data to render old orders.

### 7.4 Unknown enum

If receiving unknown enum:

- Do not crash.
- Show neutral fallback.
- Log/report if appropriate.
- Do not map unknown to success.

---

## 8. API Rules

### 8.1 Standard shape

Use standard response shape from `API_CONTRACT.md`.

Single resource:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-04-20T03:30:00Z"
  }
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed.",
    "details": []
  },
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-04-20T03:30:00Z"
  }
}
```

### 8.2 Method rules

- `GET` reads.
- `POST` creates or executes commands.
- `PATCH` updates partially.
- `DELETE` deletes only if business allows.

Never mutate data with `GET`.

### 8.3 Auth and permission

- `401`: not authenticated.
- `403`: authenticated but not authorized.
- Admin endpoints must enforce permissions server-side.

### 8.4 State-changing endpoints

Use command endpoints when transition has side effects:

```text
POST /api/v1/admin/orders/{orderId}/status
POST /api/v1/admin/orders/{orderId}/cancel
POST /api/v1/admin/products/{productId}/publish
```

Backend must validate transition against `STATE_MACHINES.md`.

---

## 9. State Machine Rules

State transitions must align with:

```text
docs/contracts/STATE_MACHINES.md
```

Do not allow impossible transitions just because the UI button exists.

Examples of invalid concepts:

```text
COMPLETED -> PENDING_CONFIRMATION
CANCELLED -> SHIPPING
PENDING_CONFIRMATION -> COMPLETED
```

Frontend should hide/disable invalid actions, but backend still must reject invalid transition.

---

## 10. Permission Rules

Admin route/action must map to permission from:

```text
docs/contracts/PERMISSION_MATRIX.md
```

Examples:

```text
/admin/products       -> products.read
/admin/products/new   -> products.create
/admin/orders         -> orders.read
/admin/settings       -> settings.read
```

Backend must enforce every admin endpoint.

Frontend must:

- Hide inaccessible modules.
- Disable forbidden actions when resource is visible.
- Show permission denied route state when needed.

Dangerous actions require:

- Permission.
- Confirmation.
- Backend validation.
- Audit if supported.

---

## 11. Design Rules

### 11.1 Shared UI

Follow:

```text
docs/design/DESIGN_SYSTEM.md
```

All UI must have:

- Clear hierarchy.
- Clear actions.
- Consistent states.
- Accessible focus.
- Responsive behavior.
- No decorative noise.

### 11.2 Web design

For `bigbike-web`, follow:

```text
docs/design/WEB_DESIGN.md
docs/tokens/WEB_DESIGN_TOKENS.md
```

Priorities:

- SEO.
- Product discovery.
- Conversion.
- Mobile-first.
- Trust.
- Fast loading.
- PDP/cart/checkout clarity.

### 11.3 Admin design

For `bigbike-admin`, follow:

```text
docs/design/ADMIN_DESIGN.md
docs/tokens/ADMIN_DESIGN_TOKENS.md
```

Priorities:

- Data readability.
- Fast operations.
- Tables.
- Forms.
- Filters.
- CRUD.
- Permissions.
- Safe destructive actions.

---

## 12. SEO Rules for `bigbike-web`

Do not break SEO.

Required for public pages:

- One clear H1.
- Semantic heading hierarchy.
- Crawlable text.
- Metadata.
- Stable URLs.
- Internal links.
- Image alt text.
- Optimized images.
- No heavy hero/video that destroys performance.
- Category/PDP content must not be hidden in images only.

If changing slug/URL behavior:

- Check redirect strategy.
- Update internal links.
- Avoid breaking indexed URLs.

SEO is not magic dust sprinkled after launch. Shocking, I know.

---

## 13. Cart / Checkout Rules

When touching cart/checkout:

- Do not trust frontend price.
- Do not trust frontend stock.
- Do not allow duplicate submit.
- Preserve form data on error.
- Show price/stock changed notices.
- Show clear next step after order success.
- COD/manual confirmation must be clear if used.
- Backend must validate final order.

---

## 14. Admin CRUD Rules

Every CRUD screen should have:

- List loading state.
- Empty state.
- Error state.
- Search/filter/sort if relevant.
- Pagination if relevant.
- Row actions.
- Permission handling.
- Create/edit form validation.
- Submit loading state.
- Success/error feedback.
- Confirmation for dangerous action.

Tables should not render raw null/undefined.

---

## 15. File and Asset Rules

### 15.1 Brand assets

Brand assets should live in `public/brand` or shared asset package depending project structure.

Do not rename assets randomly without updating references.

### 15.2 Fonts

Use BigBike-approved fonts:

- `Bungee` for display/campaign/headline sparingly.
- `Exo` for body/UI/admin/product/content.

Do not introduce unrelated fonts.

### 15.3 Uploaded media

Media upload must validate:

- File type.
- File size.
- Public URL.
- Alt text if public image.
- Fallback if image fails.

---

## 16. Coding Standards

### 16.1 General

- Keep changes focused.
- Avoid unrelated refactors.
- Prefer reusable components.
- Avoid duplicate logic.
- Add types where appropriate.
- Handle errors explicitly.
- Do not swallow exceptions silently.
- Do not add dead code.
- Do not leave debug logs.

### 16.2 Frontend

- Use existing component patterns.
- Use tokenized styles.
- Keep accessibility.
- Avoid unnecessary client-side rendering if SEO page can be server-rendered.
- Avoid blocking render with heavy scripts.
- Keep responsive behavior.
- Use semantic HTML for public pages.

### 16.3 Backend

- Validate request DTOs.
- Use service-layer business validation.
- Enforce permissions.
- Return standard error shape.
- Avoid leaking internals.
- Keep transactions around state changes where needed.
- Preserve order snapshots.
- Add tests for critical business transitions.

---

## 17. Testing and Verification

Run available checks before finalizing.

Depending on project stack:

```bash
npm run lint
npm run test
npm run build
```

For backend:

```bash
./mvnw test
./mvnw package
```

If exact commands differ, inspect `package.json`, `pom.xml`, project scripts, or CI config.

Do not claim tests passed if you did not run them. Revolutionary honesty, apparently.

### 17.1 Web smoke checks

For `bigbike-web`, verify:

- Homepage loads.
- Category page loads.
- PDP loads.
- Search works if implemented.
- Cart flow works.
- Checkout submit handles validation.
- Mobile layout not broken.
- SEO title/H1 not missing.

### 17.2 Admin smoke checks

For `bigbike-admin`, verify:

- Login/session behavior.
- Dashboard loads.
- Product list loads.
- Product create/edit validation.
- Order list/detail loads.
- Permission denied behavior.
- Destructive confirmation.
- Table empty/error/loading states.

### 17.3 Backend smoke checks

For `bigbike-backend`, verify:

- App starts.
- API endpoints match contract.
- Validation errors use standard shape.
- Permissions enforced.
- State transitions validated.
- No secrets exposed.

---

## 18. Documentation Update Rules

Update docs when code changes affect:

- Business behavior.
- API contract.
- Data model.
- State transitions.
- Permissions.
- UI design rules.
- Token usage.
- SEO behavior.
- Workflow.

Do not leave docs stale. Stale docs are worse than no docs because they lie with confidence.

---

## 19. Commit / PR Guidance

When creating a commit or PR, summarize:

- What changed.
- Why it changed.
- Which app/docs affected.
- Tests/checks run.
- Risks or follow-up work.

Example:

```text
Summary:
- Added product publish validation in backend.
- Updated admin publish button disabled state.
- Documented transition in STATE_MACHINES.md.

Checks:
- npm run lint
- ./mvnw test

Notes:
- No database migration required.
```

---

## 20. Forbidden Changes Without Explicit Request

Do not do these unless explicitly asked:

- Rewrite whole app architecture.
- Replace framework/library.
- Rename major routes.
- Change API versioning.
- Change database schema.
- Add auth provider.
- Add payment provider.
- Change brand colors.
- Change business statuses.
- Change permission model.
- Hard-delete existing business data.
- Remove SEO routes.
- Remove fallback support for existing data.

---

## 21. Safe Defaults

When uncertain:

- Preserve existing behavior.
- Prefer additive change.
- Add fallback.
- Keep old route working.
- Keep old data readable.
- Mark unclear business rule as `TBD`.
- Ask for clarification in the final response if needed.
- Do not invent.

---

## 22. Agent Final Response Format

When finishing a task, report:

```text
Summary:
- ...

Files changed:
- ...

Checks:
- ...

Notes:
- ...
```

If checks were not run, say:

```text
Checks:
- Not run: reason
```

Do not claim imaginary test results. The CI gods are petty and they keep receipts.

---

## 23. Quick Reference

### Web change

Read:

```text
BRAND_GUIDELINES.md
DESIGN_SYSTEM.md
WEB_DESIGN.md
WEB_DESIGN_TOKENS.md
BUSINESS_RULES.md
API_CONTRACT.md
DATA_CONTRACT.md
```

### Admin change

Read:

```text
BRAND_GUIDELINES.md
DESIGN_SYSTEM.md
ADMIN_DESIGN.md
ADMIN_DESIGN_TOKENS.md
BUSINESS_RULES.md
API_CONTRACT.md
DATA_CONTRACT.md
PERMISSION_MATRIX.md
```

### Backend change

Read:

```text
BUSINESS_RULES.md
BUSINESS_PROCESS.md
WORKFLOW.md
API_CONTRACT.md
DATA_CONTRACT.md
STATE_MACHINES.md
PERMISSION_MATRIX.md
```

### Contract change

Update linked docs. No orphan contracts.

---

## Final Rule

An AI agent must leave the repository more consistent than it found it.

If the change makes one frontend, backend, docs, and contracts disagree with each other, the change is not done. It is merely a bug wearing a pull request costume.
