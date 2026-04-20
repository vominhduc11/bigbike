# BigBike

> BigBike is a motorcycle gear retail / D2C commerce platform.
>
> The project includes a public SEO-first sales website, an internal admin dashboard, and a backend service for product, order, content and operational data.

---

## 1. Project Overview

BigBike is built for selling motorcycle gear and biker accessories to end customers.

Main business domain:

- Motorcycle helmets.
- Riding jackets and pants.
- Riding gloves.
- Riding shoes.
- Protection gear.
- Motorcycle bags / luggage.
- Helmet intercom / Bluetooth accessories.
- Other biker accessories.

The system is designed around three major surfaces:

```text
bigbike/
├── bigbike-web/       # Public SEO + sales website
├── bigbike-admin/     # Internal admin dashboard
├── bigbike-backend/   # Spring Boot backend
└── docs/              # Project documentation and contracts
```

---

## 2. Applications

### 2.1 `bigbike-web`

Public-facing website for customers.

Primary goals:

- SEO.
- Product discovery.
- Category browsing.
- Product detail pages.
- Cart and checkout.
- Customer trust.
- Content/blog/policy pages.
- Mobile-first commerce UX.

Main references:

```text
docs/design/WEB_DESIGN.md
docs/tokens/WEB_DESIGN_TOKENS.md
docs/brand/BRAND_GUIDELINES.md
docs/business/BUSINESS_RULES.md
docs/contracts/API_CONTRACT.md
docs/contracts/DATA_CONTRACT.md
```

### 2.2 `bigbike-admin`

Internal admin dashboard for operations.

Primary goals:

- Product management.
- Category/brand management.
- Order handling.
- Customer/contact/support management.
- Content and campaign management.
- Settings and operational workflows.
- Permission-based access control.

Main references:

```text
docs/design/ADMIN_DESIGN.md
docs/tokens/ADMIN_DESIGN_TOKENS.md
docs/contracts/PERMISSION_MATRIX.md
docs/contracts/STATE_MACHINES.md
docs/business/WORKFLOW.md
```

### 2.3 `bigbike-backend`

Backend service.

Primary goals:

- API.
- Business validation.
- Data persistence.
- Authentication and authorization.
- Product/order/content state management.
- Admin permissions.
- Consistent API and data contracts.

Main references:

```text
docs/contracts/API_CONTRACT.md
docs/contracts/DATA_CONTRACT.md
docs/contracts/STATE_MACHINES.md
docs/contracts/PERMISSION_MATRIX.md
docs/business/BUSINESS_RULES.md
```

---

## 3. Brand Direction

BigBike brand identity:

- Bold.
- Fast.
- Sporty.
- Mechanical.
- Biker-focused.
- Red / black visual system.
- Product-first.
- Commercially clear.

Core brand files:

```text
docs/brand/BRAND_GUIDELINES.md
```

Do not randomly change brand colors, typography, logo usage or visual language.

Approved brand direction should be implemented through design docs and tokens:

```text
docs/design/DESIGN_SYSTEM.md
docs/design/WEB_DESIGN.md
docs/design/ADMIN_DESIGN.md
docs/tokens/WEB_DESIGN_TOKENS.md
docs/tokens/ADMIN_DESIGN_TOKENS.md
```

---

## 4. Documentation Map

### 4.1 Agent / repo-level instruction

```text
AGENTS.md
```

Read this before using AI agents or making broad code changes.

### 4.2 Brand

```text
docs/brand/BRAND_GUIDELINES.md
```

Defines:

- Brand identity.
- Logo rules.
- Color direction.
- Typography direction.
- Asset usage.
- Visual mood.

### 4.3 Design

```text
docs/design/DESIGN_SYSTEM.md
docs/design/WEB_DESIGN.md
docs/design/ADMIN_DESIGN.md
```

Defines:

- Shared UI rules.
- Public website UX.
- Admin dashboard UX.
- Component behavior.
- Accessibility.
- Responsive rules.
- State design.

### 4.4 Tokens

```text
docs/tokens/WEB_DESIGN_TOKENS.md
docs/tokens/ADMIN_DESIGN_TOKENS.md
```

Defines:

- Semantic colors.
- Typography tokens.
- Spacing.
- Radius.
- Shadows.
- Motion.
- Component token mapping.
- Web/admin-specific implementation guidance.

### 4.5 Business

