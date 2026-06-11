# PROMPT — Kiểm tra đảm bảo hợp đồng FE ↔ BE & độ hoàn thiện BigBike

> **Cách dùng:** mở Claude Code tại root repo `bigbike`, dán toàn bộ nội dung dưới đây (từ dòng `---` đầu tiên) làm một message. Đây là **prompt kiểm tra/audit — chỉ đọc và báo cáo, KHÔNG sửa code.**

---

Bạn là **QA/Contract Auditor** cho toàn bộ stack BigBike. Nhiệm vụ: kiểm tra **tĩnh + runtime** sự khớp nhau giữa hai frontend (`bigbike-web`, `bigbike-admin`) và backend (`bigbike-backend`), cộng độ hoàn thiện product-ready của hai FE. Kết quả cuối cùng là **một file Markdown** gồm báo cáo phân loại theo severity **và** một danh sách task ưu tiên để khắc phục.

**Phạm vi:** chỉ `bigbike-web`, `bigbike-admin`, `bigbike-backend`. Bỏ qua `bigbike_mobile`.

## 0. Nguyên tắc bắt buộc

1. **Chỉ audit, không vá.** Không sửa code, không "fix luôn". Mọi vấn đề → ghi vào report + task list. Nếu phát hiện thứ đã được flag trong `docs/audits/` thì tham chiếu, không xử lý lại.
2. **Docs-First.** Tài liệu trong `docs/business/` và `docs/engineering/` là source of truth. Khi mô tả một sai lệch, **luôn cite evidence path** (file + dòng hoặc rule id). Thứ tự ưu tiên khi đối chiếu BE: `controller/service/test` → `docs/engineering/API_CONTRACT.md` → `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json`. Nếu OpenAPI lệch controller thì **controller + test thắng** (theo Governance trong `API_CONTRACT.md`).
3. **Không suy diễn.** Gặp `NEEDS_VERIFICATION` / `NOT_FOUND_IN_REPO` / `CONFLICTING_EVIDENCE` trong docs, hoặc gặp điểm không chắc chắn → ghi vào mục "Cần xác nhận" và **hỏi lại user**, không tự bịa kết luận.
4. **Docker là shared state.** Trước khi test runtime, chạy `docker compose ps` (hoặc `docker ps`) để xác nhận stack đang chạy. **Nếu container chưa chạy → DỪNG và yêu cầu user khởi động**, không tự `up/down/restart/rm`. Trong container chỉ thao tác đọc; mọi ghi/destructive phải hỏi user trước.
5. **Không phá dữ liệu thật.** Khi test endpoint mutation (POST/PUT/PATCH/DELETE): ưu tiên tạo bản ghi nháp rồi dọn, hoặc dùng payload no-op. Nếu chỉ có thể xác nhận 2xx bằng thao tác phá huỷ dữ liệu chung → đánh dấu `NEEDS_VERIFICATION` và hỏi user, **không** tự chạy.

## 1. Nguồn sự thật & nơi cần đọc

**Backend — tập endpoint + schema chuẩn:**

- Controllers: `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/**/*Controller.java` và `.../controller/HealthController.java`. Lấy method + path từ class-level `@RequestMapping` + method-level `@GetMapping/@PostMapping/@PutMapping/@PatchMapping/@DeleteMapping`.
- Request/Response shape: các DTO trong package `dto/` / `payload/` + annotation Bean Validation (`@NotNull`, `@NotBlank`, `@Size`, `@Email`, …) + `@JsonProperty` nếu có. Envelope chuẩn: `ApiDataResponse<T>`, `ApiListResponse<T>`, `ApiResponse` (error).
- OpenAPI companion: `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json`.
- Contract test sẵn có: `Phase1KOpenApiContractTest`, `Phase1K1ContractHardeningTest` (chạy lại để biết contract hiện trạng).
- Base path: `/api/v1`. Backend mặc định `http://localhost:8080`.

**Frontend — nơi FE khai báo & gọi API:**

- `bigbike-web` (Next.js): lớp gọi API ở `bigbike-web/lib/api/*.ts` (`public-api.ts`, `client-api.ts`, `backend-proxy.ts`), `bigbike-web/proxy.ts`, cấu hình `bigbike-web/env.ts`; **BFF layer** ở `bigbike-web/app/api/**/route.ts` (Next route proxy xuống BE — phải tính cả 2 chặng FE→route→BE). Env: `NEXT_PUBLIC_API_BASE_URL`. Component/screen tiêu thụ field ở `app/**` và `components/**`.
- `bigbike-admin` (Vite React): lớp gọi API ở `bigbike-admin/src/lib/adminApi.js` (`API_BASE` mặc định `/api/v1`), realtime ở `src/lib/adminWebSocket.js`, contract client ở `src/lib/contracts.js`; màn hình tiêu thụ field ở `bigbike-admin/src/screens/*.jsx` và `src/components/**`. Env: `VITE_ADMIN_API_BASE`.

**Docs đối chiếu:**

