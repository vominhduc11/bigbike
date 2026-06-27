-- V291: Nạp khối giới thiệu đầu trang danh mục (bb-cat-intro) song ngữ + SEO cho danh mục
--       "Giáp bảo hộ tay chân - Đai lưng - Phụ kiện giáp" (id = wp-cat-293).
-- Lý do: Đợt nội dung "BỔ SUNG" (content writer, 27/06/2026). Danh mục này bị bỏ sót ở V289 —
--        VI vẫn còn nội dung WordPress cũ và EN trống. V291 thay VI bằng khối bb-cat-intro chuẩn
--        và bổ sung EN + 4 field SEO, đồng bộ với 18 danh mục đã nạp ở V289.
-- Chạy SAU V290 (đã đổi tên content_bottom -> intro_content), nên dùng cột intro_content / intro_content_en.
-- Tham chiếu hệ thiết kế: khối bb-cat-* dùng chung CSS Đợt 1 (xem V289).
-- Ghi chú: các mục K1/K2/K3 ("phụ kiện gắn camera") trong file Đợt 3 KHÔNG có danh mục tương ứng
--          trong taxonomy hiện tại (chỉ có sub thương hiệu quadlock/kewig) nên không nạp ở đây.

UPDATE categories
SET    intro_content = $ic_vi_wp_cat_293$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · bao-ho-tay-chan-phu-kien-bao-ho</span>
    <h2 class="bb-ci-h2">Giáp bảo hộ tay chân và phụ kiện giáp — Taichi, Komine, D3O, LS2</h2>
    <p class="bb-ci-body">Giáp bảo hộ tay chân là lớp bảo vệ cứng gắn vào hoặc đặt bên trong áo quần bảo hộ — bảo vệ khuỷu tay, vai, lưng, ngực, gối và hông khi ngã xe. Có 2 nhóm: Giáp rời mua độc lập (đeo trực tiếp lên người qua đai cố định) và Phụ kiện giáp thay thế (miếng giáp CE thay vào vị trí giáp cũ trong áo quần bảo hộ). Bigbike phân phối: Taichi, Komine, D3O, LS2.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Komine</span><span class="bb-ci-pill">D3O</span><span class="bb-ci-pill">LS2</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Giáp CE Level 1 và Level 2 — khác nhau thế nào khi mua rời?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">CE Level 2 chịu lực va đập cao hơn và vượt qua bài test nghiêm ngặt hơn — đáng chọn cho vai, khuỷu và lưng nếu đi xa hoặc tốc độ cao thường xuyên. Level 1 đủ cho đi phố hằng ngày. D3O là vật liệu mềm khi bình thường nhưng cứng lại khi va đập — thoải mái hơn giáp cứng truyền thống cùng chuẩn CE.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Khi nào cần mua giáp rời thay vì mua trong áo giáp?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Mua giáp rời khi áo giáp anh đang dùng có giáp CE cấp thấp và muốn nâng cấp — nhiều áo giáp tầm giá thấp có túi giáp nhưng giáp kèm chỉ là foam đơn giản, không phải CE. Thay miếng giáp CE Level 2 vào đúng túi đó là cách nâng cấp bảo vệ mà không cần mua áo mới.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">D3O có thực sự tốt hơn giáp cứng truyền thống không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Tốt hơn về sự thoải mái — mềm và linh hoạt khi đi lại bình thường, cứng lại tức thì khi va đập. Không cồng kềnh như giáp cứng, phù hợp vị trí như lưng và ngực hay bị vướng. Về mức bảo vệ thì tương đương CE cùng cấp — không phải phép màu, chỉ là vật liệu thông minh hơn.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Cần tư vấn loại giáp phù hợp với áo đang mặc?</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư — nói tên áo giáp đang dùng</a>
  </div>
</div>$ic_vi_wp_cat_293$,
       intro_content_en = $ic_en_wp_cat_293$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · bao-ho-tay-chan-phu-kien-bao-ho</span>
    <h2 class="bb-ci-h2">Motorcycle body armour and protective inserts — Taichi, Komine, D3O, LS2</h2>
    <p class="bb-ci-body">Body armour is hard protective inserts worn in or attached to protective gear — protecting elbows, shoulders, back, chest, knees and hips in a fall. Two groups: Standalone armour (worn independently via dedicated straps) and Replacement inserts (CE-certified armour swapped into existing protective jacket or pants pockets). Bigbike carries: Taichi, Komine, D3O, LS2.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Komine</span><span class="bb-ci-pill">D3O</span><span class="bb-ci-pill">LS2</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">CE Level 1 vs Level 2 armour — what is the practical difference?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">CE Level 2 withstands higher impact forces and passes stricter testing — worth choosing for shoulders, elbows and back if you ride long distances or at speed regularly. Level 1 is adequate for daily city riding. D3O is a soft material that hardens on impact — more comfortable than traditional hard armour at the same CE rating.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">When should I buy standalone armour rather than rely on what came with my jacket?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Buy replacement inserts when your existing jacket has low-grade or non-CE armour pockets — many budget jackets include armour pockets but the supplied inserts are simple foam, not CE certified. Swapping in CE Level 2 inserts is the most cost-effective way to upgrade protection without replacing the jacket.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Is D3O genuinely better than traditional hard armour?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Better in terms of comfort — soft and flexible during normal movement, hardens instantly on impact. Less bulky than traditional hard armour, particularly suitable for back and chest positions where rigidity is uncomfortable. Protection level is equivalent to the same CE rating — not magic, just smarter material engineering.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Need advice on the right armour for your existing gear?</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư — tell us your jacket model</a>
  </div>
</div>$ic_en_wp_cat_293$,
       seo_title = 'Giáp bảo hộ tay chân và phụ kiện giáp mô tô — Taichi, Komine, D3O | Bigbike.vn',
       seo_title_en = 'Motorcycle Body Armour and Protective Inserts — Taichi, Komine, D3O | Bigbike.vn',
       seo_description = 'Giáp bảo vệ khuỷu tay, vai, lưng, ngực, gối, hông cho biker. Taichi, Komine, D3O, LS2. Mua rời hoặc thay giáp trong áo quần bảo hộ. Bigbike.vn TP.HCM — Zalo 0764 640 679.',
       seo_description_en = 'Motorcycle armour for elbows, shoulders, back, chest, knees, hips. Taichi, Komine, D3O, LS2. Standalone or replacement inserts for protective gear. Bigbike.vn HCMC — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-293';
