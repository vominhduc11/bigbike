# Feature audit — rate limiting (2026-08-12)

Scope: client → nginx → storefront BFF/admin proxy → backend → Redis, database, MinIO, mail,
external OAuth and WebSocket. Canonical policy is `docs/engineering/RATE_LIMITING.md`.

### F1 — Nginx throttling was presented as maintenance
- **Mức độ:** Blocker
- **Lệch ở đâu:** nginx's default rate-limit status was `503`, which matched the static outage
  handler instead of the API rate-limit contract.
- **Bằng chứng:** runtime `/etc/nginx/conf.d/shared-config.conf`; runtime
  `/etc/nginx/sites-available/bigbike.vn.nextjs`; 51 `limiting requests` events and 51 `503`
  responses observed during read-only audit.
- **Rule liên quan:** `RATE_LIMITING.md` “Response contract”.
- **Hậu quả vận hành:** khách bị chặn nhìn thấy thông báo hệ thống hỏng/bảo trì thay vì biết thử
  lại sau.
- **Trạng thái:** Đã có config repository và test plan; phải xác nhận `nginx -T` sau deploy.

### F2 — Forwarded client identity could be spoofed on the running topology
- **Mức độ:** High
- **Lệch ở đâu:** runtime proxy appended incoming `X-Forwarded-For`, while backend trusted a broad
  Docker CIDR and consumed the first forwarded address.
- **Bằng chứng:** runtime API/admin nginx vhosts; `RateLimitingFilter.java` and
  `ClientIpResolver.java` before this change.
- **Rule liên quan:** `RATE_LIMITING.md` “Proxy and client identity”; `DEPLOYMENT_GUIDE.md`
  “Security Hardening Config”.
- **Hậu quả vận hành:** kẻ xấu có thể thay đổi khóa IP để né giới hạn.
- **Trạng thái:** Đã sửa repository code/config. Việc chốt CIDR của CDN/load balancer còn là
  deployment gate, không tự suy đoán.

### F3 — Backend limits reset per instance and missed costly surfaces
- **Mức độ:** High
- **Lệch ở đâu:** Bucket4j state chỉ ở RAM và route map không bao gồm chat lead, upload/import/
  export, internal API và WebSocket controls.
- **Bằng chứng:** `RateLimitingFilter.java`; `WebSocketConfig.java`; controller inventory.
- **Rule liên quan:** `RATE_LIMITING.md` “Policy catalog”.
- **Hậu quả vận hành:** restart/scale-out làm yếu kiểm soát, còn email, MinIO, database và OAuth
  provider có thể bị gọi quá mức.
- **Trạng thái:** Đã triển khai Redis-backed policy catalog/fallback và coverage tests; managed HA
  Redis/failover vẫn phải được kiểm thử trên staging trước production.

