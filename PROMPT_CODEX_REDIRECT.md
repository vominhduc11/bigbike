# Nhiệm vụ: Thực thi phiếu giao việc Redirect & Trang ngừng bán (bigbike.vn, 13/08/2026)

Đọc `AGENTS.md` trước. Tuân thủ Docs-First Contract (§2, §3): thay đổi chạm business rule / API contract / data shape / state machine → **update docs trước, rồi sửa code, cùng một PR**. Cite evidence path trong response.

Đây **không** phải "tự fix cái đã bị audit flag" — đây chính là task riêng để xử lý các finding đó. Cứ làm.

---

## 0. Bối cảnh

Phiếu SEO ngày 13/08/2026 yêu cầu xử lý 68 URL / 977 click (180 ngày) trên bigbike.vn. Một đợt kiểm tra hiện trạng đã chạy ngày 13/08/2026 (28 URL bấm thử trên site thật + đối chiếu 30 luật trong bảng `redirects`): **chỉ 3 URL đúng như phiếu**.

Kết quả kiểm và nguyên nhân gốc đã có sẵn ở mục 1 — **không cần dò lại**, chỉ verify khi sửa.

**Nguyên tắc của phiếu (bắt buộc giữ):**
- Mọi redirect dùng **301**, **tối đa 1 chặng**.
- **Không trỏ URL sản phẩm về danh mục hay `/sp/`** (Google chấm soft 404).
- URL `/en/` luôn trỏ về đích `/en/`, không đi vòng qua tiếng Việt.

**Môi trường:** stack chạy sẵn trong Docker — `bigbike-web` (127.0.0.1:3000), `bigbike-backend` (:8080), `bigbike-postgres` (:5432), `bigbike-admin` (:4000), `bigbike-minio` (:9000). `docker ps` trước khi dùng. Trong container mặc định **chỉ đọc**; muốn ghi/restart phải hỏi owner (AGENTS.md §5.6).

DB đọc: `docker exec bigbike-postgres psql -U bigbike -d bigbike -c "..."`

Kiểm URL: `curl -s -o /dev/null -H "Host: bigbike.vn" -w "%{http_code}|%{redirect_url}" "http://127.0.0.1:3000<path>"` — **giãn nhịp ~0,5s mỗi request**, không quét song song nhiều luồng.

---

## 1. Bảy nguyên nhân gốc đã xác minh

**RC-1 — Luật cứng trong `next.config.ts` đè bảng redirect quản trị.**
`bigbike-web/next.config.ts`, hàm `async redirects()`: luật `/danh-muc-san-pham/:slug/` → `/danh-muc/:slug/` (và biến thể không có `/`) chạy **trước** `proxy.ts`, nên bảng `redirects` do admin quản lý không bao giờ được hỏi tới.
Hệ quả: 6 luật của Việc 3 + `trum-dau`, `ao-lot`, `tui-deo-dui` đều có `hit_count = 0` (chưa từng chạy); `/danh-muc-san-pham/trum-dau/` và `/ao-lot/` kết thúc **404**; các URL còn lại đi **2 chặng** thay vì 1.
Comment ngay trong file đã cảnh báo chính xác điều này ("Luật viết cứng ở đây chạy TRƯỚC proxy nên luôn đè bảng admin").

**RC-2 — Toàn bộ luật `.html` nhánh tiếng Anh không bao giờ khớp.**
`bigbike-web/proxy.ts:176` — `legacyHtmlLookupPath()` cắt tiền tố `/en/` bằng `pathname.slice(3)` **trước khi** tra bảng, trong khi bảng lưu `source_pattern` **có** `/en/`.
Bằng chứng: `/en/sp/bluetooth-intercom-headset-for-couples-scs-s10x.html` có luật `enabled = true`, đích đúng y phiếu, nhưng site trả **404**.
Khi sửa phải kiểm thêm: `redirectResponse()` gọi `translatePath(rule.target, locale)` — target đã sẵn `/en/` có thể bị nhân đôi tiền tố.

**RC-3 — Hệ thống không phát được 410.**
Bảng `redirects` chỉ có `id, source_pattern, target_url, enabled, hit_count, last_hit_at, created_at, updated_at` — **không có cột mã trạng thái**. `proxy.ts` luôn `NextResponse.redirect(destination, 301)`.