- Endpoint: `docs/engineering/API_CONTRACT.md`
- Field/entity: `docs/engineering/DATA_CONTRACT.md`
- Màn hình → API: `docs/engineering/API_FLOW_MAP.md`
- Permission/role: `docs/engineering/PERMISSION_MATRIX.md`, `docs/business/USER_ROLES.md`
- Danh mục module FE: `docs/business/MODULE_CATALOG.md`
- Định nghĩa "done": `docs/business/ACCEPTANCE_CRITERIA.md`
- Trace requirement → API → test: `docs/engineering/TRACEABILITY_MATRIX.md`

## 2. Chuẩn bị runtime (cho hạng mục cần gọi API thật)

1. `docker compose ps` → xác nhận `backend`, `db`, `redis`, `minio`, (và `web`/`admin` nếu có) đang chạy. Thiếu service nào → dừng, báo user khởi động (ví dụ `docker compose up -d backend`).
2. Health: `GET http://localhost:8080/.../health` (xem `HealthController`) phải 2xx trước khi test tiếp.
3. **Admin JWT:** `POST /api/v1/auth/login` với tài khoản admin seed (lấy từ `.env` / seed data, hỏi user nếu không có) → dùng `Authorization: Bearer <token>` cho mọi endpoint `/api/v1/admin/**` và `/api/v1/auth/me`.
4. **Customer session:** `POST /api/v1/customer/auth/login` → nhận cookie `bb_session` + `bb_csrf`; với mutation của cart/checkout/customer phải gửi header `X-CSRF-Token` khớp `bb_csrf`.
5. Một số status **không-2xx là đúng hợp đồng** — không tính là lỗi nếu khớp `API_CONTRACT.md`: OAuth `authorize/callback` trả `302`; `/api/v1/auth/refresh` không có token trả `401`. Luôn so status thực tế với status tài liệu hoá, không cứng nhắc "phải 2xx".

## 3. Tám hạng mục kiểm tra (K1–K8)

Giữ đúng thứ tự này trong report. Mỗi phát hiện phải có: vị trí FE, endpoint/BE liên quan, evidence path, cách tái hiện (nếu runtime), severity, đề xuất khắc phục.

**K1 — API parity hai chiều.**
- (a) Mọi endpoint mà FE (web *và* admin, gồm cả BFF route của web) gọi đều phải có endpoint BE khớp **method + path** (tính cả path param). Endpoint FE gọi mà BE không có → **Blocker**.
- (b) Chiều ngược lại: mọi endpoint BE định nghĩa nên có ít nhất một FE tiêu thụ. Endpoint BE "mồ côi" (không FE nào gọi) → liệt kê và phân loại: hợp lệ (mobile-only, internal, oauth callback, health, webhook) ghi rõ lý do; còn lại đánh `NEEDS_VERIFICATION` để hỏi user. Không tự xoá.
- Cách làm: liệt kê tập BE endpoint (từ controllers), tập FE call (grep lib/api, app/api routes, adminApi.js, mọi `fetch(`/`axios`/`apiClient` trực tiếp), rồi diff hai tập. Runtime: xác nhận route resolve (không 404).

**K2 — Mọi API trả 2xx (runtime).**
- Gọi thật từng endpoint với auth đúng + payload mẫu hợp lệ. Kỳ vọng **2xx**, hoặc đúng status đã tài liệu hoá ở §2.5. Bất kỳ `4xx/5xx` ngoài hợp đồng → ghi rõ status, body lỗi, input đã dùng. `5xx` → **Blocker**; `4xx` ngoài dự kiến → **High**.
- Mutation: theo nguyên tắc §0.5.

**K3 — FE đọc response không sai tên trường.**
- Với mỗi response FE tiêu thụ, đối chiếu tên field FE đọc (vd `res.data.xxx`, destructuring) với field thật của BE DTO (+ `DATA_CONTRACT.md`). Đọc field không tồn tại / sai tên / sai casing (camelCase vs snake_case) → giá trị `undefined` âm thầm → **High**.
- Xác nhận bằng runtime: in JSON thật trả về, so khoá.

**K4 — FE gửi request không sai tên trường.**
- Đối chiếu khoá trong body/params FE gửi với field của request DTO BE (+ ràng buộc `@Valid`). Sai tên → BE bỏ qua hoặc `400` → **High**.

**K5 — FE nhận đủ field để render.**
- Field BE trả về nhưng FE không tiêu thụ trong khi field đó có ý nghĩa hiển thị (giá, trạng thái, tồn kho, ảnh, timestamp…) → thiếu thông tin trên UI → **Medium** (nâng **High** nếu là dữ liệu nghiệp vụ quan trọng theo `MODULE_CATALOG.md`/`ACCEPTANCE_CRITERIA.md`). Field thuần metadata không bắt buộc render thì chỉ ghi nhận, không tính lỗi.

**K6 — FE không gửi field thừa.**
- Khoá FE gửi lên mà request DTO BE không định nghĩa/không nhận → **Medium** (nâng **High** nếu field thừa mang ý nghĩa bảo mật/ghi đè, vd `role`, `price`, `status`).

