# Independent browser tooling review — 2026-11-13

Reviewer: frontend/media agent. Implementation owner: Lead. This review did not
modify the browser/CI implementation and did not execute a remote workload.
Applicable guidance read: `.agents/skills/e2e/SKILL.md`, the existing admin fixture,
route/quality helpers, web public route mapping, checkout/PDP source, and canonical
`TESTING_GUIDE.md` performance validation section.

## Findings sent to Lead

1. **Admin route prefix:** initial runner used `/products`, `/media`, `/orders`,
   `/customers`, but live App routing requires `/admin/...`. The inspected later
   source uses those corrected paths.
2. **Cookie rotation across viewport contexts:** refresh cookies rotate and become
   single-use. Initial runner reused its original cookie for the second viewport.
   The inspected later source captures the rotated cookie before context close and
   carries it into the next viewport. One worker and bounded login/refresh budgets
   remain necessary.
3. **Authenticated screen assertion:** AdminApp can render the login screen while
   retaining the same `/admin/...` URL. HTTP 200 and URL checks alone cannot prove
   authentication. The initial `has_table_or_empty_state` metric was only recorded,
   not asserted; Lead was asked to require `.bb-app` / `.bb-page-content`, reject
   `.bb-login-shell`, and wait for the relevant successful data response or actual
   designed state. Media may be a grid rather than a table, so a universal table
   selector is insufficient.
4. **CLS window initialization:** initial code used start=0/last=0 and only reset
   when the next gap exceeded one second or the window exceeded five seconds.
   A first shift before one second therefore started the five-second window at
   navigation, not at the first shift, potentially undercounting the cluster. Lead
   was asked to initialize on the first actual shift.
5. **Unsupported metrics:** a single try block sets up all observers and CLS starts
   at zero. If an earlier observer is unsupported, later metrics are not installed
   yet CLS could look measured. Prefer independent observers and explicit
   support/null status.
6. **Failure evidence:** final failure logging is sanitized but generic. Preserve a
   fixed current stage/surface/failure code in partial metrics so a remote failure
   can be located without exposing cookies, response bodies or customer content.

Items 3–6 require final Lead integration review; this document does not assert they
were repaired or executed merely because a recommendation was delivered.

## Routes and selectors checked against current app source

- The selected VI public aliases are valid: `/`, `/danh-muc/<slug>/`,
  `/product/<slug>/`, `/tim-kiem/?q=...`, `/gio-hang/`, `/lien-he/`, `/dang-nhap/`.
- The seeded product is simple (no variants), so `[data-purchase-add]` is an
  appropriate real add-to-cart selector. Waiting for its successful POST and
  requiring `[data-checkout-form]` at `/dat-hang/` matches current checkout behavior.
  Empty carts render a separate empty state, not a checkout form.
- Real checkout fields are `#billing_full_name`, `#billing_phone`,
  `#billing_email`, `#billing_address_1` and province/ward comboboxes; submit also
  requires the confirmation checkbox. The current browser runner does not submit
  this form; API checks are a separate evidence type.
- Fresh anonymous customer contexts do not normally fetch `/customer/me` because
  `auth-store.ts` checks the actual authentication hint and guest cookie. Do not
  solve unexpected 401s by ignoring every authentication response.
- Current lab event durations are correctly labelled as observations, not field
  INP. First navigation labels explicitly avoid calling the server cache cold.

## Existing standard E2E option

The mature admin smoke fixture already implements cookie rotation, one login per
worker, SPA navigation and UI/runtime assertions. A future isolated-only invocation
from `bigbike-admin` can use:

```text
E2E_BASE_URL=http://localhost:14000
E2E_NO_WEBSERVER=1
E2E_ADMIN_EMAIL=perf-admin@example.invalid
E2E_ADMIN_PASSWORD=<per-arm generated credential, never logged>
npx playwright test smoke-routes.spec.ts --workers=1 --retries=0
```

The fixture's cleanup only targets explicit module prefixes such as E2E_PRODUCT_,
E2E_BRAND_ and E2E_CATEGORY_; current E2E_PERF_ benchmark fixtures do not match and
remain available. Its raw diagnostics, trace and video may contain private session
or form content, so keep these in ephemeral private directories and publish only
sanitized counts. Its route catalog omits the discontinued-products screen and is
therefore still not exhaustive.

The new generic browser workload currently measures seven public surfaces and a
small set of authenticated admin list surfaces plus a cart interaction. It does not
cover all screens, variants, account lifecycle, CRUD, bulk actions, report generation,
filters/search interactions, media retries/progress, or production field metrics.
No source review or syntax pass can certify those unexecuted paths.

## Final integrated source review

`frontend-media-final-ci-qa.json` records hashes of the exact integrated browser,
runner, Compose/proxy, standard-smoke wrapper and standalone launcher source read
in the final pass. No actual remote runtime or browser workload was executed by
this review. The wrapper was authored by this reviewer, so its final inspection is
self-review; review of the Lead's other tooling is independent.

The integrated source now fixes the earlier route prefix, refresh rotation,
authenticated screen/data assertion, first-shift CLS window, unsupported metric
nulls and sanitized surface/step progress. It also performs actual search and
browser checkout actions, checks the two representative images, runs the existing
desktop admin smoke fixture, applies the three coarse edge budgets, and handles
the nested/flat Next standalone entrypoint with the explicit Node22/glibc lab
runtime. These are source observations, not runtime passes.

One additional measurement-integrity gap was sent to Lead: HTTP response listeners
do not see `requestfailed` failures with no response. Without a corresponding
listener, a failed local font/script/media request can leave resource_errors at
zero. The requested bounded repair is a sanitized local-resource/API failure count,
excluding ordinary navigation ERR_ABORTED, included in the existing failure gate.
An optional console-error count can catch recoverable React/hydration failures.

Final follow-up: the integrated browser now captures local API and relevant
resource `requestfailed` events, records ordinary ERR_ABORTED cancellations
separately, and includes network failures in the existing failure gate. It also
counts local/unlocated console errors in that gate, with external-origin console
errors recorded separately. Only aggregate counters are persisted; raw request
URLs/errors are not copied to evidence. The final JSON hashes/status were refreshed
after rereading these exact listeners and their persisted counters/gate. No
remaining concrete source blocker was identified in the reviewed workload.
No additional test/build/browser/remote run was performed by this follow-up;
real isolated CI remains required to establish runtime compatibility.
