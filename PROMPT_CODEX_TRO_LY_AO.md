# Nhiệm vụ: Sửa toàn bộ tồn đọng của Trợ lý ảo BigBike (13/08/2026)

Đọc `AGENTS.md` trước. Tuân thủ Docs-First Contract (§2, §3): thay đổi chạm business rule / API contract / data shape / state machine → **update docs trước, rồi sửa code, cùng một PR**. Cite evidence path trong response.

Đây **không** phải "tự fix cái đã bị audit flag" — đây chính là task riêng được owner giao để xử lý các finding đó. Cứ làm tới xong.

**Chế độ chạy:** một lần gọi = chạy tới xong, không dừng giữa chừng xin duyệt. Owner đã chốt sẵn ở mục 1 — **không hỏi lại 3 điều đó**. Vướng kỹ thuật → ghi `Not run: <lý do>` rồi chạy tiếp.

---

## 0. Bối cảnh & môi trường

Trợ lý ảo (chat AI trên storefront) đã chạy thật từ 09/08/2026. Một đợt soi chất lượng đã chạy 11/08 và 12/08; phần **sai số liệu giá/đếm sản phẩm đã sửa xong và đã xác minh đúng 100%** — **không cần dò lại phần đó**.

Đợt kiểm hiện trạng ngày **13/08/2026** (đọc CSDL thật + đọc code) tìm ra 9 vấn đề còn tồn, liệt kê ở mục 2. Mỗi vấn đề đã có bằng chứng file:line hoặc số liệu CSDL — **verify khi sửa, không cần điều tra lại từ đầu**.

**Số liệu nền (CSDL `bigbike-postgres`, 6 ngày gần nhất):**

| Ngày | Câu khách hỏi | Không trả lời được | Tỉ lệ |
|---|---|---|---|
| 10/08 | 70 | 30 | 43% |
| 11/08 | 39 | 9 | 23% |
| 12/08 | 48 | 7 | 15% |
| 13/08 | 2 | 1 | — |

111 cuộc trò chuyện, **0 khách để lại liên hệ**, chỉ 9/111 cuộc từng được mời để lại liên hệ.

**Môi trường:** stack chạy sẵn trong Docker — `bigbike-web`, `bigbike-backend`, `bigbike-admin`, `bigbike-postgres`, `bigbike-minio`, `bigbike-redis`. `docker ps` trước khi dùng. Trong container mặc định **chỉ đọc**; muốn ghi/restart phải hỏi owner (AGENTS.md §5.6).

DB đọc: `docker exec bigbike-postgres psql -U bigbike -d bigbike -c "..."`

> ⚠️ **Hạn mức AI là tiền thật.** Mỗi lần gọi thử trợ lý qua `POST /api/v1/chat/messages` tiêu một lượt AI thật, trần **120 lượt/ngày** (`ai_assistant_daily_limit`). Hôm nay đã dùng 1. Đếm trước khi test hàng loạt:
> `SELECT count(*) FROM chat_messages WHERE ai_called AND (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;`
> Ưu tiên unit test + integration test; chỉ dùng chat thật cho vài ca xác nhận cuối. **Không** để cạn trần, vì khách thật sẽ gặp đúng màn hình lỗi đang cần sửa.

---

## 1. Owner đã chốt — làm theo, không hỏi lại

1. **Tên hiển thị: đổi hẳn thành "Trợ lý BigBike"**, bỏ tên riêng "Bi" ở mọi chỗ khách nhìn thấy. (Log nội bộ giữ nguyên cũng được, không bắt buộc đổi.)
2. **Ảnh đại diện: giữ icon bong bóng chat** như bản đang sửa dở. Không cần ảnh nhân vật, không cần upload MinIO.
3. **Chủ động xin liên hệ: CÓ — khi khách có dấu hiệu quan tâm.** Cụ thể: khách đã xem/hỏi một sản phẩm cụ thể, hoặc hỏi giá / size / còn hàng, hoặc trợ lý không trả lời được. Mỗi cuộc trò chuyện **chỉ mời đúng 1 lần**; khách từ chối thì không hỏi lại (giữ nguyên `CHAT_RULE_012`).