**RC-4 — `/sp/` không có bộ lọc size.**
`components/catalog/CatalogSidebar.tsx` chỉ hỗ trợ `category`, `pwb-brand`, `min_price`, `max_price`. Thử `/sp/?size=XXL` ra đủ 72 sản phẩm y như không lọc.
**Xung đột tên:** `size` trong `CatalogClient.tsx` đang là **số sản phẩm mỗi trang** — không được tái dùng tên này cho size quần áo.

**RC-5 — Không có trạng thái "ngừng bán".**
`products.stock_state` chỉ có `IN_STOCK` / `OUT_OF_STOCK`. `publish_status` có `DRAFT / PUBLISHED / TRASH`. Không có khái niệm discontinued.

**RC-6 — `/brands/<slug>/` là soft 404 hàng loạt.**
`app/[locale]/brands/[slug]` trả **200** kèm nội dung "Không tìm thấy thương hiệu" cho slug bất kỳ (có `noindex`, nhưng vẫn là 200). Phải gọi `notFound()`.

**RC-7 — Thiếu thương hiệu.**
Hệ thống có 23 brand. **Không có `alpinestar`/`alpinestars`** (đích Việc 1 yêu cầu) và **không có `kriega`** (10/24 mặt hàng Việc 6).

---

## 2. Cần owner chốt trước khi làm — dùng `AskUserQuestion`, một bảng gộp

Hỏi **một lần** ở đầu phiên, rồi chạy thẳng tới xong:

1. **Tạo thương hiệu Alpinestars và Kriega?** Không tạo thì Việc 1 chỉ làm được 4/5 và Việc 6 không gộp được theo hãng.
2. **Tên tham số lọc size trên `/sp/`** (vì `size` đã bị dùng cho phân trang). Đề xuất: `?kich-co=XXL`. Chốt tên → mọi redirect Việc 2 trỏ theo tên đó.
3. **Áo LS2 Zoom Lady:** URL cũ là bản **áo mùa lạnh** (`...for-cold-weather.html`) nhưng đích đã nhập trong bảng là bản **áo mùa hè** (`ls2-zoom-lady-motorcycle-summer-jacket`). Giữ đích hiện tại, đổi sang bản đúng mùa, hay trả 410?
4. **Bài viết BMW R 1200 GS** (`/tin-tuc/bmw-r-1200-gs-xdrive-hybrid-...html`, 15 click) đang đổ về `/sp/`. Có bài tương ứng trong `/tin-tuc/` để trỏ về, hay trả 410?
5. **Spec trang ngừng bán:** phiếu trỏ tới `https://claude.ai/code/artifact/e40450ed-ceb5-4362-9c1d-2f6ac0f93b78`. Nếu không mở được, xin owner mô tả hoặc chốt cho tự thiết kế theo `bigbike-web/STYLEGUIDE.md`.

Vướng kỹ thuật giữa chừng → ghi `Not run: <lý do>` rồi chạy tiếp, không dừng cả phiên.

---

## 3. Danh sách việc — thứ tự thực thi

Thứ tự này **khác** thứ tự trong phiếu: phiếu xếp theo lượng click, còn đây xếp theo phụ thuộc kỹ thuật. Làm RC trước, nếu không công sửa dữ liệu sẽ đổ sông.

### A. Sửa 2 đích của Việc 4 — làm đầu tiên, 19 click đang rơi vào 404

Cả hai sản phẩm **vẫn đang bán**:

| source_pattern | target_url đúng | Lỗi hiện tại |
|---|---|---|
| `/sp/giay-moto-phuot-chong-nuoc-taichi-rss010-suede-drymaster-combat.html` | `/product/giay-moto-phuot-chong-nuoc-taichi-rss010-drymaster-combat/` | đích **thiếu đoạn `/product/`** → 404 |
| `/sp/mu-bao-hiem-fullface-caberg-drift-evo-ii-carbon.html` | `/product/caberg-drift-evo-ii-carbon/` | đích trỏ vào bản `publish_status = TRASH` → 404 |

Đây là **dữ liệu**, không phải code. Sửa bằng **Flyway migration** (reproducible, review được), không `UPDATE` tay vào DB production.

### B. Gỡ luật cứng, trả quyền cho bảng quản trị (RC-1)

