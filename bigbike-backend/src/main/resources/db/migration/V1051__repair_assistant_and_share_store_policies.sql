-- V1051: assistant reliability, owner-managed shared policies and callback consent flow.
-- Canonical evidence: CHAT_RULE_006/009/010/012/019/029 and POLICY_PAGE_RULE_003 (2026-08-23).

alter table chat_conversations
    add column if not exists lead_offer_request_id uuid,
    add column if not exists lead_offer_opened_at timestamptz;

create unique index if not exists uk_chat_conversations_lead_offer_request
    on chat_conversations(lead_offer_request_id)
    where lead_offer_request_id is not null;

update chat_conversations conversation
set lead_offer_opened_at = coalesce(
        conversation.lead_offer_opened_at,
        (select min(interaction.created_at)
         from chat_interactions interaction
         where interaction.conversation_id = conversation.id
           and interaction.interaction_type = 'LEAD_PROMPT_VIEWED'),
        (select min(lead.created_at)
         from chat_leads lead
         where lead.conversation_id = conversation.id)
    )
where conversation.lead_offer_opened_at is null
  and (conversation.lead_offer_status <> 'NONE'
       or exists (select 1 from chat_leads lead where lead.conversation_id = conversation.id));

update chat_messages
set result_kind = 'PRODUCT_RESULTS'
where role = 'ASSISTANT'
  and products_json is not null
  and jsonb_typeof(products_json) = 'array'
  and jsonb_array_length(products_json) > 0
  and result_kind <> 'PRODUCT_RESULTS';

