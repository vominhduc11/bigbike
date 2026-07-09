# Prompt tiếp nối — QA Playwright cho `bigbike-admin`

> Dán nguyên prompt này vào một phiên Claude Code mới (mở tại repo `bigbike-web-new`) để tiếp tục và hoàn thành task. Vai trò: **Senior QA Automation Engineer + Senior Admin UI/UX Engineer**.

---

## 0. Mục tiêu
Kiểm thử toàn diện UI/UX, responsive, transition/effect, runtime/network của **bigbike-admin** bằng Playwright; fix các lỗi UI/UX đã xác nhận trong phạm vi an toàn; chạy lại để verify; xuất báo cáo cuối.

## 1. Sự thật môi trường (đã verify — TUÂN THỦ, đừng dò lại từ đầu)
- **Máy này CHÍNH LÀ `103.1.236.148`.** `http://103.1.236.148:4000` = container Docker `bigbike-admin` local (nginx serve **production build**), nhưng build trong image cũ hơn source hiện tại một chút (chỉ lệch vài dòng CSS). **Không tự `docker compose up/build/restart`** — phải xin phép user.
- **Target test chính = LOCAL PRODUCTION PREVIEW** từ source hiện tại: `http://localhost:4280` (vite build → vite preview). Đây là nơi verify fix.
- **Backend thật** `localhost:8080` (healthy), **MinIO** `localhost:9000`. Đăng nhập: `admin@bigbike.vn` / `admin123` → role **SUPER_ADMIN**, `permissions: ["*"]` (mọi route truy cập được).
- **BUILD PHẢI có biến** giống Dockerfile, nếu không WebSocket sẽ trỏ sai host:
  `node ./e2e/scripts/preview-server.mjs`
- **Backend chặn Origin lạ (403)** → preview proxy (`e2e/vite.preview.config.ts`) đã rewrite `Origin/Referer` thành `http://localhost:4000`. Proxy cũng forward `/api`, `/ws`, `/media`, `/media-proxy`.
- **Rate limit theo IP**: LOGIN **5/phút**, REFRESH **30/phút**. Access token chỉ ở memory (mất khi reload), refresh cookie **dùng 1 lần** (xoay vòng + revoke cookie cũ).
- **Chiến lược auth (đã làm)**: 1 login/worker + **chuyền cookie giữa các test**, `workers=1`, điều hướng bằng **SPA in-app** (`navigateSpa` = pushState + popstate) để gần như **không tốn refresh**. Dùng `apiLogin` có backoff khi gặp 429.
- **App là SPA routing tự viết trong `src/App.jsx`** (không react-router), shell render bằng **class prototype `bb-*`** (`src/styles/admin-prototype.css`).
- ⚠️ **Preview server phải đang chạy** ở 4280. Nếu phiên mới: `cd bigbike-admin && node ./e2e/scripts/preview-server.mjs` rồi kiểm tra `http://localhost:4280`. (Playwright `webServer` cũng tự build+preview nếu 4280 trống.)

## 2. Đã làm xong (PASS)
- Cài `@playwright/test@1.60.0` (Chromium 1223 đã cache sẵn). Thêm scripts: `test:e2e[:ui|:debug|:report|:responsive|:effects|:admin]`, `preview:e2e`. `eslint.config.js` đã ignore `e2e`.
- **Khung test** đã viết và CHẠY XANH:
  - `e2e/specs/auth.spec.ts` — **3/3** (login form, bootstrap từ cookie, logout, sai mật khẩu).
  - `e2e/specs/smoke-routes.spec.ts` — **6/6** (toàn bộ ~32 màn list + 4 form create: shell ok, active-nav ok, không error panel, không overflow, runtime/network sạch).
  - `e2e/specs/responsive.spec.ts` — **9/9** (đủ 8 viewport + drawer mobile).
  - `e2e/specs/effects.spec.ts` — **7/7** (user dropdown, search ⌘K, notification bell, theme toggle, drawer overlay, segmented tabs, **confirm dialog huỷ-an-toàn** có chặn DELETE).