```text
docs/business/BUSINESS_RULES.md
docs/business/BUSINESS_PROCESS.md
docs/business/WORKFLOW.md
```

Defines:

- Business rules.
- End-to-end processes.
- Customer/admin workflows.
- Operational behavior.
- Checkout/order/support concepts.

### 4.6 Contracts

```text
docs/contracts/API_CONTRACT.md
docs/contracts/DATA_CONTRACT.md
docs/contracts/STATE_MACHINES.md
docs/contracts/PERMISSION_MATRIX.md
```

Defines:

- API request/response contract.
- Data model contract.
- State transition rules.
- Admin roles and permissions.

### 4.7 Legacy WordPress migration

```text
docs/legacy/WORDPRESS_SOURCE_AUDIT.md
docs/legacy/LEGACY_DATABASE_SCHEMA.md
docs/legacy/LEGACY_ROUTE_MAP.md
docs/legacy/LEGACY_PRODUCT_MODEL.md
docs/legacy/LEGACY_ORDER_FLOW.md
docs/legacy/SEO_REDIRECT_MAP.csv
docs/legacy/WORDPRESS_TO_NEW_STACK_MAPPING.md
```

Defines:

- Sanitized WordPress source discovery.
- Schema-only SQL dump summary.
- Product/category/order/content/auth migration references.
- Legacy route and SEO redirect requirements.
- WordPress-to-new-stack mapping for future agents.

The legacy WordPress export is a local-only reference:

```text
bigbike_vn__2026_04_17/
```

Do not commit the raw WordPress source, `sqldump.sql`, `wp-config.php` secret values, user data, order data, customer emails, phone numbers, addresses, password hashes, session values, API keys, tokens, or webhook secrets.

---

## 5. Recommended Reading by Task

### Working on `bigbike-web`

Read:

```text
AGENTS.md
docs/brand/BRAND_GUIDELINES.md
docs/design/DESIGN_SYSTEM.md
docs/design/WEB_DESIGN.md
docs/tokens/WEB_DESIGN_TOKENS.md
docs/business/BUSINESS_RULES.md
docs/contracts/API_CONTRACT.md
docs/contracts/DATA_CONTRACT.md
```

### Working on `bigbike-admin`

Read:

```text
AGENTS.md
docs/brand/BRAND_GUIDELINES.md
docs/design/DESIGN_SYSTEM.md
docs/design/ADMIN_DESIGN.md
docs/tokens/ADMIN_DESIGN_TOKENS.md
docs/contracts/PERMISSION_MATRIX.md
docs/contracts/STATE_MACHINES.md
docs/contracts/API_CONTRACT.md
docs/contracts/DATA_CONTRACT.md
```

### Working on `bigbike-backend`

Read:

```text
AGENTS.md
docs/business/BUSINESS_RULES.md
docs/business/BUSINESS_PROCESS.md
docs/business/WORKFLOW.md
docs/contracts/API_CONTRACT.md
docs/contracts/DATA_CONTRACT.md
docs/contracts/STATE_MACHINES.md
docs/contracts/PERMISSION_MATRIX.md
```

### Working on documentation

Read neighboring docs first. Do not create contradictions.

Example:

If changing API behavior, update both:

```text
docs/contracts/API_CONTRACT.md
docs/contracts/DATA_CONTRACT.md
```

If changing state transitions, update:

```text
docs/contracts/STATE_MACHINES.md
docs/business/WORKFLOW.md
```

---

## 6. Development Setup

> Exact commands depend on the actual package manager and backend build files in each sub-project. Check each app folder before running commands. Revolutionary, yes: read the files before summoning the terminal.

### 6.1 Public website

Typical flow:

```bash
cd bigbike-web
npm install
npm run dev
```

Build:

```bash
npm run build
```

Lint/test if available:

```bash
npm run lint
npm run test
```

### 6.2 Admin dashboard

Typical flow:

```bash
cd bigbike-admin
npm install
npm run dev
```

Build:

```bash
npm run build
```

Lint/test if available:

```bash
npm run lint
npm run test
```

### 6.3 Backend

Typical Spring Boot flow:

```bash
cd bigbike-backend
./mvnw spring-boot:run
```

Test/package:

```bash
./mvnw test
./mvnw package
```

If the project uses Gradle instead of Maven, use the matching Gradle commands.

Phase 4E auth note:

- `GET /api/v1/auth/me` currently uses a dev/mock placeholder user.
- Placeholder auth is available only for dev/mock-style runtime profiles.
- Production auth provider is not implemented yet in this phase.

---

## 7. Environment Variables

Do not commit secrets.

Each app should use its own environment file pattern, for example:

```text
bigbike-web/.env.local
bigbike-admin/.env.local
bigbike-backend/.env
```

Recommended examples:

```text
.env.example
.env.local.example
```

Never commit:

- Database passwords.
- JWT secrets.
- Payment secrets.
- SMTP credentials.
- Cloud storage credentials.
- Admin passwords.
- Private API keys.

If a required variable is missing, document it in the app-specific README or `.env.example`.

---

## 8. Data and API Contract Rules

All API and data shape changes must follow:

```text
docs/contracts/API_CONTRACT.md
docs/contracts/DATA_CONTRACT.md
```

Rules:

- API JSON uses `camelCase`.
- Money uses integer VND amount, not float.
- Backend validates final price and total.
- Orders preserve product/customer/address snapshots.
- Public API must not expose internal fields.
- Admin API must enforce permissions.
- Error responses must use standard error shape.
- Status values must match `STATE_MACHINES.md`.

Canonical product media fields:

```text
image.url
gallery[]
videos[]
```

Avoid reintroducing legacy drift:

```text
imageUrl
images
videoUrl
```

---

## 9. Business Rules

Business behavior must follow:

```text
docs/business/BUSINESS_RULES.md
```

Agents and developers must not invent:

- Order statuses.
- Payment statuses.
- Stock states.
- Warranty rules.
- Return rules.
- Shipping fee rules.
- Promotion logic.
- Permission rules.

If a rule is missing, mark it as `TBD` and update the relevant docs before implementing.

---

## 10. State Machines

State transitions must follow:

```text
docs/contracts/STATE_MACHINES.md
```

Examples of state-machine domains:

- Product publish status.
- Product stock state.
- Order status.
- Payment status.
- Fulfillment status.
- Content publish status.
- Campaign status.
- Contact/support status.

Backend must reject invalid transitions.

Frontend may hide/disable invalid actions, but backend enforcement is mandatory.

---

## 11. Permissions

Admin permissions must follow:

```text
docs/contracts/PERMISSION_MATRIX.md
```

Rules:

- Admin routes need permission mapping.
- Admin API endpoints need backend permission checks.
- Frontend hiding is not security.
- Dangerous actions require confirmation.
- Sensitive data export requires export permission.
- User/role/settings changes require restricted permissions.

---

## 12. UI and Design Rules

### 12.1 Shared UI

Follow:

```text
docs/design/DESIGN_SYSTEM.md
```

All UI should include:

- Clear hierarchy.
- Clear action priority.
- Consistent states.
- Loading/empty/error/success states.
- Accessible focus.
- Responsive behavior.
- No raw `null` / `undefined` rendering.

### 12.2 Web UI

Follow:

```text
docs/design/WEB_DESIGN.md
docs/tokens/WEB_DESIGN_TOKENS.md
```

Priorities:

- SEO.
- Mobile-first.
- Product discovery.
- Conversion.
- Product image clarity.
- Price and stock clarity.
- Cart/checkout trust.

### 12.3 Admin UI

Follow:

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
- Permission-aware actions.
- Safe destructive actions.

---

## 13. SEO Rules for `bigbike-web`

Public pages should preserve SEO quality:

- One clear H1.
- Semantic heading hierarchy.
- Crawlable content.
- Metadata.
- Canonical URL if needed.
- Stable product/category/article URLs.
- Internal links.
- Optimized images.
- Image alt text.
- Fast loading.
- Mobile-first layout.

If changing slugs or URL structure, handle redirects and internal links.

Do not hide critical SEO content inside images or client-only components without a clear reason.

---

## 14. Cart and Checkout Rules

Cart and checkout must be reliable.

Rules:

- Backend verifies price.
- Backend verifies stock.
- Backend verifies quantity.
- Backend validates checkout data.
- Submit button blocks double-submit.
- Errors preserve form data when possible.
- Price/stock changes are communicated.
- Order success explains next step.
- COD/manual confirmation copy must be clear if used.

---

## 15. Admin Operation Rules

Admin screens must handle:

- Loading state.
- Empty state.
- Error state.
- Permission denied state.
- Search/filter/sort.
- Pagination where relevant.
- Row actions.
- Bulk actions where relevant.
- Confirmation for dangerous actions.
- Field validation.
- Submit/update loading.

Do not build admin screens that only work on happy-path demo data. That is not a workflow, that is theater with buttons.

---

## 16. Testing

Run available checks before committing.

Common frontend checks:

```bash
npm run lint
npm run test
npm run build
```

Common backend checks:

```bash
./mvnw test
./mvnw package
```

If commands differ, inspect:

```text
package.json
pom.xml
build.gradle
CI config
```

Do not claim tests passed if they were not run.

---

## 17. Smoke Test Checklist

### 17.1 `bigbike-web`

Check:

- Homepage loads.
- Category/listing page loads.
- Product detail page loads.
- Search works if implemented.
- Cart can add/update/remove item.
- Checkout validates required fields.
- Order success page renders after successful order if backend flow exists.
- Mobile layout is usable.
- SEO H1/title exists.

### 17.2 `bigbike-admin`

Check:

- Login/session behavior.
- Dashboard loads.
- Product list loads.
- Product create/edit validation.
- Order list/detail loads.
- Status update handles success/error.
- Permission denied state works.
- Dangerous actions require confirmation.
- Table loading/empty/error states exist.

### 17.3 `bigbike-backend`

Check:

- App starts.
- API endpoints match contract.
- Error shape matches contract.
- Permissions are enforced.
- Invalid state transitions are rejected.
- No secrets are exposed.
- Order snapshots are preserved.

---

## 18. AI Agent Workflow

Before changing code:

1. Read `AGENTS.md`.
2. Identify affected app.
3. Read relevant docs.
4. Inspect current implementation.
5. Make focused changes.
6. Update docs if contract/business/design changes.
7. Run available checks.
8. Report what changed and what was not run.

Do not do broad rewrites unless explicitly requested.

### 18.1 Legacy migration workflow

Before implementing product, order, content, auth, customer, media, category, brand, search, cart, checkout, or public route behavior derived from the legacy WordPress site:

1. Read all files in `docs/legacy/`.
2. Treat `bigbike_vn__2026_04_17/` as local-only reference material.
3. Inspect `sqldump.sql` only in read-only mode and only for schema or sanitized aggregate facts.
4. Update `docs/contracts/DATA_CONTRACT.md` before codifying legacy data mappings.
5. Update `docs/legacy/SEO_REDIRECT_MAP.csv` before changing route, slug, permalink, trailing slash, or blog `.html` behavior.
6. Produce only sanitized artifacts under approved documentation/sample paths.

Do not build new features ahead of legacy discovery for the affected domain. If the legacy docs are incomplete, extend the sanitized docs first.

---

## 19. Forbidden Without Explicit Request

Do not do these without explicit approval:

- Replace framework.
- Rewrite architecture.
- Rename major routes.
- Change API versioning.
- Change brand colors.
- Change business statuses.
- Change permission model.
- Change database schema.
- Add payment provider.
- Add auth provider.
- Remove SEO routes.
- Hard-delete business data.
- Remove compatibility fallback for existing data.

---

## 20. Pull Request / Change Summary Format

Recommended PR summary:

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

If checks were not run:

```text
Checks:
- Not run: reason
```

No imaginary test results. CI already has enough trust issues.

---

## 21. Current Documentation Status

The repo is expected to include these core docs:

```text
AGENTS.md

docs/brand/BRAND_GUIDELINES.md

docs/design/DESIGN_SYSTEM.md
docs/design/WEB_DESIGN.md
docs/design/ADMIN_DESIGN.md

docs/tokens/WEB_DESIGN_TOKENS.md
docs/tokens/ADMIN_DESIGN_TOKENS.md

docs/business/BUSINESS_RULES.md
docs/business/BUSINESS_PROCESS.md
docs/business/WORKFLOW.md

docs/contracts/API_CONTRACT.md
docs/contracts/DATA_CONTRACT.md
docs/contracts/STATE_MACHINES.md
docs/contracts/PERMISSION_MATRIX.md
```

If a file is missing or empty, create/update it before asking an agent to rely on it.

---

## 22. Final Rule

BigBike changes must keep these four layers aligned:

```text
Business rules
API/data contracts
Design system
Implementation
```

If one layer changes and the others are left stale, the project will still compile, probably, and then quietly punish everyone later. Avoid that.