- Gỡ/thu hẹp luật `/danh-muc-san-pham/:slug/` và `/danh-muc-san-pham/:slug` trong `next.config.ts`.
- Giữ nguyên các luật không đụng slug động: `/danh-muc-san-pham.html`, `/danh-muc-san-pham/`, `/san-pham/`, `/categories/`…
- Sau khi gỡ, verify 6 luật Việc 3 chạy **1 chặng** và `hit_count` bắt đầu nhảy.
- Đích đúng cho Việc 3 (đã có sẵn trong bảng, chỉ cần được chạy):
  `giap-bao-ho-tay-chan-dai-lung-phu-kien-giap` → `/danh-muc/giap-bao-ho-tay-chan/` ·
  `tui-deo-hong-tui-bao-tu` → `/danh-muc/tui-deo-hong-tui-deo-dui/` ·
  `ao-quan-bao-ho-moto-phuot-adventure` → `/danh-muc/ao-quan-moto-adventure/` ·
  `gang-tay` → `/danh-muc/gang-tay-xe-may-moto/` ·
  `non-bao-hiem-moto` → `/danh-muc/mu-bao-hiem/` ·
  `phu-kien-di-mua` → `/danh-muc/ao-mua-do-di-mua-moto/`
- **Việc 8 ăn theo:** `tui-deo-dui`, `ao-lot`, `trum-dau` đang 404 cùng nguyên nhân. Đích phiếu yêu cầu: `tui-deo-dui` → `/danh-muc/tui-deo-hong-tui-deo-dui/`, `trum-dau` **và** `ao-lot` → `/danh-muc/do-lot-the-thao-trum-dau-moto/`. Lưu ý bảng đang ghi `trum-dau` → một **sản phẩm lẻ** (`/product/trum-dau-fullface-keo-cam-tsla/`) — sai, sửa theo phiếu.

### C. Sửa tra cứu redirect cho nhánh `/en/` (RC-2)

- `proxy.ts:176`: đừng cắt `/en/` trước khi tra bảng — hoặc tra cả hai dạng (có và không có tiền tố), ưu tiên bản có tiền tố.
- Kiểm `translatePath()` không nhân đôi `/en/` trong `redirectResponse()`.
- Sau khi sửa, 4 URL Việc 5 phải: `scs-s10x` → `/en/product/scs-s10x-motorcycle-helmet-bluetooth-intercom/` (1 chặng); `ls2-apollo-man` → bật lại luật, đích hiện tại **sai** (đang trỏ sang áo Taichi) — tìm `/en/product/` của LS2 Apollo, không có thì 410; `ls2-zoom-lady` theo quyết định ở mục 2.3; `ls2-koku-kidney-belt` chưa có luật → thêm mới hoặc 410.
- Phiếu ghi nhánh `/en/` chiếm **42% sitemap** và chưa rà toàn diện. Sau khi sửa RC-2, quét lại toàn bộ luật `/en/*.html` trong bảng xem còn bao nhiêu cái vẫn chết, báo số liệu.

### D. Bổ sung khả năng trả 410 (RC-3) — mở khoá Việc 7

- Thêm cột mã trạng thái vào bảng `redirects` (mặc định 301; cho phép 410).
- Backend: entity/DTO/mapper trong `persistence/entity/redirect`, `mapper/RedirectMapper.java`; endpoint internal `/api/internal/redirect` phải trả kèm mã.
- `proxy.ts`: mã 410 → trả `NextResponse` status 410, **không** redirect.
- Admin `bigbike-admin/src/screens/RedirectListScreen.jsx`: cho chọn 301 / 410. Dùng shadcn `Select`, không native `<select>` (CLAUDE.md UI Stack).
- Dựng trang 410 theo phiếu: **nói rõ sản phẩm không còn**, kèm link về **danh mục cùng loại** và **trang chủ**. Song ngữ vi/en.
- Áp cho 14 URL nhóm dưới 4 click, gồm `/sp/tui-chong-nuoc-sw-motech-drybag-260-tail-bag.html` và `/sp/giay-di-moto-phuot-nu-scoyco-mt068w.html`.
- **Nghiệm thu:** trả đúng **410**, không phải 404.

### E. Trạng thái + trang ngừng bán (RC-5) — Việc 6, 24 URL / 352 click

Hạng mục nặng nhất. Dùng `/feature-build`.