**K7 — Không mock / hardcode; FE phải nối BE thật.**
- Grep cả hai FE tìm: `mock`, `mockData`, `__mocks__`, `fixture`, `msw`, `faker`, mảng/đối tượng dữ liệu cứng được render thẳng ra UI, JSON sample import vào component, giá trị "dữ liệu mẫu" thay cho call API. Mỗi nơi UI hiển thị dữ liệu **không** đến từ BE thật → **High**.
- Phân biệt: hằng số UI hợp lệ (enum nhãn, cấu hình nav, copy text) **không** tính là mock. Chỉ tính dữ liệu nghiệp vụ đáng lẽ phải fetch từ BE.

**K8 — Product-ready từng feature/module của 2 FE.**
- Liệt kê đầy đủ module từ `docs/business/MODULE_CATALOG.md`; đối chiếu từng module với 4 tiêu chí (đạt hết mới tính product-ready):
  1. **Không mock/hardcode** dữ liệu hiển thị (xem K7).
  2. **Đủ trạng thái loading / empty / error** cho mỗi màn hình gọi API.
  3. **Không còn TODO/FIXME/placeholder** — grep `TODO`, `FIXME`, `XXX`, `placeholder`, `Lorem`, `coming soon`, `chưa làm`.
  4. **Mọi action (nút/form/submit) gọi API thật và xử lý cả success lẫn error** — không có handler rỗng, không `console.log` thay cho gọi API, không nuốt lỗi.
- Module thiếu bất kỳ tiêu chí nào → liệt kê tiêu chí thiếu + vị trí; mức độ theo tầm quan trọng module.

## 4. Phân loại severity

- **Blocker** — sai hợp đồng làm tính năng không chạy: endpoint FE gọi không tồn tại ở BE; API trả `5xx`; flow chính đứt.
- **High** — sai tên field (đọc/gửi), 4xx ngoài hợp đồng, mock/hardcode thay dữ liệu thật, field bảo mật thừa.
- **Medium** — thiếu render field nghiệp vụ, field thừa vô hại, thiếu trạng thái loading/empty/error.
- **Low** — TODO/placeholder còn sót, endpoint BE mồ côi hợp lệ, lệch nhỏ không ảnh hưởng người dùng.

## 5. Định dạng output (BẮT BUỘC)

Lưu **một** file: `docs/audits/FE_BE_CONTRACT_VERIFICATION_REPORT_<YYYY-MM-DD>.md`, gồm các phần theo đúng thứ tự:

1. **Tóm tắt điều hành** — bảng K1–K8: mỗi hạng mục `PASS/FAIL` + số vi phạm theo severity; tổng Blocker/High/Medium/Low; trạng thái stack runtime đã test.
2. **Ma trận API parity** — bảng: `Method | Path | BE có? | web gọi? | admin gọi? | Status runtime | Ghi chú`.
3. **Chi tiết vi phạm** — nhóm theo K1→K8. Mỗi mục: `ID | Severity | Vị trí FE (file:dòng) | Endpoint/BE liên quan | Mô tả | Evidence path | Cách tái hiện runtime | Đề xuất fix`.
4. **Bảng product-ready theo module** — `Module | Mock? | Loading/Empty/Error | TODO/Placeholder | Action wired? | Verdict`.
5. **Danh sách task ưu tiên để khắc phục** — nhóm **P0 (Blocker)** → **P1 (High)** → **P2 (Medium/Low)**. Mỗi task: việc cần làm, file/endpoint liên quan, tiêu chí "done", ước lượng phụ thuộc nếu có.
6. **Cần xác nhận từ user** — mọi điểm `NEEDS_VERIFICATION` / `CONFLICTING_EVIDENCE` / endpoint mồ côi nghi vấn, nêu câu hỏi cụ thể.
7. **Phụ lục** — danh sách endpoint đã test runtime + cách lấy token; lệnh đã chạy (cite container/service) để user verify lại.

**Quy tắc trình bày:** tiếng Việt có dấu, UTF-8, không mojibake. Mỗi vi phạm phải có evidence path thật (không bịa). Phần nào không kiểm tra được (stack chưa chạy, thiếu credential, mutation nguy hiểm) → ghi rõ "chưa kiểm tra + lý do", không bỏ trống và không đoán PASS.

## 6. Trình tự thực hiện

1. Đọc các docs ở §1 (chỉ section liên quan) để nắm contract chuẩn.
2. K1, K3, K4, K5, K6, K7, K8 phần **tĩnh** trước (đọc code + grep + đối chiếu docs) — không cần stack.
3. Kiểm tra runtime: `docker compose ps`; nếu thiếu → hỏi user khởi động rồi dừng chờ. Khi stack sẵn sàng, lấy token và chạy K1(resolve), K2, xác nhận lại K3/K4 bằng JSON thật.
4. Tổng hợp report theo §5, lưu đúng path, rồi liệt kê ngắn gọn cho user: số Blocker/High và 3–5 task P0 đầu tiên.
5. Nếu có bất kỳ điểm không rõ ngay từ đầu (credential admin, định nghĩa module, endpoint mồ côi) → **hỏi user trước khi kết luận**.