**Làm rõ rule kèm theo (owner đồng ý, phải ghi vào docs):** `CHAT_RULE_006` hiện bắt "tham chiếu chung chỉ tự nối khi context có đúng một slug đã xác minh". Cần **bổ sung ngoại lệ cho ý định so sánh**: khi khách nói "so sánh các mẫu / 2 mẫu này / so sánh giúp em" ngay sau khi trợ lý vừa hiện các thẻ sản phẩm đã xác minh, trợ lý **phải** hiểu là so sánh đúng những mẫu vừa hiện (tối đa 3), không được hỏi lại tên. Chỉ hỏi lại khi không có thẻ nào ở lượt trước.

---

## 2. Chín vấn đề đã xác minh

Thứ tự dưới đây là thứ tự ưu tiên theo thiệt hại kinh doanh. Làm từ trên xuống.

### V1 — Trợ lý gần như không bao giờ xin được liên hệ khách (0 lead / 111 cuộc) 🔴

**Nguyên nhân gốc đã xác minh (2 chỗ):**

- `bigbike-backend/.../service/chat/ChatToolService.java:4373-4387` — `DeterministicAnswer.from(outcome)` **hardcode `leadPrompt = false`**. Mọi câu trả lời do backend tự dựng từ kết quả tra cứu (source `TOOL`) và câu mẫu (source `TEMPLATE`) **không bao giờ có thể mời khách để lại liên hệ**. Trong 4 ngày gần nhất đó là 64/103 câu trả lời của trợ lý.
- `bigbike-backend/.../service/chat/ChatService.java:231-233` — khi câu trả lời được cứu lại sau bộ kiểm duyệt (`recoveredFromGuard`) hoặc được hỏi làm rõ (`clarifiedDuplicate`), `Answer` bị dựng lại với `leadPrompt = false` cứng.

Kết quả: `leadPrompt` chỉ còn phụ thuộc hoàn toàn vào việc mô hình Gemini tự quyết (`AiChatClient.java:107`), nên thực tế `lead_offer_status` = `OFFERED` chỉ 9/111 cuộc, `chat_leads` rỗng hoàn toàn.

**Phải làm:**
- Cho nhánh backend tự dựng câu trả lời (`DeterministicAnswer`) quyền đặt `leadPrompt = true` theo đúng điều kiện owner chốt ở mục 1.3.
- Bỏ ép `leadPrompt = false` ở nhánh cứu câu trả lời — trường hợp "trợ lý không trả lời được" chính là lúc **nên** mời để lại liên hệ nhất.
- Giữ nguyên các chốt chặn: đúng 1 lần/cuộc (`lead_offer_status`), chỉ ghi lead sau khi khách chủ động đồng ý, khách từ chối thì không hỏi lại, không ghi thông tin cá nhân vào log (`CHAT_RULE_012`).
- Câu mời phải tự nhiên, tiếng Việt có dấu, xưng "em" – gọi "anh/chị", không cộc lốc (`CHAT_RULE_001`).

**Docs phải update:** `docs/business/BUSINESS_RULES.md` → `CHAT_RULE_012` ghi rõ điều kiện kích hoạt lời mời (dấu hiệu quan tâm + khi bí), thay cho việc phó mặc mô hình quyết định.

---

### V2 — Khách nói "so sánh các mẫu" thì trợ lý bó tay 🔴

**Bằng chứng thật (cuộc trò chuyện 13/08 11:28–11:30):**

```
KHÁCH   11:28  Tìm sản phẩm mũ từ 2tr đến 3tr
TRỢ LÝ  11:28  ...shop có 2 mẫu mũ bảo hiểm... LS2 OF600 Copter II (2.790.000đ),
               ILM Z503 (3.000.000đ)... Anh/chị muốn em kiểm tra chi tiết mẫu nào ạ?
KHÁCH   11:30  So sánh các mẫu
TRỢ LÝ  11:30  Dạ, em chưa hoàn tất được lần tra này...      ← THUA
```

Trợ lý vừa tự hiện đúng 2 mẫu, vừa tự mời "muốn em kiểm tra chi tiết mẫu nào", khách làm đúng như mời thì lại không hiểu.

**Code liên quan:**
- Ý định so sánh đã nhận diện được: `ChatToolService.java:1446` (`"so sanh", "khac gi", "re hon"...`), câu hỏi lại ở `ChatToolService.java:236-237`.
- Danh sách slug đã xác minh của lượt trước đã có sẵn: nhãn `RECENT_VERIFIED_PRODUCTS` (`CHAT_RULE_005`).
- Thiếu: không nối tham chiếu **số nhiều/chỉ định** ("các mẫu", "2 mẫu này", "cả hai") vào chính các thẻ vừa hiện.

