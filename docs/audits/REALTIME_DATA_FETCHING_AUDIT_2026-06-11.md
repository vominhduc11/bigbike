# BigBike Real-time & Data Fetching Audit Report

> Ngày: 2026-06-11 · Phạm vi: `bigbike-web`, `bigbike-admin`, `bigbike-backend` · Loại: READ-ONLY (không sửa code)
> Mục tiêu: chuẩn hoá 4 cơ chế — **Polling**, **revalidateOnFocus**, **SSE**, **WebSocket** — một cách nhất quán.

---

## 1. Hiện trạng

### bigbike-web (Next.js, `@tanstack/react-query` v5)

**Config toàn cục** — [`bigbike-web/lib/query/client.ts:3-13`](../../bigbike-web/lib/query/client.ts#L3-L13):
```ts
queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false }
```
- `refetchOnWindowFocus` **TẮT toàn cục**. Không có `refetchInterval`, không `gcTime` (mặc định 5m).
- Toàn bộ query/mutation tập trung ở [`lib/query/hooks.ts`](../../bigbike-web/lib/query/hooks.ts), trừ 3 hook inline (snapshot tồn kho, reviews, compare).

| Nhóm data | File | staleTime | Ghi chú |
|---|---|---|---|
| Cart | `hooks.ts:30-93` | 30s | mutation cập nhật qua `setQueryData` |
| Tồn kho biến thể (PDP) | `components/catalog/PurchaseSectionClient.tsx:154-165` | 30s | `refetchOnWindowFocus:false` (override lại lần nữa) |
| Orders / order detail | `hooks.ts:167-180` | global (60s) | không auto-refresh |
| Profile / addresses / wishlist | `hooks.ts:116-190` | global | — |
| Reviews | `ReviewsSection.tsx:453-459` | 5m | — |

- **Real-time: KHÔNG có.** Grep `EventSource | WebSocket | useSWR | refetchInterval` = 0 kết quả.
- **Polling thủ công: KHÔNG có** (các `setInterval`/`setTimeout` đều là UI timer / test helper).
- Tồn kho catalog & PDP render từ props server (`force-dynamic`), tồn theo biến thể mới client-fetch khi user tương tác.
- ⚠️ Cart bị fetch **hai nguồn song song**: React Query (`useCartQuery`) và `lib/cart-context.tsx:31-53` (`fetchCart` raw) → nguy cơ lệch badge giỏ hàng.

### bigbike-admin (React + Vite, `@tanstack/react-query` v5)

**Config toàn cục** — [`bigbike-admin/src/lib/queryClient.js:3-12`](../../bigbike-admin/src/lib/queryClient.js#L3-L12):
```js
queries: { staleTime: 30_000, gcTime: 300_000, retry: 1, refetchOnWindowFocus: false }
```
- Không hook nào set `refetchInterval` / `refetchOnWindowFocus` riêng (grep = 0). Không polling.

**Real-time DUY NHẤT = WebSocket STOMP cho luồng đơn hàng:**
- Client tự viết: [`src/lib/adminWebSocket.js`](../../bigbike-admin/src/lib/adminWebSocket.js) — STOMP-over-WS native, singleton, auto-reconnect 4s, Bearer JWT, path `/ws`.
- Wiring: [`src/App.jsx:283-288`](../../bigbike-admin/src/App.jsx#L283-L288) — connect khi authenticated; **mỗi lần reconnect gọi `queryClient.invalidateQueries()` trần (invalidate TẤT CẢ)**.
- 1 topic duy nhất `/topic/admin/orders`, 3 consumer:
  - `OrderNotificationToast.jsx:57` — toast auto-dismiss 6s.
  - `NotificationBell.jsx:49` — tích vào localStorage + hydrate server qua `fetchAdminNotifications()` (V102) + mark-read.
  - `OrderListScreen.jsx:64-66` — invalidate `['orders']` **chỉ khi đang ở trang đầu filter ALL**.

| Module | Cơ chế | Live? |
|---|---|---|
| Orders list | WS invalidate (trang đầu) | ✅ một phần |
| Order detail (`OrderDetailScreen.jsx:216`) | chỉ staleTime 30s | ❌ không subscribe WS |
| Dashboard metrics (`DashboardScreen.jsx:135-151`) | staleTime 60s, không refetchInterval | ❌ đứng hình tới khi reload |
| Inventory / Warranty / Returns / Serials / Receivables | useAdminList + keepPreviousData | ❌ không push |
| **Reviews, Coupons, Media, Shipping, Customer/Review/Return detail** | `useEffect + fetch` thủ công | ❌ ngoài react-query, mất cache/invalidate |

### bigbike-backend (Spring Boot)

- **WebSocket/STOMP: ĐÃ CÓ, production-ready — nhưng chỉ Order → Admin.**
  - Config [`config/WebSocketConfig.java`](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/WebSocketConfig.java): broker `/topic`, endpoint `/ws`, **CONNECT bắt buộc JWT role ADMIN/SUPER_ADMIN** (line 55-89). Web/khách KHÔNG kết nối được.
  - Sender [`service/ws/AdminOrderWsService.java`](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/ws/AdminOrderWsService.java): push **sau khi commit transaction** + persist notification DB.
  - Event types: `NEW_ORDER`, `ORDER_STATUS_CHANGED`, `ORDER_PAYMENT_STATUS_CHANGED`, `ORDER_REFUND_CREATED`, `ORDER_NOTE_ADDED`.
- **Notification domain (admin-only, gắn cứng order):** entity `admin_notifications` (V102), endpoints `/api/v1/admin/notifications` (list-unread / mark-read / mark-all-read), permission `orders.read`.
- **SSE: KHÔNG có.** **Spring ApplicationEvent: KHÔNG dùng** — domain push là method call trực tiếp tới WS service.
- **Stock/inventory: KHÔNG có event/push nào** khi trừ tồn / low-stock / hết hàng. `LOW_STOCK` chỉ là enum hiển thị.
- **Scheduled jobs (5):** receivable digest, auto-cancel BACS, serial cleanup, coupon expiry, idempotency cleanup — **không job nào push WS**. ⚠️ Auto-cancel đổi trạng thái đơn nhưng **không báo realtime cho admin**.

---

## 2. Vấn đề phát hiện

| # | Vấn đề | Mức | Vị trí |
|---|---|---|---|
| P1 | `refetchOnWindowFocus:false` toàn cục cả 2 app → cart/order/stock stale khi user quay lại tab | Cao | `client.ts:11`, `queryClient.js:8` |
| P2 | Web không có bất kỳ kênh real-time nào → tồn kho/đơn chỉ tươi khi F5 | Cao | bigbike-web (toàn bộ) |
| P3 | Order detail (admin) không subscribe WS → admin xem 1 đơn không thấy thay đổi live | Trung | `OrderDetailScreen.jsx:216` |
| P4 | `invalidateQueries()` trần khi WS reconnect → burst refetch toàn màn mỗi lần mạng chập chờn | Trung | `App.jsx:286` |
| P5 | Dashboard metrics không refetchInterval + không focus-refetch → "đứng hình" | Trung | `DashboardScreen.jsx:135-151` |
| P6 | 6+ module admin dùng `useEffect+fetch` thủ công, ngoài react-query → mất cache/dedupe/invalidate | Trung | Reviews, Coupons, Media, Shipping, Customer/Review/Return detail |
| P7 | Auto-cancel scheduler đổi trạng thái đơn nhưng không push WS | Thấp | `OrderAutoCancelScheduler.java:22` |
| P8 | Cart web fetch 2 nguồn song song (RQ + cart-context raw) → lệch badge | Thấp | `cart-context.tsx:31-53` |
| P9 | Stock không có push → shop bán online + walk-in (POS) có thể oversell hiển thị | Trung | backend (không có hook) |

**Không phát hiện anti-pattern nghiêm trọng** (polling vô tận, fetch-in-render). Kiến trúc gọn; vấn đề chủ yếu là **thiếu freshness** chứ không phải lạm dụng.

---

## 3. Đề xuất theo use case

### Nguyên tắc phân loại (theo bảng quyết định)

| Loại data | Cơ chế |
|---|---|
| Stale khi rời tab (cart, session, wishlist, đơn đang xem) | **revalidateOnFocus** |
| Đổi định kỳ, không cần instant (dashboard metrics, low-stock count) | **Polling** ≥60s |
| Server push 1 chiều (đơn mới, đổi trạng thái, tồn thấp) | **SSE** (ưu tiên) hoặc tận dụng **WS** đã có |
| 2 chiều cùng kênh real-time | **WebSocket** (chỉ khi thật cần) |

### bigbike-web

| Use case | File hiện tại | Cơ chế đề xuất | Thay đổi cần làm |
|---|---|---|---|
| Cart / coupon | `lib/query/hooks.ts:30-93` | **revalidateOnFocus ON** | Set `refetchOnWindowFocus:true` cho riêng query `["cart"]` (override per-query, không đổi global) |
| Wishlist / orders / order detail | `hooks.ts:167-190` | **revalidateOnFocus ON** | Bật focus-refetch cho nhóm customer; order detail thêm `refetchOnWindowFocus:true` |
| Tồn kho biến thể PDP | `PurchaseSectionClient.tsx:154-165` | **revalidateOnFocus ON** + (giai đoạn 2) **SSE stock** | Bỏ `refetchOnWindowFocus:false` override (dòng 163); cân nhắc subscribe SSE tồn kho khi backend có |
| Theo dõi trạng thái đơn (trang xác nhận / tài khoản) | `hooks.ts:174-180` | **SSE customer** (giai đoạn 2) | Cần backend mở topic/endpoint cho customer (xem mục backend) |
| Hợp nhất nguồn cart | `cart-context.tsx:31-53` | refactor | Bỏ `fetchCart` raw, đọc count từ React Query cache `["cart"]` |

> Web **không nên dùng WebSocket** (khách ẩn danh, không JWT admin). Nếu cần push → **SSE** (kết nối 1 chiều, qua HTTP, không cần auth admin, cache/proxy-friendly).

### bigbike-admin

| Use case | File hiện tại | Cơ chế đề xuất | Thay đổi cần làm |
|---|---|---|---|
| Order detail live | `OrderDetailScreen.jsx:216` | **WS (đã có)** | Subscribe `/topic/admin/orders`, lọc theo `orderId` → invalidate `['order',id]` |
| Reconnect invalidate | `App.jsx:286` | thu hẹp | Thay `invalidateQueries()` trần bằng invalidate theo nhóm thật sự cần (`['orders']`, `['nav-badge']`, dashboard) |
| Dashboard metrics | `DashboardScreen.jsx:135-151` | **Polling 60-120s** + revalidateOnFocus | Thêm `refetchInterval` cho 4 summary query; bật focus-refetch riêng |
| Nav badges (đơn chờ, trả hàng) | `lib/useNavBadges.js:12-21` | tận dụng **WS** + polling fallback | Invalidate badge khi có WS order event; polling 60s dự phòng |
| Tồn thấp (Dashboard/Inventory) | `DashboardScreen.jsx:146`, `InventoryScreen.jsx` | **SSE/WS stock** (giai đoạn 2) hoặc Polling 60s | Cần backend phát event stock (chưa có) |
| Reviews/Coupons/Media/Shipping/detail | `useEffect+fetch` | chuẩn hoá **react-query** | Chuyển sang `useQuery` để hưởng cache + reconnect-invalidate (không phải real-time nhưng là tiền đề) |

### bigbike-backend — endpoint cần thêm/sửa

| Hạng mục | Method / Topic | Phục vụ cho | Trạng thái |
|---|---|---|---|
| `/topic/admin/orders` | WS STOMP | Toast/Bell/OrderList admin | ✅ đã có |
| `/api/v1/admin/notifications` | GET/POST | Hydrate + mark-read | ✅ đã có |
| **WS push trong auto-cancel** | gọi `pushEvent(ORDER_STATUS_CHANGED)` | Admin biết đơn bị job hủy | ❌ cần thêm tại `OrderAutoCancelScheduler.java:22` |
| **Topic/notification stock** | `/topic/admin/inventory` (LOW_STOCK / OUT_OF_STOCK) | Cảnh báo tồn admin | ❌ cần build; generalize notification schema (đang gắn cứng `orderId`) |
| **SSE customer order tracking** | `GET /api/v1/orders/{id}/events` (text/event-stream) | Khách theo dõi đơn live | ❌ cần build (WS hiện chặn non-admin) |
| **SSE stock cho web PDP** | `GET /api/v1/products/{id}/stock/events` | Tồn kho live trên PDP | ❌ tuỳ chọn giai đoạn 2 |

---

## 4. Implementation plan (ưu tiên theo impact)

**Quick wins (config, không cần backend mới):**
1. **Bật `refetchOnWindowFocus` per-query** cho cart/order/wishlist/stock ở web + dashboard/order-detail ở admin (P1, P2, P3). Override từng query, **giữ nguyên global `false`**.
2. **Order detail admin subscribe WS** đã có sẵn → live ngay (P3).
3. **Dashboard polling 60-120s** + nav-badge invalidate theo WS order event (P5).
4. **Thu hẹp reconnect-invalidate** ở `App.jsx:286` (P4).
5. **Hợp nhất nguồn cart** web về 1 nguồn React Query (P8).

**Infrastructure (cần backend):**
6. **WS push cho auto-cancel scheduler** (P7) — 1 dòng `pushEvent`, low-risk.
7. **Chuẩn hoá 6 module admin** từ `useEffect+fetch` → react-query (P6) — tiền đề cho reconnect-invalidate hoạt động đồng đều.
8. **Generalize notification schema** + topic `/topic/admin/inventory` cho cảnh báo tồn thấp (P9).
9. **SSE customer** cho order tracking / stock PDP (P2) — hạng mục lớn nhất, chỉ làm khi nghiệp vụ yêu cầu khách xem live.

**Thứ tự đề xuất:** 1→2→3→4→5 (1 PR config/wiring) → 6 (1 PR nhỏ) → 7 (chuẩn hoá data layer) → 8 → 9.

---

## 5. Shared hooks đề xuất tạo

| Hook / util | App | Mục đích |
|---|---|---|
| `useFocusRefetch(queryKey)` hoặc preset option `freshOnFocus` | web + admin | Gói `refetchOnWindowFocus:true` để bật per-query nhất quán, không sửa global |
| `useAdminOrderEvents(handler)` | admin | Wrapper quanh `subscribeAdminWs('/topic/admin/orders')` — hiện 3 nơi tự subscribe; gom 1 hook lọc theo type/orderId |
| `useDashboardPolling(interval=90s)` | admin | Chuẩn hoá `refetchInterval` cho nhóm summary |
| `useOrderTrackingSSE(orderId)` | web | (giai đoạn 2) `EventSource` tới `/api/v1/orders/{id}/events`, auto-reconnect, push vào RQ cache |
| `useStockSSE(productId)` | web | (giai đoạn 2) tồn kho live PDP |
| `AdminWsProvider` + invalidation registry | admin | Thay `invalidateQueries()` trần bằng map event→queryKey |

---

### Phụ lục — Ràng buộc tuân thủ

- Web: **không dùng WebSocket** (khách ẩn danh) → mọi push web đi qua **SSE**.
- Admin: **tái dùng WS STOMP đã có**, không dựng kênh mới trừ khi cần domain ngoài order.
- Polling: web ≥30s (flash sale ngoại lệ), dashboard ≥60s.
- Ưu tiên **SSE trước WebSocket**; WS chỉ giữ ở admin vì đã tồn tại và cần auth-scoped.

*Báo cáo READ-ONLY — không file nào bị sửa trong quá trình audit.*