- Thêm trạng thái ngừng bán cho sản phẩm (mở rộng `stock_state` hoặc field riêng — chốt trong `DATA_CONTRACT.md` + `STATE_MACHINES.md` trước khi code).
- Trang trả **200 tại chính URL cũ `/sp/<slug>.html`** — **không** tạo URL `/product/` mới, **không** gắn `noindex`, `availability` = `https://schema.org/Discontinued`, **nút mua gỡ khỏi DOM** (không chỉ ẩn bằng CSS).
- Hiện các URL này đang bị đẩy về **danh mục** (vd `/sp/balo-moto-phuot-kriega-trail-9-adventure.html` → `/danh-muc/balo-phuot-balo-moto/`) — **đúng cái phiếu cấm**. Phải gỡ các luật đó khi trang ngừng bán lên.
- Có URL đang trỏ vào sản phẩm **không tồn tại** (`/sp/giay-forma-adventure-low-dry.html` → `/product/giay-bao-ho-ls2-adventure-man-wp/` → 404) — và giày Forma dẫn sang giày LS2 cũng đã sai hãng.
- Gộp theo hãng: **Kriega** 10 URL / 136 click, **SMK** 2 URL / 18 click, **dầu–xịt sên** 3 URL / 35 click. 14 URL còn lại dựng trang riêng (cao nhất: `giay-forma-adventure-low-dry` 44 click, `phu-kien-kinh-thay-hang-ls2` 24, `gang-tay-moto-phuot-alpinestars-smx1-air-v2` 20).
- **Bắt buộc rà nội dung trước khi đăng.** Nội dung backup có thể chứa **"an toàn tuyệt đối"**, **sai chứng nhận ILM**, **sai bảo hành LS2**. Câu an toàn *"đồ bảo hộ giảm chấn thương chứ không ngăn được tai nạn"* phải **giữ nguyên**.
- Ảnh phải nằm trong **MinIO** (CLAUDE.md — Media rule), không hotlink ngoài.
- **Sitemap không được chứa** URL trang ngừng bán. **Feed Merchant Center không được còn SKU** hàng ngừng bán.

### F. Bộ lọc size trên `/sp/` (RC-4) — mở khoá Việc 2, 178 click

- Dựng bộ lọc size thật trong `CatalogSidebar.tsx` + backend facet, dùng tên tham số owner đã chốt ở mục 2.2.
- Chỉ khi bộ lọc chạy mới trỏ redirect: `/size/xxl/page/3` → size XXL · `/size/3xl` → 3XL · `/size/xxxl` → XXL hoặc 3XL (chốt với owner) · `/size/39` → 39 · `/size/46` → 46.
- `/size/39` và `/size/46` hiện **chưa có luật nào**, đang 404 — thêm mới.
- Phiếu đã lưu ý: **thứ hạng sẽ không chuyển sang trang lọc**, mục đích chỉ là đưa khách vào đúng chỗ. Không cần tối ưu SEO cho các URL này.

### G. Trang thương hiệu — Việc 1, 326 click

- Sửa `/brands/<slug>/` gọi `notFound()` khi không có brand (RC-6) — làm trước, nếu không sẽ tạo soft 404 mới.
- Tạo brand Alpinestars nếu owner đồng ý (mục 2.1).
- Sửa 5 luật về đúng `/brands/<slug>/`, **bỏ hẳn kiểu trỏ về `/sp/` kèm tham số lọc**:

| source_pattern | đích đúng | đang là |
|---|---|---|
| `/brand/alpinestar.html` | `/brands/alpinestar/` | `/sp/` |
| `/brand/taichi.html` | `/brands/taichi/` | `/sp/?pwb-brand=taichi` |
| `/brand/scs.html` | `/brands/scs/` | `/danh-muc/tai-nghe-bluetooth-mu-bao-hiem/?pwb-brand=scs` |
| `/brand/rok-straps.html` | `/brands/rok-straps/` | `/danh-muc/phu-kien-moto-khac/` |
| `/brand/smk.html` | `/brands/smk/` | luật **đang tắt**, đích ghi nhầm sang hãng **ILM** → hiện 404 |

### H. Dọn các luật trỏ sai hàng

