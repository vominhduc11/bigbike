# Homepage Console 401 Fix Report

> **Phase:** Điều tra & xử lý lỗi console `401` trên homepage `bigbike-web`.
> **Ngày:** 2026-05-18
> **Liên quan:** [HOMEPAGE_CONSOLE_401_FIX_PLAN.md](HOMEPAGE_CONSOLE_401_FIX_PLAN.md) · [HOMEPAGE_P3_POLISH_REPORT.md](HOMEPAGE_P3_POLISH_REPORT.md)
> **Ràng buộc đã tuân thủ:** không refactor lớn · không đổi business logic / API contract · không sửa backend · không hardcode token/session · không `console.clear()` / không nuốt lỗi.

---

## 1. Summary

- **Endpoint gây 401:** `GET /api/v1/customer/me` — và **chỉ** endpoint này (đúng 1 request/lần load homepage).
- **401 là expected hay bug:** **Expected** — `/customer/me` trả `CustomerProfile` (dữ liệu cá nhân), backend yêu cầu xác thực; guest không có session → 401 là **đúng nghiệp vụ**. Backend **không sai**.
- **Bản chất vấn đề:** frontend gọi endpoint private này **cả khi là guest**, dù có thể biết trước chắc chắn là guest qua cookie `bb_csrf`. Request 401 thừa đó bị **trình duyệt** tự log `Failed to load resource: 401` ra console.
- **Đã sửa ở:** **frontend** — 1 file ([`lib/auth/auth-store.ts`](../../bigbike-web/lib/auth/auth-store.ts)). Thêm guard: chỉ gọi `/customer/me` khi có cookie `bb_csrf`. **Không sửa backend.**
- **Còn 401 nào không:** **Không** — guest load homepage giờ phát sinh **0** request `/me`, **0** response 401, **0** console error.

---

## 2. Root Cause

```
HomePage (server component)
  → <SiteHeader> → <HeaderUserMenu>  (client component)
    → useAuth()                                  [lib/auth/auth-store.ts]
    → useSyncExternalStore(subscribeWithRefresh)
    → subscribeWithRefresh(): state="loading" → refreshAuth()
    → refreshAuth() → fetchMe()                  [lib/api/client-api.ts]
    → fetch("GET /api/v1/customer/me", credentials:"include")
    → backend: guest không có cookie bb_session → HTTP 401 UNAUTHORIZED
    → app: refreshAuth().catch() → setState({status:"anonymous"})   ✅ xử lý đúng
    → NHƯNG: trình duyệt đã log "Failed to load resource: 401"      ❌ console noise
```

**Vì sao guest vẫn gọi `/me`:** auth của customer dùng **cookie** (`config/CustomerAuthCookies.java`), không dùng Bearer token. Cookie xác thực `bb_session` là **httpOnly** — JS không đọc được — nên trước đây frontend "không biết" user là guest hay không, phải gọi `/me` để dò.

**Mấu chốt giải pháp:** cookie `bb_csrf` được set **cùng lúc** với `bb_session` khi đăng nhập (`applySession`), bị xoá khi logout (`clearSession`), TTL bằng `bb_session`, và **`httpOnly = false`** → **JS đọc được**. Vậy `bb_csrf`:
- **Vắng mặt** → khách chắc chắn chưa đăng nhập (guest).
- **Có mặt** → có phiên đăng nhập → cần gọi `/me`.

Frontend **không có** auto-refresh-on-401 (`/auth/refresh` không được gọi ở đâu trong `lib/`/`components/`/`app/`), nên bỏ request `/me` cho guest không làm mất tính năng nào.

---

## 3. Files Changed

| File | Change | Reason |
|---|---|---|
| [`bigbike-web/lib/auth/auth-store.ts`](../../bigbike-web/lib/auth/auth-store.ts) | Thêm helper `hasSessionHint()` (đọc cookie `bb_csrf`); `refreshAuth()` kiểm tra trước — không có `bb_csrf` → set `anonymous` ngay, **không gọi `fetchMe()`** | Guard FRONTEND: tránh request private `/customer/me` không cần thiết khi guest → hết 401 → hết console error |