**Phải làm:** khi ý định là so sánh và lượt ngay trước có từ 2–3 thẻ sản phẩm đã xác minh, dùng đúng các slug đó (đã nằm trong allowlist nên `get_product` hợp lệ), trả về bảng/đoạn so sánh dựa **hoàn toàn** trên dữ liệu đã xác minh — giá, cỡ đang bán, lựa chọn biến thể, thông số đã lưu. Không suy đoán, không bịa điểm khác biệt.

**Docs phải update:** `CHAT_RULE_006` — thêm ngoại lệ so sánh như mô tả ở mục 1.

---

### V3 — Thông số kỹ thuật bị cắt cụt giữa chừng 🟠

**Nguyên nhân gốc đã xác minh:** `ChatToolService.java:3820-3824`

```java
private static String plain(String html, int max) {
    if (html == null || html.isBlank()) return "";
    String text = html.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
    return text.length() <= max ? text : text.substring(0, max);   // ← cắt cứng giữa chữ
}
```

Cắt đúng ký tự thứ `max`, không theo ranh giới câu/mục, không có dấu "…". Dùng cho: `specifications` và `specStats` (1800 ký tự, dòng 3222–3223), `description` (1800, dòng 3220), `shortDescription` (800), `quickAnswer` (800), `suitabilityAdvisory` (1600).

Hệ quả đã ghi nhận: câu trả lời dừng ngay ở tiêu đề "TIÊU CHUẨN AN TOÀN", mất phần chuẩn DOT / vỏ ABS / xốp EPS ngay sau đó — khách đọc xong không có thông tin gì.

**Phải làm:** cắt theo ranh giới câu hoặc mục; **không bao giờ kết thúc ngay sau một tiêu đề**; nếu buộc phải cắt thì báo rõ còn nội dung (vd "…"). Giữ nguyên yêu cầu bắt buộc giữ cảnh báo an toàn đã lưu (`CHAT_RULE_006`).

---

### V4 — Báo cáo đếm thiếu số câu trợ lý không trả lời được 🟠

**Nguyên nhân gốc đã xác minh:** câu "cứu vãn" `"Dạ, em chưa hoàn tất được lần tra này…"` (`ChatService.java:604`) được lưu với `source = "TOOL"` (`ChatService.java:241`), **không phải** `CONTACT_FALLBACK`.

Vì vậy mọi thống kê đếm theo `source='CONTACT_FALLBACK'` đều **thấp hơn thực tế**: ngày 12/08 đếm ra 4 câu (8%) trong khi thực tế là 7 câu (15%).

**Phải làm:** đánh dấu phân biệt được câu "không trả lời được nhưng vẫn giữ hội thoại" để đo được, mà **không** phá `CHAT_RULE_019` (không ghi `endedReason`, không trừ lượt hỏi, không lộ mã nguyên nhân ra storefront). Hiển thị chỉ số này ở màn quản trị hội thoại (`bigbike-admin/src/screens/ChatConversationListScreen.jsx`) để chủ shop tự theo dõi được chất lượng.

**Docs phải update:** `docs/engineering/DATA_CONTRACT.md` nếu thêm cột/giá trị mới.

> ⚠️ **Nếu phải thêm Flyway migration:** version cao nhất hiện tại là **V1020** → dùng V1021 trở lên. Kiểm tra trùng số trước khi commit (`ls db/migration | sed 's/__.*//' | sort -V | uniq -d`) — repo này đã 2 lần bị trùng số làm sập deploy, và `mvn test` **không** bắt được vì profile test tắt Flyway. **Tuyệt đối không sửa file migration đã chạy.**

---

### V5 — Tên trợ lý không đồng nhất ("Bi" vs "Trợ lý BigBike") 🟠

Web đang sửa dở (chưa commit) đã đổi nhãn sang "Trợ lý BigBike", nhưng trợ lý vẫn **tự xưng "Bi"** khi trò chuyện. Owner chốt: bỏ hẳn tên "Bi".

**Chỗ khách nhìn thấy, phải đổi hết:**

