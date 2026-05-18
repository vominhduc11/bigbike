# HOMEPAGE CONSOLE 401 — FIX PLAN

> **Phase:** Điều tra & xử lý lỗi console `401` xuất hiện trên mọi viewport homepage `bigbike-web`.
> **Ngày:** 2026-05-18
> **Ràng buộc:** không refactor lớn · không đổi business logic / API contract chưa có root cause · không hardcode token/session · không che lỗi bằng `console.clear()`/swallow bừa.

---

## 1. Evidence (reproduce bằng Playwright — guest, chưa đăng nhập)

Bắt toàn bộ response trên homepage guest (load + mở search + account + burger + scroll):

| Thuộc tính | Giá trị |
|---|---|
| **Endpoint** | `GET http://localhost:8080/api/v1/customer/me` |
| **Method** | GET |
| **Status** | `401` |
| **Resource type** | `fetch` |
| **Request `Authorization` header** | (none) |
| **Request `Cookie` header** | (none) — guest không có cookie nào |
| **Response body** | `{"error":{"code":"UNAUTHORIZED","message":"Authentication required."},"meta":{...}}` |
| **Số request 401** | **Đúng 1** — chỉ `/customer/me`. Không có request private nào khác (cart, wishlist, orders) bị 401. |
| **Thời điểm** | Khi hydrate client lúc load homepage. Mở search / account / burger / scroll **không** phát sinh thêm 401. |
| **Console** | 1 dòng `Failed to load resource: the server responded with a status of 401 ()` — do **trình duyệt** tự log response fetch thất bại, không phải app code log. |

---

## 2. Trace frontend

```
HomePage (server) → <SiteHeader> → <HeaderUserMenu> (client)
  → useAuth()                              [lib/auth/auth-store.ts]
  → useSyncExternalStore(subscribeWithRefresh, …)
  → subscribeWithRefresh(): nếu state="loading" → refreshAuth()
  → refreshAuth() → fetchMe()              [lib/api/client-api.ts]
  → clientRequest("GET", "/api/v1/customer/me")  — fetch credentials:"include"
  → backend trả 401 (guest không có session cookie)
  → refreshAuth().catch() → setState({status:"anonymous"})   ← app xử lý ĐÚNG
  → nhưng trình duyệt đã log "Failed to load resource: 401"   ← console noise
```

**Mô hình auth (xác nhận từ backend `config/CustomerAuthCookies.java`):** auth dùng **cookie**, không dùng Bearer token / localStorage:
- `bb_session` — **httpOnly = true** — set khi login, dùng để xác thực.
- `bb_refresh` — httpOnly = true — path `/api/v1/customer/auth/refresh`.
- `bb_csrf` — **httpOnly = false (JS đọc được)** — set **chỉ khi login** (`applySession`), **xoá khi logout** (`clearSession`), path `/`, TTL bằng `bb_session`.

→ `bb_csrf` là **chỉ báo đáng tin** cho trạng thái đã-đăng-nhập mà frontend đọc được: **guest = không có `bb_csrf`**, **logged-in = có `bb_csrf`**. Frontend đã đọc cookie này sẵn trong `getCsrfToken()`.

Frontend **không có auto-refresh-on-401** (`/auth/refresh` không được gọi ở đâu trong `lib/`/`components/`/`app/`). Guest và user hết hạn session hiện tại đều cùng kết cục `anonymous` qua nhánh `.catch()`.

---

## 3. Phân loại

`/api/v1/customer/me` trả `CustomerProfile` — **dữ liệu cá nhân**. Backend yêu cầu xác thực → **401 cho guest là ĐÚNG** theo business rule. Đây **không phải bug backend** (không phải Case C). Endpoint phải giữ private.

→ Đây là **Case A + Case B**: 401 là *expected guest behavior*, nhưng frontend gọi 1 request private **không cần thiết** khi đã biết chắc là guest (có thể biết qua cookie `bb_csrf`). App xử lý 401 đã sạch (`catch → anonymous`), chỉ thừa cái request gây console noise.

---

## 4. Bảng kế hoạch

| Endpoint | Triggered By | Current Behavior | Expected Behavior | Root Cause | Fix Type | Will Fix Now? |
|---|---|---|---|---|---|---|
| `GET /api/v1/customer/me` | `auth-store.refreshAuth()` qua `useAuth()` trong `HeaderUserMenu` (mọi trang) | Guest cũng gọi `/me` → backend 401 → trình duyệt log console error; app `catch` → `anonymous` | Guest **không gọi** `/me`; suy ra `anonymous` ngay từ việc không có cookie `bb_csrf`. Logged-in vẫn gọi `/me` bình thường | Frontend gọi private endpoint khi guest dù có thể biết trước là guest qua cookie `bb_csrf` (non-httpOnly) | **FRONTEND_GUARD** | ✅ YES |
| `GET /api/v1/customer/me` | `lib/query/hooks.ts useProfile()` (TanStack Query) | Chỉ chạy ở các trang tài khoản (`/tai-khoan*`), **không chạy ở homepage** | Giữ nguyên — ngoài phạm vi homepage 401 | Không phải nguồn lỗi homepage | OUT_OF_SCOPE (ghi nhận) | ❌ NO |
| Backend security `/customer/me` | — | Yêu cầu session, trả 401 cho guest | **Đúng** — giữ private (trả `CustomerProfile`) | Không phải lỗi | — (không sửa) | ❌ NO |

---

## 5. Giải pháp sẽ thực hiện

**FRONTEND_GUARD trong `lib/auth/auth-store.ts`** — `refreshAuth()` kiểm tra cookie `bb_csrf` trước khi gọi `fetchMe()`:
- Không có `bb_csrf` → chắc chắn guest → `setState({status:"anonymous"})`, **không gọi `/me`**.
- Có `bb_csrf` → gọi `fetchMe()` như cũ (logged-in thật, hoặc kiểm tra session hết hạn).

**Không làm:**
- ❌ Không đổi backend security / API contract.
- ❌ Không hardcode token/session.
- ❌ Không `console.clear()` / không nuốt lỗi — nhánh `.catch()` xử lý 500/lỗi mạng vẫn giữ nguyên; chỉ tránh request thừa.
- ❌ Không đụng UI homepage, cart, search, mega menu, footer.

**Vì sao an toàn:**
- Logged-in: có `bb_csrf` → `/me` vẫn chạy → state `authenticated` không đổi.
- Login/Register/Logout: `LoginForm`/`RegisterForm` gọi `refreshAuth()` *sau khi* cookie `bb_csrf` đã được set/xoá → vẫn đúng.
- Không có auto-refresh-on-401 trong frontend nên việc bỏ request guest không mất tính năng nào.
- Phát hiện lỗi thật (500/network) khi user *thực sự* có session vẫn nguyên qua `.catch()`.