**Không sửa:** backend, security config, API contract, UI homepage, cart, search, mega menu, footer. Tổng cộng **1 file, +14 dòng**.

Trích đoạn logic thêm vào:
```ts
function hasSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)bb_csrf=[^;]/.test(document.cookie);
}

export function refreshAuth(): Promise<void> {
  if (inflight) return inflight;
  if (!hasSessionHint()) {            // guest chắc chắn → không gọi /me
    setState({ status: "anonymous" });
    return Promise.resolve();
  }
  inflight = fetchMe() ...            // logged-in → giữ nguyên flow cũ
}
```

---

## 4. Behavior Before / After

| Scenario | Before | After |
|---|---|---|
| **Guest load homepage** | Gọi `GET /customer/me` → 401 → console log `Failed to load resource: 401`; app `catch` → `anonymous` | **Không** gọi `/customer/me`; suy ra `anonymous` ngay từ việc không có `bb_csrf`; **0 request 401, 0 console error** |
| **Guest mở account dropdown** | Dropdown guest hiển thị (Đăng nhập / Đăng ký); 401 đã xảy ra từ lúc load | Dropdown guest hiển thị y hệt; **không** có 401 |
| **Guest mở cart** | Không phát sinh 401 (cart icon không fetch private endpoint khi ở homepage) | Không đổi — vẫn không 401 |
| **Logged-in load homepage** | Có `bb_csrf` + `bb_session` → gọi `/customer/me` → 200 → state `authenticated` | **Không đổi** — có `bb_csrf` → vẫn gọi `/me` → 200 → `authenticated` |
| **Login / Register / Logout** | `LoginForm`/`RegisterForm`/`performLogout` gọi `refreshAuth()` | Không đổi — `refreshAuth()` chạy *sau khi* `bb_csrf` đã được set (login) hoặc xoá (logout) nên `hasSessionHint()` cho kết quả đúng |
| **Session hết hạn (cookie còn)** | `/me` → 401 → `anonymous` | `bb_csrf` & `bb_session` cùng TTL → hết hạn cùng lúc; nếu cookie còn → `/me` vẫn chạy → 401 → `anonymous` (giữ nguyên) |

---

## 5. Verification

| Hạng mục | Kết quả |
|---|---|
| **Build** | ✅ PASS — `npm run build` (Next.js 16.2.4), không lỗi. |
| **Lint** | ✅ PASS — `eslint lib/auth/auth-store.ts`, exit 0. |
| **Test** | ⚠️ 94/95 pass. 1 fail: `__tests__/schemas/auth.test.ts > loginSchema` — **pre-existing**, đã fail từ Phase P3, **không liên quan** thay đổi này (auth schema, không phải auth-store). Không phát sinh fail mới. |
| **Browser console — guest** | ✅ **0 console error** (trước: 1 lỗi 401). |
| **Network — guest** | ✅ **0 request `/customer/me`**, **0 response 401** (probe Playwright: load + mở search + account + burger + scroll). |
| **Network — logged-in path** | ✅ Probe với cookie `bb_csrf` có mặt: `/customer/me` **vẫn được gọi 1 lần** → xác nhận guard không chặn nhầm luồng đăng nhập. |
| **Screenshot/log** | [`docs/audits/homepage-console-401-after/`](homepage-console-401-after/) — `guest-*`, `with-bb_csrf-*`, `_401-verify-log.txt`. |