- **Fix UI đã áp dụng & verify** — chỉ sửa **`src/styles/admin-prototype.css`** (thêm rule responsive cho class `bb-*` đang dùng, KHÔNG thêm class mới):
  1. `.bb-seg { max-width:100% }` → tab trạng thái đơn hàng cuộn ngang thay vì tràn trang (Orders 390px: 252px → 0).
  2. `.bb-card { min-width:0 }` + `@media(max-width:1024px){ .bb-grid-2-1,.bb-grid-2 → 1 cột }` → Dashboard hết tràn ở 1024/768.
  3. `@media(max-width:900px)`: ẩn `.bb-user-chip .name/.role`, ẩn `.bb-pill-live`, giảm padding/gap topbar → hết tràn topbar mobile/tablet.
  4. `.bb-screen-actions { flex-wrap:wrap }` → nút header không tràn ở 375px.
  - Trước fix: responsive fail 6 viewport; sau fix: **9/9 xanh**, smoke vẫn 6/6 (không vỡ desktop).
- **Robustness harness**: tách lỗi “Failed to load resource” (ảnh/media 404) sang bucket `resourceErrors` (ghi nhận, KHÔNG fail gate) — tránh flaky; gate cứng chỉ trên pageerror + console.error code + API 4xx/5xx.

## 3. Phát hiện ngoài phạm vi UI (CHỈ GHI NHẬN, đừng tự fix)
- **Backend**: `POST /api/v1/auth/refresh` khi chưa đăng nhập trả **HTTP 500** (nên là 401). UI vẫn xử lý mượt (hiện login). → báo backend.
- **Kiến trúc 2 hệ shell song song**: `index.css` có hệ responsive mới `.app-shell/.sidebar/.topbar` (đủ compact-sidebar 901–1200, topbar collapse) nhưng **`AdminShell.jsx` vẫn render hệ cũ `.bb-*`** → hệ mới có vẻ **dead/chưa wire**. Không migrate (rủi ro/ngoài scope) — đề xuất cho team.
- **Media**: thỉnh thoảng 1 thumbnail 404 (hiếm, đã đưa vào `resourceErrors`).

## 4. CÒN LẠI cần làm để hoàn thành
1. **Dọn `e2e/specs/visual.spec.ts`**: bỏ import thừa `ADMIN_EMAIL/ADMIN_PASSWORD` và dòng `void ...` ở cuối (login snapshot không cần login).
2. **Tạo baseline visual + verify** (visual chưa chạy lần nào):
   - Lần 1 ghi baseline: `npx playwright test visual` (sẽ “fail — writing baseline”).
   - Lần 2 verify ổn định: chạy lại `npx playwright test visual` → phải xanh. Nếu flaky do data, tăng mask/giảm phạm vi. Ghi rõ baseline tạo trên Linux/Chromium môi trường này.
3. **Chạy FULL suite** lấy tổng kết + HTML report:
   - `npx playwright test` (đảm bảo đã build mới + preview 4280 chạy). Kỳ vọng auth+smoke+responsive+effects xanh, visual xanh sau khi có baseline.
   - `npm run test:e2e:report` để mở report.