| Nơi | Vị trí |
|---|---|
| Câu chào mặc định | `ChatAssistantSettings.java:31` — "Em là Bi, trợ lý ảo AI của BigBike…" |
| Câu mẫu giới thiệu | `ChatToolService.java:230` — "Dạ, em là Bi, trợ lý ảo của BigBike…" |
| Thông báo tạm nghỉ / hết lượt / chưa sẵn sàng (EN) | `ChatService.java:756-758` |
| Thông báo tạm nghỉ / hết lượt / chưa sẵn sàng (VI) | `ChatService.java:765-767` |
| Lời dặn gửi cho AI | `AiChatClient.java:40` — "You are Bi, BigBike's AI sales assistant." |
| Web (hoàn tất phần đang dở) | `bigbike-web/messages/vi.json`, `en.json`, `components/home/FloatingChat.tsx` |
| Bài kiểm thử | `FloatingChat.test.tsx` (dòng 35, 63, 68, 86, 95, 289), `bigbike-web/e2e/bi-assistant.spec.ts` |
| Tài liệu | `docs/business/BUSINESS_RULES.md` (18 dòng), `MODULE_CATALOG.md`, `docs/engineering/{API_CONTRACT,API_FLOW_MAP,DATA_CONTRACT,INTEGRATION_GUIDE,PERMISSION_MATRIX}.md` |

**Dữ liệu đang chạy:** setting `ai_assistant_greeting` trong bảng `site_settings` vẫn là câu cũ có chữ "Bi". Đây là **thao tác ghi vào CSDL thật** → **không tự chạy `UPDATE`**. Sửa giá trị mặc định trong code, rồi **báo owner tự đổi trong màn Cài đặt của admin**, hoặc xin owner duyệt trước khi chạy lệnh.

---

### V6 — Hoàn tất phần sửa dở ở khung chat web 🟡

Đang có thay đổi **chưa commit** ở `bigbike-web/components/home/FloatingChat.tsx`: gỡ ảnh đại diện tải từ máy chủ ngoài (Cloudinary — vi phạm quy định ảnh phải nằm trong MinIO, AGENTS.md §14.3) và thay bằng icon bong bóng chat.

**Phải làm:** hoàn tất cho sạch — bỏ code chết còn sót (state `biAvatarFailed`, prop `failed`/`onError`/`fallback`, import không dùng), đảm bảo `FloatingChat.test.tsx` xanh, và **grep xác nhận không còn link ảnh host ngoài nào** trong khung chat. Giữ icon theo owner chốt, không thêm ảnh mới.

Chạy `/hygiene` sau khi xong (dead CSS + mojibake + tiếng Việt có dấu).

---

### V7 — Nút gợi ý "Tìm mũ bảo hiểm theo ngân sách" là nút hỏng nhất 🟡

Nút này nằm trong setting `ai_assistant_quick_prompts` (`site_settings`), **thiếu con số ngân sách**, nên trợ lý không biết khách muốn tầm nào → trả lời bừa hoặc chịu thua. Đây là câu hỏi hỏng nhiều nhất trong đợt soi 11/08 và **vẫn còn nguyên**.

**Phải làm (cả hai):**
1. Khi khách hỏi theo ngân sách mà **không nêu số tiền**, trợ lý phải **hỏi lại tầm giá** trước, không được đoán và không được chịu thua.
2. Đề xuất bộ nút gợi ý mới có mức giá cụ thể (vd "Mũ bảo hiểm dưới 2 triệu", "Mũ bảo hiểm 2–5 triệu"). Đây là setting trong CSDL → **không tự UPDATE**, chỉ đổi giá trị mặc định trong code và báo owner đổi trong màn Cài đặt.

---

### V8 — Lộ mã màu thô ra câu trả lời 🟡

Bảng `product_variant_options` hiện có **36 giá trị dạng mã kỹ thuật**, ví dụ: `den-nham-3`, `carbon-forged-bong`, `ff320-353-vang`, `xanh-mecha`, `trang-xam`, `day1-green`, `tem-trang`.

`CHAT_RULE_023` đã quy định: chỉ hiện cho khách dưới nhãn dễ đọc, chuẩn hoá an toàn được thì chuẩn hoá, **không chuẩn hoá được thì bỏ**, và **không sửa dữ liệu gốc chỉ để phục vụ chat**.

**Phải làm:** kiểm bộ chuẩn hoá hiện tại có phủ hết các dạng trên chưa — đặc biệt loại lẫn mã model (`ff320-353-vang`) thì **phải bỏ, không được hiện**. Bổ sung test cho đúng các giá trị thật liệt kê ở trên.

**Việc riêng cho chủ shop (không sửa code):** xuất danh sách 36 giá trị này kèm tên sản phẩm vào phần báo cáo cuối, để owner tự sửa lại tên màu trong màn quản trị sản phẩm.

