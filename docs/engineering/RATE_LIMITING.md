# Rate limiting

## Purpose and scope

Rate limiting protects BigBike across the whole request path: client → public nginx →
storefront BFF/admin proxy → backend → database, MinIO, mail and external providers. It is a
security and availability control; it never replaces authentication, authorization, CSRF,
checkout idempotency, review ownership, chat turn limits, or state-machine validation.

Every public, customer, admin, internal and WebSocket entry point has one of the following
explicit policies: an application tier, an nginx-only coarse tier, or a documented exemption
(`GET /actuator/health` on the private health path). New mapped endpoints must be added to the
backend policy catalog and its coverage test before release.

## Response contract

An actual policy rejection always returns HTTP `429` with the standard `ApiErrorResponse`:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
    "details": []
  },
  "meta": { "requestId": "…", "timestamp": "…" }
}
```

`Retry-After` is mandatory. Backend computes it from the denied bucket and rounds up to at least
one second; nginx's coarse protection returns `Retry-After: 1`. `Cache-Control: no-store` is
mandatory. BigBike deliberately does **not** emit `RateLimit-Limit`, `RateLimit-Remaining` or
`RateLimit-Reset`: several independent keys can reject one request, so any one value would be
misleading and could expose account activity.

An nginx rate rejection must never be remapped to the static `503` maintenance page/body. A
maintenance response remains only for a genuine upstream outage or the separately documented
admin maintenance workflow.

## Policy catalog

All application buckets use a greedy token bucket: capacity is the visible burst and tokens refill
evenly across the stated period. A request must pass every listed key. Identity values are
normalized first and HMAC-SHA-256 keyed before they reach Redis; raw IP, email, phone, customer id,
session token and API token are not written into rate-limit keys, metrics or application logs.

| Tier | Paths/surface | Keys | Limit |
|---|---|---|---|
| `LOGIN` | Admin and customer login | IP + HMAC login identity | 5/minute |
| `REGISTER` | Customer register | IP + HMAC email/phone | 3/minute |
| `PASSWORD_RESET` | Customer forgot/reset password; public admin-invite validation/acceptance; email verification token action | IP + HMAC target/token when available | 5/minute |
| `RESEND_VERIFICATION` | Customer resend verification; invite recipient resend | IP + HMAC recipient/customer | 3/hour |
| `REFRESH` | Admin/customer refresh and logout | IP + HMAC session | 30/minute |
| `CUSTOMER_MUTATION` | Cart, profile, address and customer order mutation | IP + HMAC customer session | 30/minute |
| `CUSTOMER_MEDIA` | Customer avatar upload/delete | IP + HMAC customer session | 30/minute |
| `CHECKOUT` | Checkout | IP + HMAC customer/guest session | 5/minute; existing idempotency key remains mandatory for safe retries |
| `ORDER_LOOKUP` | Public order lookup | IP + normalized lookup identity HMAC when present | 20/minute |
| `SEARCH` | `GET /api/v1/products?q=...` and `GET /api/v1/search-suggest`, direct or via BFF | IP | 60/minute |
| `REVIEW` / `REVIEW_PHOTO` | Review submit/photo upload | IP + HMAC customer/review session | 5/minute / 30/minute |
| `CHAT` | `POST /api/v1/chat/messages`, `/leads`, `/leads/decline` | IP + HMAC conversation | 10/minute |
| `OAUTH` | OAuth authorize/callback | IP + opaque state HMAC when present | 20/minute |
| `ADMIN_MUTATION` | Admin write/default expensive command | Admin account + IP | 60/minute |
| `ADMIN_MEDIA` | Admin media upload/replace | Admin account + IP | 30/minute, 2 concurrent/account, 10 global |
| `ADMIN_IMPORT` | Product import validate/commit | Admin account + IP | validate 6/hour, commit 2/hour, 1 global |
| `ADMIN_EXPORT` | Product/report export | Admin account + IP | 12/hour, 3 global |
| `INTERNAL` | `/api/internal/**` | HMAC internal token + IP | 300/minute |
| `WEBSOCKET` | `/ws` handshake and inbound admin commands | IP + admin account/session | handshake 10/minute/IP, 3 connections/account, commands 60/minute/account |

Pure public reads and authenticated admin reads remain explicitly covered by nginx coarse limits.
Product id is not a global deny key because a popular product must not make unrelated customers fail.
Customer account lockout is intentionally not added: customer authentication uses the dual IP and
HMAC identity controls; the existing admin-only lockout remains unchanged.

### Nginx coarse protection

These are deliberately coarse, per-Nginx-instance controls that absorb floods before an upstream
connection is opened. They do not replace the Redis-backed application policy above and their
burst is explicitly immediate (`nodelay`):

| Public host/surface | Request limit | Concurrent connection cap |
|---|---:|---:|
| `api.bigbike.vn` normal API | 10 requests/second/IP, burst 20 | 20/IP (4/IP for admin-media uploads) |
| `api.bigbike.vn/ws` | 10 requests/second/IP, burst 10 | 5/IP |
| `bigbike.vn` storefront/BFF | 30 requests/second/IP, burst 30 | 20/IP server, 12/IP route |
| `admin.bigbike.vn` | 30 requests/second/IP, burst 30 | 12/IP server, 8/IP route |

Nginx sends `429`, `Retry-After: 1`, `Cache-Control: no-store` and the standard error envelope
for its own rejection. Its key is the edge's direct remote address; do not enable `real_ip` or
trust a CDN forwarding header without recording and testing every actual proxy hop.

## Distributed store and failure behavior

Production uses a managed HA Redis-compatible store with TLS/ACL, a dedicated `bb:rl:v1:`
namespace, per-entry TTL based on time-to-refill plus a safety margin, a memory quota and `noeviction`.
Redis is the shared source of bucket state, so backend restart, rolling deploy and replica changes
do not reset limits. The local Docker Compose Redis service is development/test infrastructure only
and is not a production topology declaration.

Redis timeout, authentication, capacity and connection errors are captured as limiter-store
failures. Auth/email/OAuth/review/chat/admin/internal/WebSocket controls fail closed with a normal
`429` and `Retry-After: 60`; cart, checkout and public reads use a bounded TTL local emergency
bucket to preserve selling/reading while immediately alerting operations. Fallback state is never
shared between replicas and is not a substitute for Redis.

In Redis mode, media/import/export in-flight control uses atomic, expiring Redis sorted-set leases:
2 media streams per account and 10 global, one import globally, and three exports globally across
backend replicas. A leaked lease expires (media 10 minutes, import 30 minutes, export 15 minutes);
the chosen TTL must remain above the approved server timeout. The built-in WebSocket/simple broker
is still per JVM, so do not horizontally scale it until a shared broker/event-bus design passes
staging failure tests.

## Proxy and client identity

Nginx must remove client-supplied forwarding headers and emit one canonical client address.
Backend trusts a forwarding header only when the direct peer matches an approved, narrow private
proxy CIDR/exact address. Empty or malformed configuration, a public CIDR, `0.0.0.0/0`, or broad
Docker ranges such as `172.16.0.0/12` are invalid in production. Until the real CDN/load-balancer
chain is recorded and verified, nginx uses its direct remote address; it must not trust a
client-supplied `X-Forwarded-For`.

The BFF/admin internal proxy forwards only the canonical header it received from a trusted ingress.
Backend rejects untrusted forwarding data and uses the direct address. IPv4, IPv6, CIDR and
spoofing behavior are release-gated by tests.

## Observability and operations

Backend publishes low-cardinality Micrometer metrics by tier, route group, outcome and store mode:
allowed/rejected, Redis failures, fallback activation, decision latency and active fallback entries.
Nginx exports connection metrics privately and writes a rate-limit-only status log without raw IP
or dynamic paths for Prometheus ingestion. Alertmanager alerts on Redis/fallback activity, proxy
validation failures, 429 ratio spikes, memory pressure and concurrency saturation.

Runbooks cover: a 429 spike (identify tier/route, avoid raising limits before abuse review), Redis
failure (restore store/credentials/capacity; keep sensitive fail-closed), proxy mismatch (disable
forwarded trust and restore canonical edge header), and false positives (inspect request id and
aggregate metrics, never raw identity keys). Load tests run only locally or on approved staging.

Prometheus rules live in `deploy/monitoring/rate-limit-alerts.yml`; the existing Alertmanager must
route `severity=critical`/`warning` to the approved on-call destination. The repository has no
canonical receiver configuration, so that wiring is a deployment-owner gate. Nginx writes only
privacy-safe 429 events to `/var/log/nginx/bigbike-rate-limit.json`; the log pipeline must expose
them as `nginx_rate_limit_responses_total{status="429"}` before the Nginx alert is enabled.

## Configuration

The default policy lives in the backend `RateLimitTier` catalog. Deployments can override one tier
without changing code with `BIGBIKE_RATE_LIMIT_TIERS_<TIER>_LIMIT` and
`BIGBIKE_RATE_LIMIT_TIERS_<TIER>_WINDOW` (for example
`BIGBIKE_RATE_LIMIT_TIERS_LOGIN_LIMIT=5`, `BIGBIKE_RATE_LIMIT_TIERS_LOGIN_WINDOW=1m`). Every
override must remain positive; invalid values fail startup. `BIGBIKE_RATE_LIMIT_STORE=redis`,
`BIGBIKE_RATE_LIMIT_REDIS_URL`, `BIGBIKE_RATE_LIMIT_HMAC_SECRET` and
`BIGBIKE_RATE_LIMIT_FALLBACK_MAX_ENTRIES` are documented in `.env.example`. The bounded
local-entry expiry multiplier is `BIGBIKE_RATE_LIMIT_LOCAL_ENTRY_TTL_MULTIPLIER` (default `2`);
it is a multiple of the tier window, not a request limit. Docker Compose explicitly passes the
documented `BIGBIKE_RATE_LIMIT_TIERS_<TIER>_{LIMIT,WINDOW}` variables through to the backend, so
an approved per-tier override in `.env` reaches Spring rather than silently being ignored.

## 429 spike

1. Identify the tier and route group from `bigbike_rate_limit_requests_total`, then correlate the
   privacy-safe request id with the application log. Do not search or export raw account/IP keys.
2. Check whether the spike is concentrated in a public abuse surface, a real campaign, or one NAT.
3. Keep the current limit while abuse is investigated. Any threshold override needs owner approval,
   a bounded expiry, and a staging load test before production.
4. Confirm browser clients honor `Retry-After`; do not add a blind automatic retry.

## Redis failure

1. Confirm `bigbike_rate_limit_store_errors_total` and Redis health/ACL/TLS/capacity telemetry.
2. Sensitive traffic deliberately stays at HTTP 429; do not disable the limiter to restore it.
   Cart, checkout and public reads can use only their bounded per-JVM emergency bucket.
3. Restore the managed endpoint or fail over according to the Redis provider runbook, then verify
   shared decisions from two staging replicas before clearing the alert.
4. Review Redis eviction policy (`noeviction`), key TTL, memory quota and the deploy's HMAC secret.

## Proxy misconfiguration

1. Compare the versioned Nginx files with `nginx -T` and verify each hop removes incoming XFF and
   writes exactly one canonical address.
2. If the CDN/load-balancer source CIDR is not proven, remove it from `BIGBIKE_TRUSTED_PROXIES`.
   The backend then safely keys on its direct peer until the chain is documented.
3. Test an untrusted request with a forged XFF, IPv4/IPv6 direct traffic and a legitimate trusted
   proxy request before re-enabling forwarding trust.

## False positive

1. Use request id, tier, route group and aggregate counters—not raw identifiers—to understand the
   symptom. Check mobile carrier/NAT clustering before treating it as abuse.
2. For a blocked upload/import/export, check the concurrency rejection metric and wait for active
   work to finish rather than retrying in a loop.
3. If an approved exception is necessary, use a temporary configuration override with a rollback
   time and confirm that the existing IP tier remains in place.