insert into site_settings (
    id, setting_key, setting_value, setting_value_en, setting_group,
    is_public, description, created_at, updated_at
)
values
    (gen_random_uuid(), 'policy_warranty_title',
     'Chính sách bảo hành', 'Warranty Policy', 'store_policy', false,
     'Tiêu đề song ngữ trang Chính sách bảo hành; dùng chung cho website và Trợ lý BigBike.',
     now(), now()),
    (gen_random_uuid(), 'policy_warranty_body_html',
     $policy_warranty_vi$<div class="max-w-none text-a4-content leading-body text-foreground"><p class="mb-6 text-a4-content leading-body">BigBike cam kết bảo hành chính hãng theo đúng quy định của từng nhà sản xuất. Thời hạn bảo hành cụ thể hiển thị trên trang chi tiết từng sản phẩm.</p><h2 class="mb-4 font-body text-a2-page font-bold leading-title text-brand">1. Điều kiện được bảo hành</h2><div class="mb-6 grid gap-4 sm:grid-cols-2"><div class="border border-border p-4"><p class="mb-3 flex items-center gap-2 font-body text-a4-content font-bold text-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check size-5 shrink-0 text-pros-accent" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg> Được bảo hành</p><ul class="list-disc space-y-2 pl-5 leading-snug"><li>Lỗi nhà sản xuất: vật liệu, đường may, kết cấu không đúng tiêu chuẩn</li><li>Sản phẩm không hoạt động đúng chức năng ngay từ đầu</li><li>Còn trong thời hạn bảo hành, còn tem/seal/hộp chứng minh nguồn gốc</li></ul></div><div class="border border-border p-4"><p class="mb-3 flex items-center gap-2 font-body text-a4-content font-bold text-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x size-5 shrink-0 text-cons-accent" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg> Không được bảo hành</p><ul class="list-disc space-y-2 pl-5 leading-snug"><li>Va đập, té ngã, tai nạn (kể cả không thấy hư hỏng bên ngoài)</li><li>Tự ý sửa chữa, tháo lắp, độ chế</li><li>Tiếp xúc nhiệt trên 50°C, hóa chất, chất tẩy rửa</li><li>Giặt máy, sấy nóng (áp dụng cho mũ và đồ vải)</li><li>Hao mòn tự nhiên trong quá trình sử dụng</li></ul></div></div><div class="mb-6 border border-border border-l-4 border-l-brand bg-white p-4"><p class="leading-body"><strong class="text-brand">Lưu ý quan trọng với mũ bảo hiểm:</strong> Mũ đã va chạm — dù không thấy hư hỏng bên ngoài — phải thay mới. Lớp EPS bên trong đã mất khả năng hấp thụ lực sau va chạm đầu tiên. Đây là yêu cầu an toàn, không phải chính sách bảo hành.</p></div><h2 class="mb-4 font-body text-a2-page font-bold leading-title text-brand">2. Thời hạn bảo hành theo thương hiệu</h2><p class="mb-2 font-body text-a4-content font-bold text-foreground">Mũ bảo hiểm</p><div class="mb-6 overflow-x-auto"><table class="w-full border-collapse text-a4-content"><thead><tr class="bg-secondary"><th class="w-1/5 border border-border p-3 text-left font-bold">Thương hiệu</th><th class="w-1/4 border border-border p-3 text-left font-bold">Thời hạn</th><th class="border border-border p-3 text-left font-bold">Ghi chú</th></tr></thead><tbody><tr><td class="border border-border p-3 align-top font-bold">AGV</td><td class="border border-border p-3 align-top">24 tháng</td><td class="border border-border p-3 align-top text-a5-meta text-muted-foreground"><span class="block">Lỗi xác định từ hãng: gửi hình về AGV tại Ý, xử lý tối đa 2–7 ngày</span></td></tr><tr><td class="border border-border p-3 align-top font-bold">Caberg</td><td class="border border-border p-3 align-top">24 tháng</td><td class="border border-border p-3 align-top text-a5-meta text-muted-foreground"><span class="block">Theo chính sách hãng</span></td></tr><tr><td class="border border-border p-3 align-top font-bold">ILM</td><td class="border border-border p-3 align-top">12 tháng</td><td class="border border-border p-3 align-top text-a5-meta text-muted-foreground"><span class="block">Lỗi kỹ thuật / nhà sản xuất</span></td></tr><tr><td class="border border-border p-3 align-top font-bold">NIC</td><td class="border border-border p-3 align-top">12 tháng</td><td class="border border-border p-3 align-top text-a5-meta text-muted-foreground"><span class="block">Lỗi kỹ thuật / nhà sản xuất</span></td></tr><tr><td class="border border-border p-3 align-top font-bold">LS2</td><td class="border border-border p-3 align-top">Theo từng linh kiện</td><td class="border border-border p-3 align-top text-a5-meta text-muted-foreground"><span class="block">Khóa · cần gạt · dây cáp · dây quai: 24 tháng</span><span class="block">Vải · đệm lót · kính chắn · Pinlock · sơn: 6 tháng</span><span class="block">EPS · vỏ nón · đuôi gió: không bảo hành (chỉ sửa có phí)</span></td></tr><tr><td class="border border-border p-3 align-top font-bold">SCS</td><td class="border border-border p-3 align-top">24 tháng</td><td class="border border-border p-3 align-top text-a5-meta text-muted-foreground"><span class="block">Toàn bộ sản phẩm · Không BH: va đập, cấn, móp, bể, vào nước do sử dụng</span></td></tr></tbody></table></div><p class="mb-2 font-body text-a4-content font-bold text-foreground">Áo quần · Găng tay · Giày bảo hộ</p><p class="mb-2 text-a5-meta text-muted-foreground">Áp dụng cho: Komine · Taichi · ILM · Hevik · LS2 <span class="text-brand">[Hevik — BigBike đang xác nhận thêm]</span></p><div class="mb-6 overflow-x-auto"><table class="w-full border-collapse text-a4-content"><thead><tr class="bg-secondary"><th class="border border-border p-3 text-left font-bold">Hạng mục</th><th class="w-1/4 border border-border p-3 text-left font-bold">Thời hạn</th></tr></thead><tbody><tr><td class="border border-border p-3">Đường chỉ, mối nối hàn nhiệt (áo / quần)</td><td class="border border-border p-3">6 tháng</td></tr><tr><td class="border border-border p-3">Dây khóa kéo, khóa dán</td><td class="border border-border p-3">6 tháng</td></tr><tr><td class="border border-border p-3">Da thật, da lộn, phần chống thấm, phản quang</td><td class="border border-border p-3">6 tháng</td></tr><tr><td class="border border-border p-3">Keo đế giày</td><td class="border border-border p-3">12 tháng</td></tr></tbody></table></div><p class="mb-2 font-body text-a4-content font-bold text-foreground">Balo · Túi đeo · Túi treo xe</p><div class="mb-6 overflow-x-auto"><table class="w-full border-collapse text-a4-content"><thead><tr class="bg-secondary"><th class="border border-border p-3 text-left font-bold">Hạng mục</th><th class="w-1/4 border border-border p-3 text-left font-bold">Thời hạn</th></tr></thead><tbody><tr><td class="border border-border p-3">Đường chỉ, dây khóa kéo</td><td class="border border-border p-3">3 tháng</td></tr></tbody></table></div><h2 class="mb-4 font-body text-a2-page font-bold leading-title text-brand">3. Quy trình bảo hành</h2><ol class="mb-6 space-y-3"><li class="flex gap-4 border border-border p-4"><span class="font-body text-a2-page font-bold leading-none text-brand">1</span><div class="leading-body"><strong class="text-foreground">Liên hệ BigBike trước</strong><br/><span>Nhắn ZaloGọi Hotline  — mô tả lỗi và gửi ảnh / video sản phẩm.</span></div></li><li class="flex gap-4 border border-border p-4"><span class="font-body text-a2-page font-bold leading-none text-brand">2</span><div class="leading-body"><strong class="text-foreground">BigBike xác nhận lỗi</strong><br/><span>Phản hồi trong 2–4 giờ (trong giờ làm việc). Nếu thuộc diện bảo hành, BigBike hướng dẫn bước tiếp theo.</span></div></li><li class="flex gap-4 border border-border p-4"><span class="font-body text-a2-page font-bold leading-none text-brand">3</span><div class="leading-body"><strong class="text-foreground">Gửi sản phẩm về BigBike</strong><br/><span>Mang trực tiếp đến shop (nội thành TP.HCM) hoặc gửi bưu điện theo hướng dẫn.</span></div></li><li class="flex gap-4 border border-border p-4"><span class="font-body text-a2-page font-bold leading-none text-brand">4</span><div class="leading-body"><strong class="text-foreground">Xử lý và trả sản phẩm</strong><br/><span>BigBike xử lý hoặc chuyển về hãng. Thời gian: 3–7 ngày làm việc với đa số sản phẩm. Riêng LS2 qua BBI: tối đa 7 ngày làm việc kể từ khi BBI nhận hàng.</span></div></li></ol><h2 class="mb-4 font-body text-a2-page font-bold leading-title text-brand">4. Liên hệ hỗ trợ bảo hành</h2><div class="mb-4 overflow-x-auto"><table class="w-full border-collapse text-a4-content"><tbody></tbody></table></div><p class="text-a5-meta leading-snug text-muted-foreground">Dữ liệu bảo hành một số thương hiệu đang được bổ sung — sẽ cập nhật trong thời gian sớm nhất.</p></div>$policy_warranty_vi$,
     $policy_warranty_en$<div class="max-w-none text-a4-content leading-body text-foreground"><p class="mb-6 text-a4-content leading-body">BigBike provides genuine manufacturer warranty according to each brand&#x27;s policy. The exact warranty period is shown on each product detail page.</p><h2 class="mb-4 font-body text-a2-page font-bold leading-title text-brand">1. Warranty conditions</h2><div class="mb-6 grid gap-4 sm:grid-cols-2"><div class="border border-border p-4"><p class="mb-3 flex items-center gap-2 font-body text-a4-content font-bold text-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check size-5 shrink-0 text-pros-accent" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg> Covered</p><ul class="list-disc space-y-2 pl-5 leading-snug"><li>Manufacturer defect: substandard material, stitching or construction</li><li>Product does not work correctly from the start</li><li>Within the warranty period, with intact tag/seal/box proving origin</li></ul></div><div class="border border-border p-4"><p class="mb-3 flex items-center gap-2 font-body text-a4-content font-bold text-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x size-5 shrink-0 text-cons-accent" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg> Not covered</p><ul class="list-disc space-y-2 pl-5 leading-snug"><li>Impact, falls, accidents (even with no visible external damage)</li><li>Self-repair, disassembly or modification</li><li>Exposure to heat above 50°C, chemicals or detergents</li><li>Machine washing or hot drying (helmets and textile gear)</li><li>Natural wear and tear during use</li></ul></div></div><div class="mb-6 border border-border border-l-4 border-l-brand bg-white p-4"><p class="leading-body"><strong class="text-brand">Important note for helmets:</strong> A helmet that has been in an impact — even with no visible external damage — must be replaced. The inner EPS layer loses its energy-absorbing ability after the first impact. This is a safety requirement, not a warranty policy.</p></div><h2 class="mb-4 font-body text-a2-page font-bold leading-title text-brand">2. Warranty period by brand</h2><p class="mb-2 font-body text-a4-content font-bold text-foreground">Helmets</p><div class="mb-6 overflow-x-auto"><table class="w-full border-collapse text-a4-content"><thead><tr class="bg-secondary"><th class="w-1/5 border border-border p-3 text-left font-bold">Brand</th><th class="w-1/4 border border-border p-3 text-left font-bold">Period</th><th class="border border-border p-3 text-left font-bold">Note</th></tr></thead><tbody><tr><td class="border border-border p-3 align-top font-bold">AGV</td><td class="border border-border p-3 align-top">24 months</td><td class="border border-border p-3 align-top text-a5-meta text-muted-foreground"><span class="block">Defect confirmed by brand: photos sent to AGV in Italy, handled within 2–7 days</span></td></tr><tr><td class="border border-border p-3 align-top font-bold">Caberg</td><td class="border border-border p-3 align-top">24 months</td><td class="border border-border p-3 align-top text-a5-meta text-muted-foreground"><span class="block">Per brand policy</span></td></tr><tr><td class="border border-border p-3 align-top font-bold">ILM</td><td class="border border-border p-3 align-top">12 months</td><td class="border border-border p-3 align-top text-a5-meta text-muted-foreground"><span class="block">Technical / manufacturer defect</span></td></tr><tr><td class="border border-border p-3 align-top font-bold">NIC</td><td class="border border-border p-3 align-top">12 months</td><td class="border border-border p-3 align-top text-a5-meta text-muted-foreground"><span class="block">Technical / manufacturer defect</span></td></tr><tr><td class="border border-border p-3 align-top font-bold">LS2</td><td class="border border-border p-3 align-top">By component</td><td class="border border-border p-3 align-top text-a5-meta text-muted-foreground"><span class="block">Lock · visor lever · cable · strap: 24 months</span><span class="block">Fabric · lining · visor · Pinlock · paint: 6 months</span><span class="block">EPS · shell · spoiler: no warranty (paid repair only)</span></td></tr><tr><td class="border border-border p-3 align-top font-bold">SCS</td><td class="border border-border p-3 align-top">24 months</td><td class="border border-border p-3 align-top text-a5-meta text-muted-foreground"><span class="block">Full product · Excludes: impact, dents, cracks, water ingress from use</span></td></tr></tbody></table></div><p class="mb-2 font-body text-a4-content font-bold text-foreground">Apparel · Gloves · Protective shoes</p><p class="mb-2 text-a5-meta text-muted-foreground">Applies to: Komine · Taichi · ILM · Hevik · LS2 <span class="text-brand">[Hevik — BigBike is confirming]</span></p><div class="mb-6 overflow-x-auto"><table class="w-full border-collapse text-a4-content"><thead><tr class="bg-secondary"><th class="border border-border p-3 text-left font-bold">Item</th><th class="w-1/4 border border-border p-3 text-left font-bold">Period</th></tr></thead><tbody><tr><td class="border border-border p-3">Stitching, heat-welded seams (jacket / pants)</td><td class="border border-border p-3">6 months</td></tr><tr><td class="border border-border p-3">Zippers, velcro</td><td class="border border-border p-3">6 months</td></tr><tr><td class="border border-border p-3">Genuine leather, suede, waterproofing, reflective parts</td><td class="border border-border p-3">6 months</td></tr><tr><td class="border border-border p-3">Shoe sole adhesive</td><td class="border border-border p-3">12 months</td></tr></tbody></table></div><p class="mb-2 font-body text-a4-content font-bold text-foreground">Backpacks · Bags · Tank bags</p><div class="mb-6 overflow-x-auto"><table class="w-full border-collapse text-a4-content"><thead><tr class="bg-secondary"><th class="border border-border p-3 text-left font-bold">Item</th><th class="w-1/4 border border-border p-3 text-left font-bold">Period</th></tr></thead><tbody><tr><td class="border border-border p-3">Stitching, zippers</td><td class="border border-border p-3">3 months</td></tr></tbody></table></div><h2 class="mb-4 font-body text-a2-page font-bold leading-title text-brand">3. Warranty process</h2><ol class="mb-6 space-y-3"><li class="flex gap-4 border border-border p-4"><span class="font-body text-a2-page font-bold leading-none text-brand">1</span><div class="leading-body"><strong class="text-foreground">Contact BigBike first</strong><br/><span>Message ZaloCall Hotline  — describe the issue and send photos / video of the product.</span></div></li><li class="flex gap-4 border border-border p-4"><span class="font-body text-a2-page font-bold leading-none text-brand">2</span><div class="leading-body"><strong class="text-foreground">BigBike confirms the defect</strong><br/><span>We respond within 2–4 hours (business hours). If covered, BigBike guides you through the next steps.</span></div></li><li class="flex gap-4 border border-border p-4"><span class="font-body text-a2-page font-bold leading-none text-brand">3</span><div class="leading-body"><strong class="text-foreground">Send the product to BigBike</strong><br/><span>Bring it directly to the shop (inner-city HCMC) or ship by post as instructed.</span></div></li><li class="flex gap-4 border border-border p-4"><span class="font-body text-a2-page font-bold leading-none text-brand">4</span><div class="leading-body"><strong class="text-foreground">Processing and return</strong><br/><span>BigBike handles it or forwards it to the brand. Time: 3–7 business days for most products. For LS2 via BBI: up to 7 business days from when BBI receives the item.</span></div></li></ol><h2 class="mb-4 font-body text-a2-page font-bold leading-title text-brand">4. Warranty support contact</h2><div class="mb-4 overflow-x-auto"><table class="w-full border-collapse text-a4-content"><tbody></tbody></table></div><p class="text-a5-meta leading-snug text-muted-foreground">Warranty data for some brands is being updated and will be completed soon.</p></div>$policy_warranty_en$,
     'store_policy', false,
     'Nội dung song ngữ Chính sách bảo hành; nguồn duy nhất cho website và Trợ lý BigBike.',
     now(), now()),
    (gen_random_uuid(), 'policy_return_exchange_title',
     'Chính sách đổi trả hàng', 'Returns and Exchanges Policy', 'store_policy', false,
     'Tiêu đề song ngữ trang Chính sách đổi trả; dùng chung cho website và Trợ lý BigBike.',
     now(), now()),
    (gen_random_uuid(), 'policy_return_exchange_body_html',
     $policy_return_vi$<div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#111111;max-width:100%;">

  <p style="font-size:18px;color:#111111 !important;line-height:1.7;margin:0 0 24px 0;">
    BigBike cam kết hỗ trợ đổi và trả hàng rõ ràng. Đọc kỹ điều kiện bên dưới trước khi đặt để tránh phát sinh không mong muốn.
  </p>

  <!-- 1. THỜI HẠN -->
  <h2 style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:22px;font-weight:bold;text-transform:uppercase;color:#cc0906 !important;margin:0 0 16px 0;letter-spacing:0.5px;">1. Thời hạn đổi và trả hàng</h2>

  <table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:18px;margin:0 0 16px 0;">
    <thead>
      <tr>
        <th style="padding:12px 16px;border:1px solid #dddddd;background-color:#f5f5f5;font-weight:bold;color:#111111 !important;text-align:left;width:35%;">Loại yêu cầu</th>
        <th style="padding:12px 16px;border:1px solid #dddddd;background-color:#f5f5f5;font-weight:bold;color:#111111 !important;text-align:left;width:20%;">Thời hạn</th>
        <th style="padding:12px 16px;border:1px solid #dddddd;background-color:#f5f5f5;font-weight:bold;color:#111111 !important;text-align:left;">Điều kiện</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:12px 16px;border:1px solid #dddddd;font-weight:bold;color:#111111 !important;">Đổi size / đổi sản phẩm</td>
        <td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="font-size:22px;color:#cc0906 !important;">7 ngày</strong><br><span style="font-size:14px;color:#6f6f6f !important;">kể từ ngày nhận</span></td>
        <td style="padding:12px 16px;border:1px solid #dddddd;font-size:14px;color:#111111 !important;">Đổi sang size khác hoặc sản phẩm khác cùng giá trị trở lên</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border:1px solid #dddddd;font-weight:bold;color:#111111 !important;">Hoàn tiền / trả hàng</td>
        <td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="font-size:22px;color:#cc0906 !important;">1 ngày</strong><br><span style="font-size:14px;color:#6f6f6f !important;">kể từ ngày nhận</span></td>
        <td style="padding:12px 16px;border:1px solid #dddddd;font-size:14px;color:#111111 !important;">Thay đổi ý muốn ngay sau khi nhận hàng, hoặc sản phẩm có lỗi</td>
      </tr>
    </tbody>
  </table>

  <div style="border:1px solid #dddddd;border-left:4px solid #cc0906;padding:16px;margin:0 0 24px 0;">
    <p style="font-size:18px;color:#111111 !important;margin:0;line-height:1.7;">
      <strong style="color:#cc0906 !important;">Lưu ý:</strong> Sau 1 ngày nếu không có lỗi sản phẩm, BigBike chỉ hỗ trợ <strong style="color:#111111 !important;">đổi sang sản phẩm khác</strong> — không hoàn tiền. Phí vận chuyển do hai bên thỏa thuận tùy giá trị đơn hàng.
    </p>
  </div>

  <!-- 2. ĐIỀU KIỆN -->
  <h2 style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:22px;font-weight:bold;text-transform:uppercase;color:#cc0906 !important;margin:0 0 16px 0;letter-spacing:0.5px;">2. Điều kiện được đổi / trả</h2>

  <div style="display:flex;gap:16px;margin:0 0 24px 0;flex-wrap:wrap;">
    <div style="flex:1;min-width:240px;border:1px solid #dddddd;padding:16px;">
      <p style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:18px;font-weight:bold;text-transform:uppercase;color:#111111 !important;margin:0 0 12px 0;">✓ Được chấp nhận</p>
      <ul style="margin:0;padding:0 0 0 20px;line-height:1.8;">
        <li style="margin-bottom:8px;color:#111111 !important;">Còn nguyên tem, seal, hộp đóng gói ban đầu</li>
        <li style="margin-bottom:8px;color:#111111 !important;">Chưa qua sử dụng — chưa mặc thử ngoài nhà, chưa giặt</li>
        <li style="margin-bottom:8px;color:#111111 !important;">Còn đầy đủ phụ kiện đi kèm trong hộp</li>
        <li style="color:#111111 !important;">Liên hệ BigBike trong đúng thời hạn quy định</li>
      </ul>
    </div>
    <div style="flex:1;min-width:240px;border:1px solid #dddddd;padding:16px;">
      <p style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:18px;font-weight:bold;text-transform:uppercase;color:#111111 !important;margin:0 0 12px 0;">✗ Không áp dụng</p>
      <ul style="margin:0;padding:0 0 0 20px;line-height:1.8;">
        <li style="margin-bottom:8px;color:#111111 !important;">Đồ đã qua sử dụng hoặc đã giặt dù chỉ 1 lần</li>
        <li style="margin-bottom:8px;color:#111111 !important;">Đã tháo seal hoặc mất hộp dù chưa dùng</li>
        <li style="color:#111111 !important;">Sản phẩm đặt riêng, hàng đặt cọc theo yêu cầu</li>
      </ul>
    </div>
  </div>

  <!-- 3. HÀNG SALE -->
  <h2 style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:22px;font-weight:bold;text-transform:uppercase;color:#cc0906 !important;margin:0 0 16px 0;letter-spacing:0.5px;">3. Quy định riêng với hàng sale / khuyến mãi</h2>

  <table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:18px;margin:0 0 24px 0;">
    <thead>
      <tr>
        <th style="padding:12px 16px;border:1px solid #dddddd;background-color:#f5f5f5;font-weight:bold;color:#111111 !important;text-align:left;width:50%;">Yêu cầu</th>
        <th style="padding:12px 16px;border:1px solid #dddddd;background-color:#f5f5f5;font-weight:bold;color:#111111 !important;text-align:left;">Áp dụng</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">Đổi sang sản phẩm bằng hoặc cao hơn giá trị</td>
        <td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="color:#111111 !important;">✓ Hỗ trợ</strong> — cùng hoặc ngoài danh mục đều được</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">Hoàn tiền / trả hàng</td>
        <td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="color:#cc0906 !important;">✗ Không áp dụng</strong> với hàng sale</td>
      </tr>
    </tbody>
  </table>

  <!-- 4. PHÍ SHIP -->
  <h2 style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:22px;font-weight:bold;text-transform:uppercase;color:#cc0906 !important;margin:0 0 16px 0;letter-spacing:0.5px;">4. Phí vận chuyển khi đổi / trả</h2>

  <table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:18px;margin:0 0 24px 0;">
    <thead>
      <tr>
        <th style="padding:12px 16px;border:1px solid #dddddd;background-color:#f5f5f5;font-weight:bold;color:#111111 !important;text-align:left;width:55%;">Trường hợp</th>
        <th style="padding:12px 16px;border:1px solid #dddddd;background-color:#f5f5f5;font-weight:bold;color:#111111 !important;text-align:left;">Phí vận chuyển</th>
      </tr>
    </thead>
    <tbody>
      <tr><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">Khách tự chọn size, muốn đổi sang size khác</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="color:#111111 !important;">Khách chịu</strong></td></tr>
      <tr><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">BigBike đã tư vấn và xác nhận size, nhưng không vừa</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="color:#111111 !important;">BigBike chịu</strong></td></tr>
      <tr><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">Lỗi sản xuất, hàng giao sai, hàng hư hỏng khi nhận</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="color:#111111 !important;">BigBike chịu 100%</strong></td></tr>
      <tr><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">Đổi sang sản phẩm khác, hàng sale</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">Hai bên thỏa thuận theo giá trị đơn hàng</td></tr>
    </tbody>
  </table>

  <!-- 5. QUY TRÌNH -->
  <h2 style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:22px;font-weight:bold;text-transform:uppercase;color:#cc0906 !important;margin:0 0 16px 0;letter-spacing:0.5px;">5. Quy trình đổi / trả hàng</h2>

  <table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:18px;margin:0 0 24px 0;">
    <tbody>
      <tr>
        <td style="padding:12px 16px;border:1px solid #dddddd;width:44px;text-align:center;vertical-align:top;">
          <span style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:24px;font-weight:bold;color:#cc0906 !important;">1</span>
        </td>
        <td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;vertical-align:top;">
          <strong style="color:#111111 !important;">Liên hệ BigBike trong thời hạn</strong><br>
          <span style="color:#111111 !important;">Nhắn Zalo <strong style="color:#111111 !important;">0764640679</strong> (Mrs. Thư) hoặc gọi Hotline <strong style="color:#111111 !important;">0906902404</strong> — mô tả lý do, gửi ảnh / video sản phẩm.</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border:1px solid #dddddd;text-align:center;vertical-align:top;">
          <span style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:24px;font-weight:bold;color:#cc0906 !important;">2</span>
        </td>
        <td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;vertical-align:top;">
          <strong style="color:#111111 !important;">Chờ xác nhận từ BigBike</strong><br>
          <span style="color:#111111 !important;">Phản hồi trong 2–4 giờ trong giờ làm việc. BigBike kiểm tra điều kiện và xác nhận có được đổi / trả không.</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border:1px solid #dddddd;text-align:center;vertical-align:top;">
          <span style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:24px;font-weight:bold;color:#cc0906 !important;">3</span>
        </td>
        <td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;vertical-align:top;">
          <strong style="color:#111111 !important;">Gửi hàng về BigBike</strong><br>
          <span style="color:#111111 !important;">Đóng gói kỹ, ghi rõ tên và số điện thoại. Gửi về <strong style="color:#111111 !important;">79/30/52 Âu Cơ, Phường Hòa Bình, TP. Hồ Chí Minh</strong>. Nội thành có thể mang trực tiếp trong giờ mở cửa.</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border:1px solid #dddddd;text-align:center;vertical-align:top;">
          <span style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:24px;font-weight:bold;color:#cc0906 !important;">4</span>
        </td>
        <td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;vertical-align:top;">
          <strong style="color:#111111 !important;">Nhận hàng đổi hoặc hoàn tiền</strong><br>
          <span style="color:#111111 !important;">BigBike xử lý trong <strong style="color:#111111 !important;">2–3 ngày làm việc</strong> kể từ khi nhận lại sản phẩm. Giao hàng đổi hoặc hoàn tiền theo thỏa thuận.</span>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- LIÊN HỆ -->
  <h2 style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:22px;font-weight:bold;text-transform:uppercase;color:#cc0906 !important;margin:0 0 16px 0;letter-spacing:0.5px;">Liên hệ hỗ trợ đổi / trả</h2>

  <table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:18px;margin:0;">
    <tbody>
      <tr><td style="padding:12px 16px;border:1px solid #dddddd;font-weight:bold;color:#111111 !important;width:30%;">Hotline</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="color:#cc0906 !important;">0906902404</strong></td></tr>
      <tr><td style="padding:12px 16px;border:1px solid #dddddd;font-weight:bold;color:#111111 !important;">Zalo tư vấn</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="color:#cc0906 !important;">0764640679</strong> (Mrs. Thư)</td></tr>
      <tr><td style="padding:12px 16px;border:1px solid #dddddd;font-weight:bold;color:#111111 !important;">Giờ làm việc</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">Thứ 2 – Thứ 7: 9:00 – 21:00 &nbsp;·&nbsp; Chủ nhật: 9:00 – 18:00</td></tr>
      <tr><td style="padding:12px 16px;border:1px solid #dddddd;font-weight:bold;color:#111111 !important;">Địa chỉ</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">79/30/52 Âu Cơ, Phường Hòa Bình, TP. Hồ Chí Minh</td></tr>
    </tbody>
  </table>

</div>
$policy_return_vi$,
     $policy_return_en$<div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#111111;max-width:100%;">
<p style="font-size:18px;color:#111111 !important;line-height:1.7;margin:0 0 24px 0;">BigBike is committed to a clear returns and exchanges process. Please read the conditions below carefully before ordering to avoid unexpected issues.</p>
<h2 style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:22px;font-weight:bold;text-transform:uppercase;color:#cc0906 !important;margin:0 0 16px 0;letter-spacing:0.5px;">1. Return and exchange periods</h2>
<table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:18px;margin:0 0 16px 0;"><thead><tr><th style="padding:12px 16px;border:1px solid #dddddd;background-color:#f5f5f5;font-weight:bold;color:#111111 !important;text-align:left;width:35%;">Request type</th><th style="padding:12px 16px;border:1px solid #dddddd;background-color:#f5f5f5;font-weight:bold;color:#111111 !important;text-align:left;width:20%;">Period</th><th style="padding:12px 16px;border:1px solid #dddddd;background-color:#f5f5f5;font-weight:bold;color:#111111 !important;text-align:left;">Condition</th></tr></thead><tbody><tr><td style="padding:12px 16px;border:1px solid #dddddd;font-weight:bold;color:#111111 !important;">Size or product exchange</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="font-size:22px;color:#cc0906 !important;">7 days</strong><br><span style="font-size:14px;color:#6f6f6f !important;">from receipt</span></td><td style="padding:12px 16px;border:1px solid #dddddd;font-size:14px;color:#111111 !important;">Exchange for another size or a different product of equal or greater value</td></tr><tr><td style="padding:12px 16px;border:1px solid #dddddd;font-weight:bold;color:#111111 !important;">Refund or return</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="font-size:22px;color:#cc0906 !important;">1 day</strong><br><span style="font-size:14px;color:#6f6f6f !important;">from receipt</span></td><td style="padding:12px 16px;border:1px solid #dddddd;font-size:14px;color:#111111 !important;">Change of mind immediately after receipt, or a defective product</td></tr></tbody></table>
<div style="border:1px solid #dddddd;border-left:4px solid #cc0906;padding:16px;margin:0 0 24px 0;"><p style="font-size:18px;color:#111111 !important;margin:0;line-height:1.7;"><strong style="color:#cc0906 !important;">Important:</strong> After 1 day, if the product has no defect, BigBike only supports an <strong style="color:#111111 !important;">exchange for another product</strong> — no refund. Shipping fees will be agreed by both parties depending on the order value.</p></div>
<h2 style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:22px;font-weight:bold;text-transform:uppercase;color:#cc0906 !important;margin:0 0 16px 0;letter-spacing:0.5px;">2. Return and exchange conditions</h2>
<div style="display:flex;gap:16px;margin:0 0 24px 0;flex-wrap:wrap;"><div style="flex:1;min-width:240px;border:1px solid #dddddd;padding:16px;"><p style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:18px;font-weight:bold;text-transform:uppercase;color:#111111 !important;margin:0 0 12px 0;">✓ Accepted</p><ul style="margin:0;padding:0 0 0 20px;line-height:1.8;"><li style="margin-bottom:8px;color:#111111 !important;">Original tags, seals and packaging remain intact</li><li style="margin-bottom:8px;color:#111111 !important;">Unused — not worn outdoors and not washed</li><li style="margin-bottom:8px;color:#111111 !important;">All original accessories are included in the box</li><li style="color:#111111 !important;">BigBike is contacted within the applicable period</li></ul></div><div style="flex:1;min-width:240px;border:1px solid #dddddd;padding:16px;"><p style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:18px;font-weight:bold;text-transform:uppercase;color:#111111 !important;margin:0 0 12px 0;">✗ Not eligible</p><ul style="margin:0;padding:0 0 0 20px;line-height:1.8;"><li style="margin-bottom:8px;color:#111111 !important;">Used or washed, even once</li><li style="margin-bottom:8px;color:#111111 !important;">Seal removed or packaging lost, even if unused</li><li style="color:#111111 !important;">Made-to-order products or products ordered with a customer-requested deposit</li></ul></div></div>
<h2 style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:22px;font-weight:bold;text-transform:uppercase;color:#cc0906 !important;margin:0 0 16px 0;letter-spacing:0.5px;">3. Sale and promotional products</h2>
<table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:18px;margin:0 0 24px 0;"><thead><tr><th style="padding:12px 16px;border:1px solid #dddddd;background-color:#f5f5f5;font-weight:bold;color:#111111 !important;text-align:left;width:50%;">Request</th><th style="padding:12px 16px;border:1px solid #dddddd;background-color:#f5f5f5;font-weight:bold;color:#111111 !important;text-align:left;">Availability</th></tr></thead><tbody><tr><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">Exchange for a product of equal or greater value</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="color:#111111 !important;">✓ Supported</strong> — within or outside the original category</td></tr><tr><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">Refund or return</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="color:#cc0906 !important;">✗ Not available</strong> for sale products</td></tr></tbody></table>
<h2 style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:22px;font-weight:bold;text-transform:uppercase;color:#cc0906 !important;margin:0 0 16px 0;letter-spacing:0.5px;">4. Return and exchange shipping fees</h2>
<table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:18px;margin:0 0 24px 0;"><thead><tr><th style="padding:12px 16px;border:1px solid #dddddd;background-color:#f5f5f5;font-weight:bold;color:#111111 !important;text-align:left;width:55%;">Case</th><th style="padding:12px 16px;border:1px solid #dddddd;background-color:#f5f5f5;font-weight:bold;color:#111111 !important;text-align:left;">Shipping fee</th></tr></thead><tbody><tr><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">Customer selected the size and wants another size</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong>Paid by the customer</strong></td></tr><tr><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">BigBike advised and confirmed the size, but it does not fit</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong>Paid by BigBike</strong></td></tr><tr><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">Manufacturing defect, incorrect item, or item damaged on receipt</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong>100% paid by BigBike</strong></td></tr><tr><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">Exchange for another product or a sale product</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">Agreed by both parties according to the order value</td></tr></tbody></table>
<h2 style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:22px;font-weight:bold;text-transform:uppercase;color:#cc0906 !important;margin:0 0 16px 0;letter-spacing:0.5px;">5. Return and exchange process</h2>
<table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:18px;margin:0 0 24px 0;"><tbody><tr><td style="padding:12px 16px;border:1px solid #dddddd;width:44px;text-align:center;vertical-align:top;"><strong style="font-size:24px;color:#cc0906 !important;">1</strong></td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;vertical-align:top;"><strong>Contact BigBike within the applicable period</strong><br>Message Zalo <strong>0764640679</strong> (Mrs. Thư) or call <strong>0906902404</strong>. Describe the reason and send product photos or video.</td></tr><tr><td style="padding:12px 16px;border:1px solid #dddddd;text-align:center;vertical-align:top;"><strong style="font-size:24px;color:#cc0906 !important;">2</strong></td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;vertical-align:top;"><strong>Wait for BigBike's confirmation</strong><br>BigBike responds within 2–4 hours during business hours, checks the conditions and confirms whether the return or exchange is accepted.</td></tr><tr><td style="padding:12px 16px;border:1px solid #dddddd;text-align:center;vertical-align:top;"><strong style="font-size:24px;color:#cc0906 !important;">3</strong></td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;vertical-align:top;"><strong>Send the product to BigBike</strong><br>Pack it securely and clearly write your name and phone number. Send it to <strong>79/30/52 Âu Cơ, Hòa Bình Ward, Ho Chi Minh City</strong>. Customers in Ho Chi Minh City may bring it directly to the shop during opening hours.</td></tr><tr><td style="padding:12px 16px;border:1px solid #dddddd;text-align:center;vertical-align:top;"><strong style="font-size:24px;color:#cc0906 !important;">4</strong></td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;vertical-align:top;"><strong>Receive the replacement or refund</strong><br>BigBike processes the request within <strong>2–3 business days</strong> after receiving the returned product, then ships the replacement or issues the agreed refund.</td></tr></tbody></table>
<h2 style="font-family:Arial,Helvetica,"Liberation Sans",sans-serif;font-size:22px;font-weight:bold;text-transform:uppercase;color:#cc0906 !important;margin:0 0 16px 0;letter-spacing:0.5px;">Returns and exchanges support</h2>
<table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:18px;margin:0;"><tbody><tr><td style="padding:12px 16px;border:1px solid #dddddd;font-weight:bold;color:#111111 !important;width:30%;">Hotline</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="color:#cc0906 !important;">0906902404</strong></td></tr><tr><td style="padding:12px 16px;border:1px solid #dddddd;font-weight:bold;color:#111111 !important;">Zalo support</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;"><strong style="color:#cc0906 !important;">0764640679</strong> (Mrs. Thư)</td></tr><tr><td style="padding:12px 16px;border:1px solid #dddddd;font-weight:bold;color:#111111 !important;">Business hours</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">Monday–Saturday: 9:00–21:00 &nbsp;·&nbsp; Sunday: 9:00–18:00</td></tr><tr><td style="padding:12px 16px;border:1px solid #dddddd;font-weight:bold;color:#111111 !important;">Address</td><td style="padding:12px 16px;border:1px solid #dddddd;color:#111111 !important;">79/30/52 Âu Cơ, Hòa Bình Ward, Ho Chi Minh City</td></tr></tbody></table>
</div>$policy_return_en$,
     'store_policy', false,
     'Nội dung song ngữ Chính sách đổi trả; nguồn duy nhất cho website và Trợ lý BigBike.',
     now(), now())
on conflict (setting_key) do nothing;

update site_settings
set setting_value = '25',
    description = 'Ngưỡng cảnh báo tổng chi phí AI theo tháng dương lịch (USD, giờ Việt Nam). 0 để tắt cảnh báo.',
    updated_at = now()
where setting_key = 'ai_assistant_monthly_cost_warning_usd'
  and trim(setting_value) = '0';