---

### V9 — Câu "chịu thua" viết bằng chữ máy móc 🟡

`ChatService.java:604`: *"Dạ, em chưa hoàn tất được lần tra này nhưng anh/chị vẫn có thể hỏi tiếp ngay tại đây."*

Khách không hiểu "chưa hoàn tất được lần tra này" nghĩa là gì. Đợt soi trước cũng ghi nhận câu tương tự *"chưa nhận được kết quả đã xác minh"*.

**Phải làm:** viết lại bằng tiếng Việt đời thường của người bán hàng, nêu **một bước đi tiếp cụ thể**, và ghép với lời mời để lại liên hệ ở V1 khi phù hợp. Rà luôn các câu tương tự trong `ChatService.java` và `ChatToolService.java`. Giữ `CHAT_RULE_019` (không lặp nguyên văn hai lần liên tiếp).

---

## 3. Ràng buộc bắt buộc

- **Không nới lỏng bất kỳ chốt chặn an toàn nào** để làm cho câu trả lời "qua bài": giữ nguyên giới hạn 12 lượt/cuộc, trần AI theo ngày, phạm vi 6 công cụ chỉ-đọc, quyền `chat.read`, cấm sinh SQL, khoá Gemini chỉ ở backend.
- **Cấm bịa số liệu.** Mọi con số về số mẫu / giá / tồn kho phải có kết quả tra cứu tương ứng ở **chính lượt đó** (`CHAT_RULE_005`, `CHAT_RULE_020`). Phần này vừa sửa xong và đang đúng 100% — **không được làm hỏng lại**.
- **Không tự sửa dữ liệu trong CSDL đang chạy.** Mọi `UPDATE/DELETE` phải hỏi owner trước (AGENTS.md §5.6).
- Tiếng Việt **có dấu đầy đủ**, file UTF-8, không mojibake — áp dụng cho cả câu trả lời, chuỗi giao diện, `aria-label`, test và log.
- Web/admin dùng đúng shadcn/ui + Tailwind + token; không hardcode màu/spacing (AGENTS.md §6).
- Backend giữ Lombok + MapStruct + Bean Validation, exception qua `@ControllerAdvice` (AGENTS.md §7).

---

## 4. Kiểm chứng trước khi báo xong

1. **Unit/integration test trước** — không đốt hạn mức AI. Bổ sung test cho: V1 (điều kiện mời liên hệ + chỉ 1 lần), V2 (so sánh các mẫu vừa hiện), V3 (cắt văn bản theo ranh giới câu), V8 (chuẩn hoá/bỏ mã màu thật).
2. `mvn test` (backend), `npm test` (web + admin) phải xanh.
3. **Kiểm tra trùng số migration** nếu có thêm file mới (xem cảnh báo ở V4).
4. **Chat thật — tối đa 12 lượt**, đếm hạn mức trước và sau. Kịch bản bắt buộc:
   - "Tìm mũ bảo hiểm từ 2 đến 3 triệu" → "So sánh các mẫu" (phải so sánh được, **không** được chịu thua).
   - "Tìm mũ bảo hiểm theo ngân sách" (không nêu số) → phải hỏi lại tầm giá.
   - Hỏi thông số kỹ thuật một mẫu có mô tả dài → phải trọn ý, không dừng ở tiêu đề.
   - Đi tới lúc trợ lý bí → phải mời để lại liên hệ, và khách từ chối thì không hỏi lại.
   - Kiểm không còn chữ "Bi" nào trong lời trợ lý.
5. Chạy `/hygiene` rồi `/preflight` trước khi kết thúc.

---

## 5. Báo cáo cuối — bắt buộc có

- Bảng 9 vấn đề × trạng thái (`Đã sửa` / `Not run: <lý do>`), kèm evidence path.
- Danh sách file docs đã update và rule nào đổi.
- **Hai việc cần owner tự làm trong màn quản trị** (không được tự chạy): đổi câu chào `ai_assistant_greeting`, đổi bộ nút gợi ý `ai_assistant_quick_prompts` — ghi rõ giá trị cũ và giá trị đề xuất.
- Danh sách 36 giá trị màu dạng mã kèm tên sản phẩm, để owner sửa lại trong quản trị sản phẩm.
- Số lượt AI đã tiêu trong quá trình kiểm thử.
- Viết phần tóm tắt bằng **ngôn ngữ kinh doanh** — người đọc là chủ shop, không phải lập trình viên.