**Evidence chính (`_401-verify-log.txt`):**
```
[guest]        /customer/me requests: 0 (statuses: none)
[guest]        total 401 responses: 0
[guest]        console errors: 0
[with-bb_csrf] /customer/me requests: 1 (statuses: 401)   ← guard cho phép gọi khi có session hint
```
> Lưu ý: scenario `with-bb_csrf` dùng token giả (không có `bb_session` thật) nên `/me` trả 401 — đây là *chủ đích của probe* để chứng minh request **vẫn được gửi** khi có hint. User đăng nhập thật (có cả `bb_csrf` + `bb_session`) sẽ nhận 200, không có lỗi console.

---

## 6. Regression Check

Kiểm tra qua probe + screenshot (`homepage-console-401-after/`):

| Khu vực | Kết quả |
|---|---|
| **Homepage visual parity** | ✅ Không đổi — `guest-homepage-top.png` render đầy đủ hero / featured grid / sections. |
| **Header sticky** | ✅ Không đụng. |
| **Search overlay** | ✅ Không đụng — mở/đóng bình thường trong probe. |
| **Account dropdown** | ✅ Guest dropdown hiển thị đúng (`guest-account-dropdown.png`); logged-in path còn nguyên (xác nhận `/me` vẫn được gọi khi có `bb_csrf`). |
| **Cart display** | ✅ Không đụng. |
| **Mega menu** | ✅ Không đụng. |
| **Burger drawer** | ✅ Không đụng — mở/đóng bình thường trong probe. |
| **Footer** | ✅ Không đụng. |

→ Thay đổi khu trú trong `auth-store.ts`; **không regression**.

---

## 7. Remaining Risks

- **`useProfile()` trong `lib/query/hooks.ts`** cũng gọi `fetchMe()` — nhưng chỉ chạy ở các trang tài khoản (`/tai-khoan*`), **không chạy ở homepage**, nên không thuộc phạm vi lỗi này. Các trang tài khoản vốn auth-gated; nếu muốn cũng làm sạch console 401 ở đó, có thể áp cùng guard `hasSessionHint()` trong một task nhỏ riêng — **không bắt buộc, không khẩn**. Ghi nhận: không phải rủi ro chặn production.
- **AUTH_FLOW_NEEDS_CONFIRMATION:** không. Luồng auth không đổi; chỉ bỏ 1 request thừa cho guest.
- **CART_GUEST_FLOW_NEEDS_CONFIRMATION:** không phát sinh — cart không nằm trong chuỗi 401 này (probe xác nhận chỉ `/me` bị 401).
- **BACKEND_SECURITY_REVIEW_REQUIRED:** không — `/customer/me` đã được bảo vệ đúng (private, trả `CustomerProfile`); không mở public, không đổi security.

---

## 8. Final Verdict

- **Console 401 đã sạch** trên homepage cho guest: 0 request `/me`, 0 response 401, 0 console error. Luồng đăng nhập (logged-in) được xác nhận không ảnh hưởng.
- **Homepage đã đủ điều kiện cho vòng final review với stakeholder** — kết hợp với kết quả P1/P2/P3: visual parity cao, không lỗi layout, không horizontal overflow, console sạch.
- **Task riêng cần tách ra:** không có task auth/cart bắt buộc. Tùy chọn (không khẩn): áp cùng guard cho `useProfile()` ở trang tài khoản để console các trang đó cũng sạch — gom vào một task polish nhỏ sau này nếu muốn.
- **Lưu ý vận hành (không phải lỗi code):** các hạng mục DATA/admin từ các phase trước vẫn cần xử lý trước production — menu chính (4 mục), category homepage (8 ô), promo banner asset — xem [HOMEPAGE_P2_FIX_REPORT.md](HOMEPAGE_P2_FIX_REPORT.md) / [HOMEPAGE_P3_POLISH_REPORT.md](HOMEPAGE_P3_POLISH_REPORT.md).

---

*Hết báo cáo. Lỗi 401 được xác định là expected guest behavior; xử lý bằng 1 guard frontend (1 file, +14 dòng) để loại request thừa — không sửa backend, không đổi contract, không hardcode, không nuốt lỗi.*