- `/sp/giay-di-moto-phuot-nu-scoyco-mt068w.html` → đang trỏ `/product/giay-moto-touring-ls2-adventure-man-wp/`. Giày **nữ Scoyco** dẫn sang giày **nam LS2**, khác hãng khác giới. (Phiếu ghi đích cũ là áo LS2 Airy Evo — đã đổi nhưng vẫn sai.) **Gỡ luật này**, URL thuộc nhóm 410 ở mục D.
- `/sp/tui-chong-nuoc-sw-motech-drybag-260-tail-bag.html` → `/product/tui-treo-xe-may-givi-ea115bk/`: túi **SW-Motech** đổ sang túi **GIVI**. Thuộc nhóm 410.
- **4 luật ghi đích bằng URL tuyệt đối kết thúc `.html`** → tự sinh thêm chặng, vi phạm "tối đa 1 chặng":
  `/sp/gang-tay-moto-phuot-alpinestars-smx1-air-v2.html` → `https://bigbike.vn/gang-tay.html` ·
  `/sp/ao-bao-ho-scoyco-jk152.html` và `/sp/ao-furygan-leo.html` → `https://bigbike.vn/ao-quan-bao-ho/ao-bao-ho-vai-textile-jackets.html` ·
  `/sp/mu-bao-hiem-ls2-of606.html` → `https://bigbike.vn/mu-bao-hiem/mu-bao-hiem-3-4.html`
  Đổi sang đường dẫn tương đối, trỏ thẳng đích cuối. (Cái đầu thuộc nhóm 24 trang ngừng bán ở mục E.)
- Rà thêm: trong 748 luật hiện có, **41 luật chưa từng chạy** và **9 luật đang tắt** — kiểm xem còn cái nào chết cùng nguyên nhân RC-1/RC-2 không.

### I. Việc 9 — hai lỗi lặt vặt

- **H1 `/sp/` dính số:** hiện render ra `Tất cả sản phẩm1` — badge đếm số lọt vào trong thẻ `<h1>`. `components/layout/PageHero.tsx:52-54` render `{titleNode ?? title}`; truy nguồn `titleNode` và tách badge **ra ngoài** H1. Verify bằng cách xem HTML thật của `/sp/`.
- **`/?detail=26-01-13-zy0118t4.html` trả 200.** Phiếu đánh giá không gây index bloat vì canonical đã trỏ đúng bản sạch — **chỉ cần xác nhận lại canonical**, không cần sửa nếu vẫn đúng.

---

## 4. Nghiệm thu — chạy hết trước khi báo xong

| Kiểm | Đạt khi |
|---|---|
| 5 URL Việc 1 | Đều 301 tới `/brands/<slug>/`, không cái nào về `/sp/` |
| 12 URL Việc 3 | `curl -sSL -o /dev/null -w "%{num_redirects}"` trả **1**, không phải 2 |
| URL Việc 4, 5 | 301 một chặng, kết thúc ở trang 200 |
| Trang ngừng bán | 200, không `noindex`, `availability` = `https://schema.org/Discontinued`, nút mua gỡ khỏi DOM |
| Trang 410 | Trả đúng **410**, không phải 404 |
| Sitemap | Không chứa URL trang ngừng bán và trang 410 |
| Feed Merchant Center | Không còn SKU hàng ngừng bán |

Bổ sung ngoài phiếu: `/brands/<slug-không-tồn-tại>/` phải trả **404**, không phải 200.

Kiểm **tuần tự**, giãn nhịp ~0,5s mỗi request. Không quét song song nhiều luồng.

---

## 5. Trước khi commit

- Chạy `/hygiene` (dead CSS, mojibake, tiếng Việt đủ dấu) rồi `/preflight`.
- **Migration Flyway:** số cao nhất hiện tại là **V1020**. Đã 2 lần trùng số gây sập deploy; `mvn test` **không** bắt được vì profile test tắt Flyway. Kiểm số trước khi tạo file mới, và **không sửa file migration đã chạy**.
- Docs phải update cùng PR nếu chạm data shape / state machine / API contract: `DATA_CONTRACT.md`, `STATE_MACHINES.md`, `API_CONTRACT.md`, `BUSINESS_RULES.md`.
- Ghi finding + kết quả vào `docs/audits/`.
- Text tiếng Việt **có dấu đầy đủ**, UTF-8, không mojibake. Song ngữ: cập nhật cả `vi.json` và `en.json`.
- UI dùng shadcn/ui + Tailwind + token, không hardcode hex/px (CLAUDE.md).

## 6. Báo cáo cuối

Với mỗi việc A–I: **đã làm gì**, **bằng chứng** (URL + mã trạng thái + số chặng đo được), **phần chưa chạy** kèm lý do. Nêu rõ mục nghiệm thu nào chưa đạt.