4. **(Tuỳ chọn) Spot-check bản LIVE `:4000`**: `E2E_BASE_URL=http://103.1.236.148:4000 E2E_NO_WEBSERVER=1 npx playwright test smoke-routes effects` để kiểm CSP/console của artifact production thật (preview không có CSP của nginx). Lưu ý bản live chưa có fix CSS (container cũ).
5. **Deploy fix (cần user)**: container `:4000` sẽ KHÔNG có fix `admin-prototype.css` cho tới khi rebuild. Hỏi user có muốn `docker compose up -d --build bigbike-admin` không (đừng tự chạy).
6. **Viết BÁO CÁO CUỐI (task #11)** gồm: tóm tắt setup; danh sách file tạo/sửa; route đã test; viewport đã test; danh sách issue phát hiện; issue đã fix; issue còn lại/blocker; lệnh chạy lại (full/responsive/effects/visual/debug/report); kết luận mức sẵn sàng (usability / responsive / form-table / effect / runtime-network / production-readiness risk).
7. **Trước khi commit (nếu user yêu cầu)**: chạy `/hygiene` (mojibake, tiếng Việt có dấu, dead CSS) và `/preflight`. Chỉ commit khi user yêu cầu; tạo branch nếu đang ở `main`.

## 5. Lệnh hay dùng (chạy trong `bigbike-admin/`)
```bash
# Build production mới + (re)start preview 4280
node ./e2e/scripts/preview-server.mjs

npx playwright test                 # full
npx playwright test responsive      # = test:e2e:responsive
npx playwright test effects         # = test:e2e:effects
npx playwright test visual          # tạo/so baseline
npm run test:e2e:report             # mở HTML report (e2e/report)
# Sau khi đổi src (CSS/JSX): PHẢI build lại (preview serve file mới ngay, không cần restart).
```

## 6. RÀNG BUỘC (bắt buộc giữ)
- KHÔNG đổi backend / API contract / DB / business rule / permission.
- KHÔNG phá dữ liệu thật: mọi thao tác mutate phải an toàn (chỉ Cancel), dùng prefix `E2E_` nếu buộc tạo data, có chặn DELETE khi test confirm.
- Fix UI: ưu tiên component/token có sẵn; KHÔNG hardcode màu/px; KHÔNG thêm class mới vào `admin-prototype.css` (chỉ thêm rule cho class đang dùng); tuân design system (font Inter/JetBrains Mono, brand token).
- Chỉ fix lỗi đã xác nhận bằng Playwright/screenshot/trace/inspection. KHÔNG xoá field/chức năng vì khó layout.
- Báo blocker rõ ràng khi thiếu quyền/credential/backend.

## 7. Trạng thái task (TaskList)
Done: #1–#6 (validate env, scaffold, helpers, smoke, responsive, effects). Đang dở: #7 visual (đã viết spec, chưa tạo baseline), #9 fix (đã fix responsive, có thể phát sinh thêm từ visual). Chưa làm: #8 full-run triage, #10 re-verify tổng, #11 báo cáo cuối.

## 8. Inventory file đã tạo / sửa (dùng cho báo cáo cuối — luôn `git status` để đối chiếu)

> Lệnh nhanh: `git -C .. status --porcelain -- bigbike-admin | grep -v node_modules`

**MỚI tạo (untracked) — toàn bộ là khung test QA:**
- `bigbike-admin/playwright.config.ts`
- `bigbike-admin/e2e/vite.preview.config.ts`
- `bigbike-admin/e2e/utils/{env,viewports,routes,quality}.ts`
- `bigbike-admin/e2e/fixtures/admin-test.ts`
- `bigbike-admin/e2e/specs/{auth,smoke-routes,responsive,effects,visual}.spec.ts`
- `bigbike-admin/e2e/HANDOFF.md`
- (generated, KHÔNG commit) `bigbike-admin/e2e/{report,.artifacts}/`, video; **nên** commit baseline `bigbike-admin/e2e/__screenshots__/` sau khi tạo.

**SỬA (tracked) — do QA:**
- `bigbike-admin/package.json` (thêm scripts `test:e2e*`, `preview:e2e`; devDep `@playwright/test@1.60.0`)
- `bigbike-admin/package-lock.json` (theo devDep)
- `bigbike-admin/eslint.config.js` (globalIgnores thêm `e2e`, `playwright.config.ts`, `playwright-report`, `test-results`)
- `bigbike-admin/src/styles/admin-prototype.css` ← **THAY ĐỔI PRODUCT-CODE DUY NHẤT của QA** (4 fix responsive ở mục 2).

**SỬA (tracked) — KHÔNG phải của QA (đã dirty sẵn trước session, là việc dang dở của team — đừng gộp vào commit QA, đừng revert):**
- `bigbike-admin/src/index.css` (thêm comment breakpoint policy + media ≥1920 cho `.screen`)
- `bigbike-admin/src/styles/admin-layout.css` (cập nhật comment breakpoint policy)

**Cần thêm trước khi commit:** tạo `bigbike-admin/.gitignore` (chưa có) để bỏ qua output test:
```
e2e/report/
e2e/.artifacts/
```
(giữ lại `e2e/__screenshots__/` làm baseline để commit.)
