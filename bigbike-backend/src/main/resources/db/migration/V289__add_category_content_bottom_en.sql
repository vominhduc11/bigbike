-- V289: Add content_bottom_en to categories and backfill bilingual category SEO content (Batch 1, 2, 3)
-- Compliance: AGENTS.md §5.5 (no hardcoded env), §6.2 (design system vars used in HTML class block)
-- Auto-migrated by script.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS content_bottom_en text;

-- Update category ID: wp-cat-289 (Page: 1, url: mu-bao-hiem)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_289$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · mu-bao-hiem</span>
    <h2 class="bb-ci-h2">Mũ bảo hiểm mô tô chính hãng — AGV, LS2, Caberg</h2>
    <p class="bb-ci-body">Mũ bảo hiểm là thứ đầu tiên cần chọn kỹ trước khi mua bất cứ đồ bảo hộ nào — vì đầu là thứ không thể thương lượng. Bigbike phân phối chính hãng từ AGV (Ý), Caberg (Ý), LS2 (Tây Ban Nha), HJC (Hàn Quốc), ILM và NIC. Tất cả đều có chứng nhận ECE 22.06 hoặc DOT, tem nhãn kiểm tra được — không có hàng không rõ nguồn gốc.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">AGV</span><span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">Caberg</span><span class="bb-ci-pill">HJC</span><span class="bb-ci-pill">ILM</span><span class="bb-ci-pill">NIC</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Mũ fullface, lật hàm hay 3/4 — chọn loại nào?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Phụ thuộc vào cách anh chạy. Đi xa tốc độ cao → fullface. Đi phố nhiều điểm dừng → lật hàm. Đi làm hằng ngày dưới 60km/h → 3/4 thoáng hơn.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">ECE 22.06 và DOT khác nhau thế nào?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">ECE 22.06 là chuẩn châu Âu mới nhất, thử 18 điểm va đập. DOT là chuẩn Mỹ. Cả hai đều đạt yêu cầu an toàn — ECE 22.06 nghiêm ngặt hơn một bậc.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Cách xác định size mũ đúng?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Đo vòng đầu bằng thước dây, cách lông mày 2.5cm. S=55–56cm · M=57–58cm · L=59–60cm · XL=61–62cm. Mỗi hãng có bảng riêng — ghé shop đội thử là chắc nhất.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Không chắc chọn loại nào? Nhắn Zalo Mrs. Thư 0764 640 679</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_289$,
       content_bottom_en = $cb_en_wp_cat_289$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · mu-bao-hiem</span>
    <h2 class="bb-ci-h2">Genuine Motorcycle Helmets — AGV, LS2, Caberg, HJC</h2>
    <p class="bb-ci-body">A helmet is the first thing to choose carefully before buying any other protective gear — because your head is non-negotiable. Bigbike carries authorized stock from AGV (Italy), Caberg (Italy), LS2 (Spain), HJC (South Korea), ILM and NIC. Every helmet holds ECE 22.06 or DOT certification with verifiable authentication labels — no unverified stock.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">AGV</span><span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">Caberg</span><span class="bb-ci-pill">HJC</span><span class="bb-ci-pill">ILM</span><span class="bb-ci-pill">NIC</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Full-face, flip-up or open-face — which should I choose?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Depends on how you ride. Long-distance at high speed → full-face. City riding with frequent stops → flip-up. Daily commuting under 60 km/h → open-face is more ventilated.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">What is the difference between ECE 22.06 and DOT?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">ECE 22.06 is the latest European standard, testing 18 impact points. DOT is the American standard. Both meet safety requirements — ECE 22.06 is one level stricter.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">How do I find my correct helmet size?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Measure your head circumference with a soft tape, 2.5 cm above the eyebrows. S=55–56cm · M=57–58cm · L=59–60cm · XL=61–62cm. Each brand has its own sizing chart — trying on in-store is always the safest option.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Not sure which type to get? Message Mrs. Thư on Zalo 0764 640 679</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_289$,
       seo_title = 'Mũ bảo hiểm mô tô chính hãng — AGV, LS2, Caberg | Bigbike.vn',
       seo_title_en = 'Genuine Motorcycle Helmets — AGV, LS2, Caberg, HJC | Bigbike.vn',
       seo_description = 'Bigbike.vn phân phối chính hãng mũ bảo hiểm AGV, LS2, Caberg, HJC tại TP.HCM từ 2014. ECE 22.06 và DOT. Tư vấn thật — đổi size 7 ngày. Zalo 0764 640 679.',
       seo_description_en = 'Bigbike.vn — authorized retailer of AGV, LS2, Caberg, HJC helmets in Ho Chi Minh City since 2014. ECE 22.06 and DOT certified. Honest advice, 7-day size exchange. Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-289';

-- Update category ID: wp-cat-303 (Page: 2, url: mu-bao-hiem/fullface)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_303$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · mu-bao-hiem/fullface</span>
    <h2 class="bb-ci-h2">Mũ bảo hiểm fullface chính hãng — AGV, LS2, Caberg</h2>
    <p class="bb-ci-body">Fullface che kín toàn bộ đầu và cằm — cấp bảo vệ cao nhất trong 4 loại mũ. Đây là lựa chọn mặc định cho biker đi tốc độ cao, đi phượt xa, hoặc đi đường đèo. Bigbike hiện có: AGV K1S · AGV K3 SV · Caberg Drift Evo II · LS2 FF320 · LS2 FF800 Storm · ILM fullface. Tất cả có chuẩn ECE 22.06 hoặc DOT.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">AGV</span><span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">Caberg</span><span class="bb-ci-pill">ILM</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">AGV K1S và LS2 FF320 — khác nhau điểm gì?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">AGV K1S (6.1tr) vỏ ABS cao cấp, kính lớn tầm nhìn rộng hơn, đệm tháo giặt được. LS2 FF320 (2.2tr) là entry-level tốt nhất tầm giá — đủ chuẩn, nhẹ, phù hợp biker mới.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Mũ fullface đội mùa nóng có bí không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Bí hơn 3/4 — đó là thực tế. Nhưng các dòng hiện đại đều có hệ thống thông gió trước và sau. AGV K1S và LS2 FF800 thoáng tốt ở tốc độ trên 40km/h. Đứng yên thì vẫn nóng.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Pinlock có bắt buộc không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Không bắt buộc — nhưng đi mùa mưa hoặc đi đèo buổi sáng sớm thì cần. Hơi thở đọng kính giữa đèo là nguy hiểm thật. Pinlock 400–900k tùy mũ.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Cần tư vấn chọn model phù hợp tầm giá? Nhắn Zalo Mrs. Thư 0764 640 679.</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_303$,
       content_bottom_en = $cb_en_wp_cat_303$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · mu-bao-hiem/fullface</span>
    <h2 class="bb-ci-h2">Genuine Full-Face Helmets — AGV, LS2, Caberg</h2>
    <p class="bb-ci-body">Full-face helmets cover the entire head and chin — the highest protection level among the four helmet types. The default choice for riders who ride at speed, tour long distances, or take mountain passes. Currently in stock: AGV K1S · AGV K3 SV · Caberg Drift Evo II · LS2 FF320 · LS2 FF800 Storm · ILM full-face. All carry ECE 22.06 or DOT certification.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">AGV</span><span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">Caberg</span><span class="bb-ci-pill">ILM</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">AGV K1S vs LS2 FF320 — what are the key differences?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">AGV K1S (6,100,000 VND) features premium ABS shell, wider field of vision, and removable washable liner. LS2 FF320 (2,200,000 VND) is the best entry-level option at the price — certified, lightweight, ideal for new riders.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Is a full-face helmet too hot to wear in warm weather?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">More enclosed than open-face — that is the reality. However, modern designs include front and rear ventilation systems. AGV K1S and LS2 FF800 ventilate well at speeds above 40 km/h. At a standstill it will still feel warm.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Is a Pinlock visor insert necessary?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Not essential — but strongly recommended for rainy season riding or mountain passes in the early morning. Fogging visor mid-descent is a genuine safety hazard. Pinlock inserts cost 400,000–900,000 VND depending on the helmet model.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Need help choosing the right model for your budget? Message Mrs. Thư on Zalo 0764 640 679.</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_303$,
       seo_title = 'Mũ bảo hiểm fullface chính hãng — AGV, LS2, Caberg | Bigbike.vn',
       seo_title_en = 'Genuine Full-Face Helmets — AGV, LS2, Caberg | Bigbike.vn HCMC',
       seo_description = 'Fullface bảo vệ toàn diện cho biker đi xa và tốc độ cao. AGV K1S, LS2 FF320, FF800, Caberg Drift Evo II. ECE 22.06. Bigbike.vn TP.HCM từ 2014.',
       seo_description_en = 'Full-face helmets for high-speed and long-distance riders. AGV K1S, LS2 FF320, FF800, Caberg Drift Evo II. ECE 22.06 certified. Bigbike.vn Ho Chi Minh City since 2014.',
       updated_at = now()
WHERE  id = 'wp-cat-303';

-- Update category ID: wp-cat-325 (Page: 3, url: mu-bao-hiem/dual-sport)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_325$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · mu-bao-hiem/dual-sport</span>
    <h2 class="bb-ci-h2">Mũ dual-sport và cào cào chính hãng — LS2, Caberg, ILM</h2>
    <p class="bb-ci-body">Mũ dual-sport (cào cào) có vành che nắng và kính lớn — vừa chạy đường nhựa tốt, vừa đủ bảo vệ khi vào địa hình. Phong cách ADV đặc trưng, thường nhẹ hơn fullface cùng tầm giá. Shop hiện có: LS2 MX436 Pioneer · Caberg Tanami Carbon · ILM WS-902. Phù hợp nhất cho biker chạy xe adventure hoặc naked đi cả hai loại đường.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">Caberg</span><span class="bb-ci-pill">ILM</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Dual-sport bảo vệ có kém fullface không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Kém hơn ở phần cằm vì không có thanh cằm cứng như fullface. Nhưng đủ chuẩn ECE — nhiều touring rider chọn dual-sport vì nhẹ hơn và tầm nhìn rộng hơn khi đi xa.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Đi đường nhựa dài có hợp không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Hợp nếu anh đi tốc độ trung bình dưới 100km/h. Trên 100km/h liên tục thì tiếng ồn gió lớn hơn fullface — tai nghe Bluetooth sẽ giúp giảm ồn.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Caberg Tanami Carbon giá 12tr có đáng không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Đáng nếu anh đi xa thường xuyên — carbon nhẹ hơn ABS khoảng 200–300g, đi cả ngày giảm mỏi cổ rõ. Không đáng nếu anh đi cuối tuần ngắn — LS2 MX436 đủ dùng và tiết kiệm hơn nhiều.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Muốn thử đội trực tiếp? Ghé 79/30/52 Âu Cơ, Phường Hòa Bình, TP.HCM. T2–T7: 9–21h.</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_325$,
       content_bottom_en = $cb_en_wp_cat_325$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · mu-bao-hiem/dual-sport</span>
    <h2 class="bb-ci-h2">Genuine Dual-Sport Helmets — LS2, Caberg, ILM</h2>
    <p class="bb-ci-body">Dual-sport helmets feature a peak visor and wide eye port — equally capable on tarmac and light off-road. ADV-distinctive styling, typically lighter than a full-face at the same price point. Currently in stock: LS2 MX436 Pioneer · Caberg Tanami Carbon · ILM WS-902. Best suited for riders on adventure bikes or naked bikes covering mixed terrain.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">Caberg</span><span class="bb-ci-pill">ILM</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Does a dual-sport helmet offer less protection than a full-face?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Slightly less at the chin bar area, since it lacks the rigid chin piece of a full-face. However all models meet ECE certification — and many touring riders choose dual-sport for the lighter weight and wider field of view on long rides.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Is it suitable for long tarmac touring?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Yes, at moderate speeds below 100 km/h. Above 100 km/h continuously, wind noise is noticeably greater than a full-face — a Bluetooth intercom helps reduce that significantly.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Is the Caberg Tanami Carbon worth 12,000,000 VND?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Worth it if you ride long distances regularly — carbon is 200–300g lighter than ABS, which reduces neck fatigue noticeably over a full day. Not worth it for occasional weekend rides — the LS2 MX436 is more than adequate and considerably more affordable.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Want to try one on in person? Visit 79/30/52 Âu Cơ, Hòa Bình Ward, Ho Chi Minh City. Mon–Sat: 9 AM–9 PM.</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_325$,
       seo_title = 'Mũ dual-sport và cào cào chính hãng — LS2, Caberg, ILM | Bigbike.vn',
       seo_title_en = 'Genuine Dual-Sport Helmets — LS2, Caberg, ILM | Bigbike.vn HCMC',
       seo_description = 'Mũ dual-sport vừa đường nhựa vừa địa hình. LS2 MX436, Caberg Tanami Carbon, ILM WS-902. Chính hãng, ECE chuẩn. Bigbike.vn TP.HCM — tư vấn Zalo 0764 640 679.',
       seo_description_en = 'Dual-sport helmets for mixed road and off-road riding. LS2 MX436, Caberg Tanami Carbon, ILM WS-902. ECE certified, ADV style. Bigbike.vn HCMC — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-325';

-- Update category ID: wp-cat-309 (Page: 4, url: mu-bao-hiem/lat-ham)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_309$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · mu-bao-hiem/lat-ham</span>
    <h2 class="bb-ci-h2">Mũ lật hàm chính hãng — LS2, HJC</h2>
    <p class="bb-ci-body">Lật hàm cho anh cảm giác fullface khi đang chạy, và sự tiện lợi khi dừng — không cần tháo mũ để uống nước, đổ xăng, hay hỏi đường. Phần lật phải chắc, không rung ở tốc độ cao — đây là điểm cần kiểm tra kỹ. Shop có: LS2 FF906 · LS2 FF901 Advant X · HJC i90. Tất cả đều test cơ chế lật trước khi bán.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">HJC</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Mũ lật hàm có an toàn bằng fullface không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Thấp hơn một chút ở phần cằm — đây là nhược điểm thực tế. Tuy nhiên LS2 FF901 và HJC i90 đều có chuẩn P/J (vừa lật vừa đóng đều pass test) nên đã được kiểm định nghiêm túc.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Nặng hơn fullface bao nhiêu?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Nặng hơn 200–400g tùy model — vì có thêm cơ cấu khớp lật. LS2 FF906 (1.6kg) nặng hơn FF320 fullface (1.35kg) khoảng 250g. Đi xa ngày dài thì cảm nhận được.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">LS2 FF906 và FF901 Advant X khác gì?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">FF906 (2.8tr) là lật hàm cơ bản — đủ dùng, tốt tầm giá. FF901 Advant X (11.9tr) vỏ composite nhẹ hơn, có chuẩn P/J, kính sun visor tích hợp — dành cho biker đi xa nghiêm túc.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Không chắc chọn model nào? Nhắn Zalo Mrs. Thư 0764 640 679</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_309$,
       content_bottom_en = $cb_en_wp_cat_309$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · mu-bao-hiem/lat-ham</span>
    <h2 class="bb-ci-h2">Genuine Flip-Up Helmets — LS2, HJC</h2>
    <p class="bb-ci-body">Flip-up helmets give you full-face protection while riding and the convenience of opening up at a stop — no need to remove the helmet to drink water, refuel, or ask for directions. The flip mechanism must be solid with no vibration at speed — this is the critical quality point. Currently in stock: LS2 FF906 · LS2 FF901 Advant X · HJC i90. All flip mechanisms are tested before sale.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">HJC</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Is a flip-up helmet as safe as a full-face?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Marginally lower chin protection — that is the honest answer. However, the LS2 FF901 and HJC i90 both carry P/J certification (tested in both open and closed positions), so they pass rigorous safety standards.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">How much heavier is it than a full-face?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Around 200–400g heavier depending on the model, due to the flip mechanism. LS2 FF906 (1.6 kg) is approximately 250g heavier than the FF320 full-face (1.35 kg). Over a full day of riding this is noticeable.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">What is the difference between LS2 FF906 and FF901 Advant X?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">FF906 (2,800,000 VND) is the entry-level flip-up — solid performance at the price. FF901 Advant X (11,900,000 VND) features composite shell for lower weight, P/J certification, and integrated sun visor — built for serious long-distance tourers.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Unsure which model suits your riding style? Message Mrs. Thư on Zalo 0764 640 679 for honest advice.</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_309$,
       seo_title = 'Mũ lật hàm chính hãng — LS2, HJC | Bigbike.vn TP.HCM',
       seo_title_en = 'Genuine Flip-Up Helmets — LS2, HJC | Bigbike.vn Ho Chi Minh City',
       seo_description = 'Mũ lật hàm linh hoạt cho đi phố và đi xa. LS2 FF906, FF901 Advant X, HJC i90. Chuẩn ECE, cơ cấu lật bền. Bigbike.vn — tư vấn Zalo 0764 640 679.',
       seo_description_en = 'Flip-up helmets — full-face protection when riding, open convenience at stops. LS2 FF906, FF901 Advant X, HJC i90. ECE P/J certified. Bigbike.vn — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-309';

-- Update category ID: wp-cat-318 (Page: 5, url: mu-bao-hiem/mu-34)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_318$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · mu-bao-hiem/mu-34</span>
    <h2 class="bb-ci-h2">Mũ bảo hiểm 3/4 chính hãng — LS2, HJC</h2>
    <p class="bb-ci-body">Mũ 3/4 che tai và gáy, để hở mặt — nhẹ và thoáng hơn fullface nhiều, phù hợp đi phố tốc độ dưới 60km/h. Mũ 1/2 nhẹ nhất nhưng bảo vệ tối thiểu — chỉ phù hợp đường nội khu, tốc độ thấp. Nếu anh chạy phố SG thường xuyên và không lên cao tốc, 3/4 là lựa chọn hợp lý về cân bằng giữa bảo hộ và sự thoải mái.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">HJC</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Mũ 3/4 có cần mua kính che mặt riêng không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Nên có nếu đi ban ngày nhiều — nắng SG và bụi đường làm mờ tầm nhìn. Kính rời gắn cùm tầm 200–400k. Một số mũ 3/4 đã có kính sun visor tích hợp — hỏi shop khi chọn.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Mũ 1/2 có đủ tiêu chuẩn không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Có — các dòng shop bán đều có DOT hoặc ECE. Nhưng bảo vệ thấp hơn hẳn 3/4 và fullface ở phần gáy và tai. Không khuyến khích cho đường có xe lớn hoặc tốc độ trên 40km/h.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Phụ nữ đội có hợp không, nặng không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Hợp — 3/4 là loại mũ nhiều chị em chọn nhất vì nhẹ (thường 800g–1.1kg) và không gây hấp hơi. LS2 OF600 có nhiều màu pastel, khóa dễ gài một tay.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Xem thêm sản phẩm bên dưới hoặc nhắn Zalo Mrs. Thư 0764 640 679 để hỏi size.</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_318$,
       content_bottom_en = $cb_en_wp_cat_318$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · mu-bao-hiem/mu-34</span>
    <h2 class="bb-ci-h2">Genuine Open-Face 3/4 Helmets — LS2, HJC</h2>
    <p class="bb-ci-body">Open-face 3/4 helmets cover the ears and back of the head with the face exposed — significantly lighter and better ventilated than full-face, suited for city riding under 60 km/h. Half-face helmets are the lightest option but offer minimal protection — only appropriate for low-speed residential roads. For riders commuting regularly in Saigon without highway use, the 3/4 strikes a reasonable balance between protection and comfort.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">HJC</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Do I need a separate face shield with a 3/4 helmet?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Advisable if riding in daytime frequently — Saigon sun and road dust reduce visibility noticeably. Clip-on visors cost 200,000–400,000 VND. Some 3/4 helmets include an integrated sun visor — ask in-store when choosing.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Are half-face helmets genuinely certified?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Yes — all models sold in the store carry DOT or ECE certification. However, protection at the back of the head and ears is significantly lower than 3/4 or full-face. Not recommended for roads with heavy vehicles or speeds above 40 km/h.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Is it suitable for women? Is it heavy?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Very suitable — 3/4 is the most popular helmet type among female riders for its light weight (typically 800g–1.1g) and lack of heat buildup. LS2 OF600 comes in multiple pastel colours with a one-hand buckle.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Browse the products below or message Mrs. Thư on Zalo 0764 640 679 to check sizing.</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_318$,
       seo_title = 'Mũ bảo hiểm 3/4 chính hãng — LS2, HJC | Bigbike.vn TP.HCM',
       seo_title_en = 'Genuine Open-Face 3/4 Helmets — LS2, HJC | Bigbike.vn HCMC',
       seo_description = 'Mũ 3/4 thoáng mát cho đi phố dưới 60km/h. LS2 OF600, HJC V31. Nhẹ, đẹp, đủ chuẩn ECE. Bigbike.vn TP.HCM từ 2014 — tư vấn Zalo 0764 640 679.',
       seo_description_en = 'Open-face 3/4 helmets — lightweight, ventilated, for city riding under 60 km/h. LS2 OF600, HJC V31. ECE certified. Bigbike.vn Ho Chi Minh City since 2014 — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-318';

-- Update category ID: wp-cat-290 (Page: 6, url: ao-quan-moto-phuot)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_290$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · ao-quan-moto-phuot</span>
    <h2 class="bb-ci-h2">Áo giáp bảo hộ mô tô — Komine, Taichi, Scoyco</h2>
    <p class="bb-ci-body">Áo giáp bảo hộ là lớp bảo vệ thân thể quan trọng thứ hai sau mũ — vai, khuỷu tay, lưng và ngực là những vùng chấn thương nặng nhất khi ngã xe. Shop phân phối: Komine (Nhật), Taichi (Nhật), Scoyco, ILM, Hevik. Chia 3 sub theo nhu cầu: Mùa hè (mesh, thoáng), Touring (4 mùa, chống nước) và Adventure (địa hình). CE Level là chỉ số quan trọng nhất cần kiểm tra khi chọn.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">ILM</span><span class="bb-ci-pill">Komine</span><span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Scoyco</span><span class="bb-ci-pill">Hevik</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">CE Level 1 và CE Level 2 khác gì?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">CE Level 2 chịu lực va đập cao hơn và được kiểm định nghiêm hơn. Đi phố ngắn thì Level 1 đủ dùng. Đi xa, tốc độ cao, đèo dốc — nên chọn giáp CE Level 2 ở vai và khuỷu.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Mặc áo giáp SG có nóng không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Dòng mesh thì không — Scoyco JK44 và Komine JK-114 thiết kế lưới thoáng, gió đi qua khi chạy. Nóng hơn áo thường một chút nhưng không bức. Đứng yên ngoài nắng mới thực sự nóng.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Komine và Taichi khác nhau thế nào?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Komine thiết kế cho khí hậu châu Á — thoáng tốt hơn, nhiều size lớn hơn, giá phải chăng hơn. Taichi cao cấp hơn một bậc, vật liệu tốt hơn, giá cao hơn 20–30%. Đi phượt VN thì Komine phù hợp hơn về thực dụng.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Cần tư vấn combo áo + quần theo ngân sách và cung đường? Nhắn Zalo Mrs. Thư 0764 640 679.</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_290$,
       content_bottom_en = $cb_en_wp_cat_290$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · ao-quan-moto-phuot</span>
    <h2 class="bb-ci-h2">Genuine Motorcycle Protective Jackets — Komine, Taichi, Scoyco</h2>
    <p class="bb-ci-body">Protective jackets are the second most important piece of gear after the helmet — shoulders, elbows, back and chest are the highest-injury areas in a fall. Bigbike carries: Komine (Japan), Taichi (Japan), Scoyco, ILM, Hevik. Split into three sub-categories by use case: Summer (mesh, ventilated), Touring (all-season, waterproof) and Adventure (off-road terrain). CE Level certification is the single most important figure to check when selecting protective gear.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">ILM</span><span class="bb-ci-pill">Komine</span><span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Scoyco</span><span class="bb-ci-pill">Hevik</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">What is the difference between CE Level 1 and CE Level 2?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">CE Level 2 withstands higher impact forces and is held to stricter testing standards. Level 1 is adequate for short city riding. For long distances, high speeds, or mountain passes — Level 2 protection at the shoulders and elbows is the better choice.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Is wearing a protective jacket bearable in Saigon's heat?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Mesh designs manage well — Scoyco JK44 and Komine JK-114 are purpose-built with high ventilation mesh, allowing airflow when moving. Slightly warmer than a regular shirt but not stifling. Standing still in direct sun is when it becomes genuinely hot.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">What is the practical difference between Komine and Taichi?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Komine is designed for Asian climates — better ventilation, wider size range, more accessible pricing. Taichi is a step up in material quality at 20–30% higher price. For touring in Vietnam, Komine is the more practical choice.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Need advice on a jacket and pants combo within your budget? Message Mrs. Thư on Zalo 0764 640 679.</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_290$,
       seo_title = 'Áo giáp bảo hộ mô tô — Komine, Taichi, Scoyco | Bigbike.vn',
       seo_title_en = 'Genuine Motorcycle Protective Jackets — Komine, Taichi, Scoyco | Bigbike.vn',
       seo_description = 'Áo giáp CE Level 1 & 2 chính hãng tại TP.HCM. Komine, Taichi, Scoyco, Hevik. Mùa hè mesh thoáng, Touring 4 mùa, Adventure địa hình. Zalo 0764 640 679.',
       seo_description_en = 'CE Level 1 and 2 certified jackets and pants in Ho Chi Minh City. Komine, Taichi, Scoyco, Hevik. Summer mesh, all-season touring, adventure off-road. Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-290';

-- Update category ID: wp-cat-304 (Page: 7, url: ao-quan-moto-phuot/mua-he)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_304$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · ao-quan-moto-phuot/mua-he</span>
    <h2 class="bb-ci-h2">Áo giáp mùa hè mesh thoáng — Scoyco, Komine</h2>
    <p class="bb-ci-body">Áo giáp mesh thiết kế riêng cho khí hậu nóng — lưới nhiều, gió đi qua khi chạy, nhẹ hơn đáng kể so với áo touring. Không chống thấm, không có lining nhiệt — đúng với mục đích đi phố mùa nóng. Shop có: Scoyco JK44 · Scoyco JK52 · Komine JK-114 mesh · Komine JK-127. Giáp CE Level 1 ở vai và khuỷu — đủ cho đi phố tốc độ vừa.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Komine</span><span class="bb-ci-pill">Scoyco</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Scoyco JK44 và JK52 khác nhau gì?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">JK44 thoáng hơn, nhẹ hơn, giá thấp hơn (~1.5tr) — tốt cho đi phố hằng ngày. JK52 lưới dày hơn, bảo vệ tốt hơn một bậc, giá ~1.9tr. Cả hai đều phù hợp SG mùa hè.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Áo mesh mặc đi phượt ngắn 1 ngày có được không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Được nếu không có mưa và đường nhựa. Nhưng nếu đi đèo, trời có thể mưa bất chợt thì nên đem thêm áo mưa rời — áo mesh không chống nước, ướt là ướt hết.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Giặt áo giáp mesh như thế nào?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Tháo giáp cứng ra trước, giặt tay hoặc máy chế độ nhẹ. Không sấy — để ráo tự nhiên. Komine và Scoyco đều có hướng dẫn giặt trên nhãn sản phẩm.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Xem thêm sản phẩm bên dưới hoặc nhắn Zalo Mrs. Thư 0764 640 679 để hỏi size.</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_304$,
       content_bottom_en = $cb_en_wp_cat_304$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · ao-quan-moto-phuot/mua-he</span>
    <h2 class="bb-ci-h2">Summer Mesh Motorcycle Jackets — Scoyco, Komine</h2>
    <p class="bb-ci-body">Mesh jackets are purpose-built for hot climates — high perforation panels allow airflow when moving, significantly lighter than a touring jacket. No waterproofing, no thermal liner — correctly matched to hot-weather city use. Currently in stock: Scoyco JK44 · Scoyco JK52 · Komine JK-114 mesh · Komine JK-127. CE Level 1 armour at shoulders and elbows — adequate protection for moderate-speed city riding.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Komine</span><span class="bb-ci-pill">Scoyco</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">What is the difference between Scoyco JK44 and JK52?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">JK44 is more ventilated, lighter, and lower priced (~1,500,000 VND) — well suited for daily city commuting. JK52 has denser mesh construction, one level up in protection, priced at ~1,900,000 VND. Both handle Saigon summers well.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Can I wear a mesh jacket for a short one-day ride?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Yes, if no rain is expected and the route is tarmac. However, if passing through mountain areas where rain can arrive suddenly, pack a separate rain jacket — mesh offers zero water resistance.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">How do I wash a mesh protective jacket?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Remove the hard armour inserts first, then hand wash or machine wash on a gentle cycle. Do not tumble dry — air dry flat. Both Komine and Scoyco include care instructions on the product label.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct">Browse the products below or message Mrs. Thư on Zalo 0764 640 679 to check sizing.</span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_304$,
       seo_title = 'Áo giáp mùa hè mesh thoáng — Scoyco, Komine | Bigbike.vn TP.HCM',
       seo_title_en = 'Summer Mesh Motorcycle Jackets — Scoyco, Komine | Bigbike.vn HCMC',
       seo_description = 'Áo giáp mesh CE thoáng khí cho mùa nóng SG. Scoyco JK44, JK52, Komine JK-114. Nhẹ, gió đi qua khi chạy. Bigbike.vn — Zalo 0764 640 679.',
       seo_description_en = 'CE certified mesh jackets for hot weather riding in Saigon. Scoyco JK44, JK52, Komine JK-114. Lightweight, airflow design. Bigbike.vn — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-304';

-- Update category ID: wp-cat-291 (Page: G1, url: gang-tay)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_291$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · gang-tay</span>
    <h2 class="bb-ci-h2">Găng tay bảo hộ mô tô chính hãng — Komine, Taichi, Scoyco</h2>
    <p class="bb-ci-body">Tay là thứ chạm đất đầu tiên khi ngã xe — và là thứ ít biker nhớ bảo vệ nhất. Găng tay bảo hộ CE có giáp cứng ở mu bàn tay, ngón cái và lòng bàn tay — giảm chấn thương gãy ngón và trầy da đáng kể. Bigbike phân phối: Komine (Nhật), Taichi (Nhật), Scoyco, ILM, Hevik. Chia 2 nhóm theo nhu cầu: Mùa hè (cổ ngắn, thoáng) và Touring (cổ dài, chống nước, ấm hơn).</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">ILM</span><span class="bb-ci-pill">Komine</span><span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Scoyco</span><span class="bb-ci-pill">Hevik</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Găng tay bảo hộ và găng tay thường khác nhau thế nào?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Găng bảo hộ CE có giáp cứng nhựa hoặc gel ở mu bàn tay và ngón cái, lớp lót kevlar hoặc da chống trầy ở lòng bàn tay. Găng thường chỉ là vải — không có giáp, không có tác dụng bảo vệ khi ngã tốc độ cao.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">CE Level 1 và CE Level 2 cho găng tay — chọn loại nào?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">CE Level 2 chịu lực va đập cao hơn — đáng chọn nếu đi xa, đi đèo, hoặc tốc độ cao thường xuyên. Level 1 đủ cho đi phố hằng ngày dưới 60km/h. Hầu hết găng Komine và Taichi tầm 1–2tr đều là Level 1.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Cổ ngắn hay cổ dài — nên chọn loại nào cho đi phố?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Cổ ngắn tiện hơn — dễ đeo tháo, mát hơn, phù hợp đi phố SG. Cổ dài trùm vào tay áo chống gió lạnh và che vùng cổ tay khi ngã — cần thiết nếu đi xa hoặc đi vào mùa lạnh.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_291$,
       content_bottom_en = $cb_en_wp_cat_291$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · gang-tay</span>
    <h2 class="bb-ci-h2">Genuine Motorcycle Gloves — Komine, Taichi, Scoyco</h2>
    <p class="bb-ci-body">Hands are the first point of contact in a fall — and the most commonly forgotten piece of protective gear. CE certified gloves feature hard armour at the knuckles, thumb and palm — significantly reducing fractures and road rash. Bigbike carries: Komine (Japan), Taichi (Japan), Scoyco, ILM, Hevik. Split into two groups by use: Summer (short-cuff, ventilated) and Touring (long-cuff, waterproof, warmer).</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">ILM</span><span class="bb-ci-pill">Komine</span><span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Scoyco</span><span class="bb-ci-pill">Hevik</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">What is the difference between protective gloves and regular gloves?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">CE protective gloves have hard plastic or gel armour at the knuckles and thumb, plus kevlar or leather palm lining to prevent road rash. Regular gloves are just fabric — no armour, no real protection in a high-speed fall.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">CE Level 1 vs Level 2 for gloves — which to choose?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">CE Level 2 handles higher impact — worth choosing for long-distance, mountain passes, or regular high-speed riding. Level 1 is adequate for daily city commuting under 60 km/h. Most Komine and Taichi gloves in the 1–2 million VND range are Level 1.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Short-cuff or long-cuff — which is better for city riding?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Short-cuff is more practical — easier to put on and take off, cooler, well suited for Saigon city riding. Long-cuff tucks into the jacket sleeve, protecting against wind and wrist exposure in a fall — necessary for long-distance or cold-weather riding.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_291$,
       seo_title = 'Găng tay bảo hộ mô tô chính hãng — Komine, Taichi, Scoyco | Bigbike.vn',
       seo_title_en = 'Genuine Motorcycle Gloves — Komine, Taichi, Scoyco | Bigbike.vn HCMC',
       seo_description = 'Găng tay bảo hộ CE chính hãng tại TP.HCM. Komine, Taichi, Scoyco, ILM, Hevik. Mùa hè cổ ngắn và Touring cổ dài. Tư vấn thật — Zalo 0764 640 679.',
       seo_description_en = 'CE certified motorcycle gloves in Ho Chi Minh City. Komine, Taichi, Scoyco, ILM, Hevik. Summer short-cuff and Touring long-cuff. Honest advice — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-291';

-- Update category ID: wp-cat-292 (Page: S1, url: giay)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_292$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · giay</span>
    <h2 class="bb-ci-h2">Giày bảo hộ mô tô chính hãng — Alpinestars, TCX, Forma</h2>
    <p class="bb-ci-body">Giày bảo hộ mô tô bảo vệ mắt cá, bàn chân và ngăn khớp cổ chân xoắn khi ngã — đây là chấn thương phổ biến nhất sau tai nạn xe máy. Khác với giày thường, giày bảo hộ có giáp cứng ở mắt cá, mũi bàn chân và gót, đế chống trơn trượt. Bigbike phân phối: Alpinestars, TCX, Forma. Chia 2 nhóm: Mùa hè (thoáng, giống sneaker) và Touring (cao cổ, chống nước, bảo vệ cao hơn).</p>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Giày bảo hộ có khác nhiều so với giày thường khi đi lại không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Khác nhưng không bất tiện như nhiều người nghĩ. Dòng mùa hè (TCX Mood, Alpinestars Faster) trông như sneaker bình thường — đi vào quán cafe, văn phòng không ai nhận ra. Dòng touring cao cổ hơn, hơi cứng ban đầu nhưng quen sau 1–2 tuần.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Giày bảo hộ và giày thường — bảo vệ thực tế khác nhau ra sao?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Trong va chạm tốc độ 30–40km/h, mắt cá không có giáp cứng rất dễ gãy hoặc trật khớp. Giày bảo hộ có thanh cứng ở hai bên mắt cá giữ khớp không xoắn — đây là điểm khác biệt quan trọng nhất, không phải phần đế hay bề ngoài.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Dòng mùa hè có thể đi phượt ngắn không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Được nếu đường nhựa và không mưa. Nhưng đi đèo, đường rừng, hay thời tiết thay đổi thì dòng touring chống nước và cao cổ hơn sẽ bảo vệ tốt hơn đáng kể.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_292$,
       content_bottom_en = $cb_en_wp_cat_292$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · giay</span>
    <h2 class="bb-ci-h2">Genuine Motorcycle Boots — Alpinestars, TCX, Forma</h2>
    <p class="bb-ci-body">Motorcycle boots protect the ankle, foot, and prevent ankle joint rotation in a fall — one of the most common injuries in motorcycle accidents. Unlike regular shoes, protective boots have hard armour at the ankles, toe cap and heel, with anti-slip soles. Bigbike carries: Alpinestars, TCX, Forma. Split into two groups: Summer (ventilated, sneaker-style) and Touring (high-cut, waterproof, higher protection).</p>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Are motorcycle boots noticeably different from regular shoes for walking?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Different but less inconvenient than most people expect. Summer styles (TCX Mood, Alpinestars Faster) look like regular sneakers — walking into a cafe or office nobody will notice. Touring boots are higher cut and slightly stiffer initially but break in within one to two weeks.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">What is the practical protection difference between motorcycle boots and regular shoes?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">In a 30–40 km/h impact, unprotected ankles fracture or dislocate easily. Motorcycle boots have rigid side reinforcement that prevents ankle joint rotation — this is the single most important differentiator, not the sole or appearance.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Can summer boots be used for short touring rides?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Yes on dry tarmac. For mountain passes, forest roads, or unpredictable weather, waterproof high-cut touring boots provide meaningfully better protection.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_292$,
       seo_title = 'Giày bảo hộ mô tô chính hãng — Alpinestars, TCX, Forma | Bigbike.vn',
       seo_title_en = 'Genuine Motorcycle Boots — Alpinestars, TCX, Forma | Bigbike.vn HCMC',
       seo_description = 'Giày bảo hộ mô tô chính hãng tại TP.HCM. Alpinestars, TCX, Forma. Mùa hè thoáng và Touring chống nước. Bảo vệ mắt cá, ngăn xoắn khớp. Zalo 0764 640 679.',
       seo_description_en = 'Genuine motorcycle boots in Ho Chi Minh City. Alpinestars, TCX, Forma. Summer ventilated and Touring waterproof. Ankle protection, anti-twist reinforcement. Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-292';

-- Update category ID: wp-cat-294 (Page: B1, url: balo-tui-deo-tui-treo-xe)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_294$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · balo-tui-deo-tui-treo-xe</span>
    <h2 class="bb-ci-h2">Balo và túi mô tô chính hãng — Komine, Givi, Taichi</h2>
    <p class="bb-ci-body">Túi và balo cho biker không chỉ là chỗ đựng đồ — chúng cần giữ chắc ở tốc độ cao, chống nước khi mưa bất chợt, và không gây mất cân bằng khi chạy đường dài. Bigbike phân phối: Komine, Taichi, ILM, LS2, Rhinowalk, Givi, Hevik. Chia 3 nhóm theo cách mang: Balo (đeo lưng), Túi đeo (đeo chéo / đeo bụng / đeo đùi), Túi treo xe (gắn bình xăng, hông xe, yên sau).</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">ILM</span><span class="bb-ci-pill">Komine</span><span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Hevik</span><span class="bb-ci-pill">Givi</span><span class="bb-ci-pill">Rhinowalk</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Balo thường và balo mô tô chuyên dụng khác nhau thế nào?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Balo mô tô có dây đai ngực + bụng giữ chặt khi chạy, lưng cứng hoặc đệm chống va đập, chất liệu chống nước hoặc có áo mưa kèm. Balo thường không có các tính năng này — rung lắc ở tốc độ cao, mưa là ướt hết đồ.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Nên chọn balo hay túi treo xe cho chuyến phượt dài ngày?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Đi dài ngày (3+ ngày) nên kết hợp cả hai — balo nhỏ 15–20L cho đồ cần lấy nhanh (nước uống, giấy tờ, điện thoại), túi treo xe 2 bên hông hoặc túi yên cho quần áo và đồ nặng. Chỉ dùng balo lớn một mình thì mỏi lưng và ảnh hưởng cân bằng xe.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Túi bình xăng có tương thích với mọi dòng xe không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Không — túi bình xăng dùng nam châm gắn vào nắp bình. Xe có nắp bình nhôm hoặc composite (một số naked bike, ADV) thì nam châm không bám. Cần hỏi rõ khi mua. Rhinowalk và Givi có dòng dùng dây đai thay nam châm — phù hợp hơn cho xe không tương thích nam châm.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_294$,
       content_bottom_en = $cb_en_wp_cat_294$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · balo-tui-deo-tui-treo-xe</span>
    <h2 class="bb-ci-h2">Genuine Motorcycle Bags — Komine, Givi, Taichi</h2>
    <p class="bb-ci-body">Bags and luggage for bikers are more than storage — they need to stay secure at speed, resist rain, and not affect balance on long rides. Bigbike carries: Komine, Taichi, ILM, LS2, Rhinowalk, Givi, Hevik. Split into three groups by carrying method: Backpacks (worn on back), Sling bags (cross-body / chest / thigh), Bike-mounted bags (tank bags, panniers, seat bags).</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">ILM</span><span class="bb-ci-pill">Komine</span><span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Hevik</span><span class="bb-ci-pill">Givi</span><span class="bb-ci-pill">Rhinowalk</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">What is the difference between a regular backpack and a motorcycle-specific backpack?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Motorcycle backpacks have chest and waist straps to stay secure at speed, a rigid back panel or impact padding, and waterproof material or an included rain cover. Regular backpacks have none of these — they shift at high speed and soak through in rain.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Backpack or bike-mounted bags for a multi-day tour?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">For trips of 3+ days, combine both — a small 15–20L backpack for quick-access items (water, documents, phone), plus side panniers or a seat bag for clothes and heavier gear. Using only a large backpack causes back fatigue and affects bike handling.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Are tank bags compatible with all bike models?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">No — tank bags use magnets to attach to the fuel cap. Bikes with aluminium or composite tank covers (some naked bikes, ADV models) will not hold magnets. Always confirm compatibility before purchasing. Rhinowalk and Givi offer strap-mount alternatives — better suited for non-magnet-compatible bikes.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_294$,
       seo_title = 'Balo và túi mô tô chính hãng — Komine, Givi, Taichi | Bigbike.vn',
       seo_title_en = 'Genuine Motorcycle Bags — Komine, Givi, Taichi | Bigbike.vn HCMC',
       seo_description = 'Balo phượt, túi đeo chéo, túi treo xe mô tô chính hãng tại TP.HCM. Komine, Givi, Taichi, ILM, LS2, Rhinowalk, Hevik. Chống nước, bền, đa dạng kiểu gắn. Zalo 0764 640 679.',
       seo_description_en = 'Motorcycle backpacks, sling bags and bike-mounted bags in Ho Chi Minh City. Komine, Givi, Taichi, ILM, LS2, Rhinowalk, Hevik. Waterproof, durable, multiple mounting options. Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-294';

-- Update category ID: wp-cat-301 (Page: B2, url: balo-tui-deo-tui-treo-xe/balo)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_301$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · balo-tui-deo-tui-treo-xe/balo</span>
    <h2 class="bb-ci-h2">Balo mô tô phượt chống nước — Komine, Taichi, Rhinowalk</h2>
    <p class="bb-ci-body">Balo mô tô phượt thiết kế để đeo ổn định ở tốc độ cao — có dây đai ngực và hông giữ balo sát lưng, không lắc khi vào cua. Chất liệu chống nước hoặc kèm áo mưa, có ngăn laptop, ngăn hydration (túi nước uống tích hợp) và điểm gắn đèn phản quang. Shop có: Komine SA-238 · Taichi touring backpack · Rhinowalk series. Dung tích phổ biến: 15–30L — đủ cho chuyến 2–3 ngày nếu kết hợp túi treo xe.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Komine</span><span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Rhinowalk</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Dung tích bao nhiêu là phù hợp cho đi phượt?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">15–20L cho đi 1–2 ngày hoặc dùng balo phụ kết hợp túi treo xe. 25–30L cho đi 3–5 ngày không có túi treo xe phụ. Trên 30L sẽ nặng và ảnh hưởng cân bằng xe — nên chia tải sang túi treo hoặc túi yên thay vì dùng balo siêu to.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Balo có khoang hydration (túi nước uống tích hợp) có thực sự cần không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Hữu ích nếu đi đường dài xa thành phố — uống nước không cần dừng xe, quan trọng khi trời nóng SG hoặc đèo vắng. Không bắt buộc nếu anh thường đi cung ngắn hoặc đường có nhiều điểm dừng.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Balo mô tô có dùng đi làm hằng ngày được không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Được — nhiều dòng Komine và Taichi thiết kế đủ tinh tế để đi làm văn phòng. Ngăn laptop riêng, form đứng tốt. Nhưng thường nặng hơn balo văn phòng thông thường 300–500g vì vật liệu dày hơn.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_301$,
       content_bottom_en = $cb_en_wp_cat_301$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · balo-tui-deo-tui-treo-xe/balo</span>
    <h2 class="bb-ci-h2">Waterproof Motorcycle Touring Backpacks — Komine, Taichi, Rhinowalk</h2>
    <p class="bb-ci-body">Motorcycle touring backpacks are built to stay stable at speed — chest and hip straps keep the pack close to the body, preventing shift in corners. Waterproof materials or included rain cover, laptop compartment, hydration bladder sleeve, and reflective attachment points. Currently in stock: Komine SA-238 · Taichi touring backpack · Rhinowalk series. Common capacity: 15–30L — adequate for a 2–3 day trip when combined with bike-mounted luggage.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Komine</span><span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Rhinowalk</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">What capacity is right for touring?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">15–20L for 1–2 day trips or as a secondary pack combined with bike-mounted luggage. 25–30L for 3–5 days without additional bike storage. Above 30L becomes heavy and affects bike balance — split the load to panniers or a seat bag rather than using an oversized backpack.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Is a hydration bladder compartment actually necessary?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Useful for long remote stretches — drinking without stopping is important in Saigon's heat or on isolated mountain roads. Not essential if you mainly ride short routes or roads with frequent rest stops.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Can motorcycle backpacks be used for daily office commuting?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Yes — many Komine and Taichi designs are refined enough for office use. Dedicated laptop compartment, good structure. However, they are typically 300–500g heavier than standard office backpacks due to thicker materials.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_301$,
       seo_title = 'Balo mô tô phượt chống nước — Komine, Taichi, Rhinowalk | Bigbike.vn',
       seo_title_en = 'Waterproof Motorcycle Touring Backpacks — Komine, Taichi, Rhinowalk | Bigbike.vn',
       seo_description = 'Balo mô tô chống nước, dây đai chắc, đeo thoải mái đi xa. Komine SA-238, Taichi, Rhinowalk. Bigbike.vn TP.HCM — Zalo 0764 640 679.',
       seo_description_en = 'Waterproof motorcycle backpacks, secure straps, comfortable for long-distance riding. Komine SA-238, Taichi, Rhinowalk. Bigbike.vn HCMC — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-301';

-- Update category ID: wp-cat-312 (Page: B3, url: balo-tui-deo-tui-treo-xe/tui-deo)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_312$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · balo-tui-deo-tui-treo-xe/tui-deo</span>
    <h2 class="bb-ci-h2">Túi đeo chéo, đeo bụng, đeo đùi cho biker — Komine, ILM</h2>
    <p class="bb-ci-body">Túi đeo nhỏ gọn hơn balo, lý tưởng cho đồ cần lấy nhanh khi dừng xe — điện thoại, ví, giấy tờ, tai nghe. Ba kiểu đeo phổ biến: Đeo chéo (cross-body, một bên vai), Đeo bụng hay còn gọi là đeo bao tử (chest bag, trước ngực dễ lấy đồ khi ngồi xe), Đeo đùi (thigh bag, gắn vào đùi phải). Shop có: Komine, ILM, LS2. Phù hợp kết hợp với balo hoặc dùng độc lập cho đi phố ngắn.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">ILM</span><span class="bb-ci-pill">Komine</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Túi đeo bụng (bao tử) có tiện khi ngồi xe không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Tiện hơn túi đeo chéo khi ngồi xe vì không bị ép vào một bên sườn. Lấy điện thoại hoặc tiền không cần dừng xe hẳn. Nhưng kích thước nhỏ — chỉ đựng được đồ nhỏ, không thay được balo.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Túi đeo đùi có vướng khi điều khiển xe không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Không nếu gắn đúng cách — đùi phải (tay ga) là vị trí chuẩn. Kích thước nhỏ và ôm sát đùi nên không vướng cần số hay bàn đạp phanh. Gắn quá lỏng hoặc đeo vào đùi trái mới dễ vướng.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Túi đeo này có chống nước không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Phụ thuộc từng model — một số có lớp phủ DWR chống thấm nhẹ, một số không. Nên hỏi rõ khi mua hoặc chuẩn bị túi zip lock cho đồ quan trọng (điện thoại, tiền) nếu mua loại không chống nước.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_312$,
       content_bottom_en = $cb_en_wp_cat_312$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · balo-tui-deo-tui-treo-xe/tui-deo</span>
    <h2 class="bb-ci-h2">Motorcycle Sling, Chest and Thigh Bags — Komine, ILM</h2>
    <p class="bb-ci-body">Sling bags are more compact than backpacks, ideal for quick-access items at stops — phone, wallet, documents, earphones. Three common carrying styles: Cross-body sling (over one shoulder), Chest bag (front-mounted, easy to access while seated on the bike), Thigh bag (strapped to the right thigh). Currently in stock: Komine, ILM, LS2. Works well combined with a backpack or independently for short city rides.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">ILM</span><span class="bb-ci-pill">Komine</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Is a chest bag practical while riding?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">More comfortable than a cross-body sling while seated since it does not press against one side. Accessible for phone or cash without fully stopping. However, size is limited — small items only, not a backpack replacement.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Does a thigh bag interfere with riding?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Not if mounted correctly — the right thigh (throttle side) is the standard position. The compact size and close fit mean it does not interfere with the gear lever or brake pedal. Fitting too loosely or wearing it on the left thigh is where problems arise.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Are these bags waterproof?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Depends on the model — some have a light DWR water-resistant coating, others do not. Always confirm before purchasing, or use zip-lock bags for valuables (phone, cash) if buying a non-waterproof option.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_312$,
       seo_title = 'Túi đeo chéo, đeo bụng, đeo đùi cho biker — Komine, ILM | Bigbike.vn',
       seo_title_en = 'Motorcycle Sling, Chest and Thigh Bags — Komine, ILM | Bigbike.vn HCMC',
       seo_description = 'Túi đeo chéo, đeo bụng (bao tử), đeo đùi cho biker. Komine, ILM, LS2. Nhỏ gọn, lấy đồ nhanh, phù hợp đi phố và phượt ngắn. Bigbike.vn — Zalo 0764 640 679.',
       seo_description_en = 'Motorcycle sling bags, chest bags and thigh bags for riders. Komine, ILM, LS2. Compact, quick-access, suited for city and short rides. Bigbike.vn — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-312';

-- Update category ID: wp-cat-319 (Page: B3, url: balo-tui-deo-tui-treo-xe/tui-deo)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_319$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · balo-tui-deo-tui-treo-xe/tui-deo</span>
    <h2 class="bb-ci-h2">Túi đeo chéo, đeo bụng, đeo đùi cho biker — Komine, ILM</h2>
    <p class="bb-ci-body">Túi đeo nhỏ gọn hơn balo, lý tưởng cho đồ cần lấy nhanh khi dừng xe — điện thoại, ví, giấy tờ, tai nghe. Ba kiểu đeo phổ biến: Đeo chéo (cross-body, một bên vai), Đeo bụng hay còn gọi là đeo bao tử (chest bag, trước ngực dễ lấy đồ khi ngồi xe), Đeo đùi (thigh bag, gắn vào đùi phải). Shop có: Komine, ILM, LS2. Phù hợp kết hợp với balo hoặc dùng độc lập cho đi phố ngắn.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">ILM</span><span class="bb-ci-pill">Komine</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Túi đeo bụng (bao tử) có tiện khi ngồi xe không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Tiện hơn túi đeo chéo khi ngồi xe vì không bị ép vào một bên sườn. Lấy điện thoại hoặc tiền không cần dừng xe hẳn. Nhưng kích thước nhỏ — chỉ đựng được đồ nhỏ, không thay được balo.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Túi đeo đùi có vướng khi điều khiển xe không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Không nếu gắn đúng cách — đùi phải (tay ga) là vị trí chuẩn. Kích thước nhỏ và ôm sát đùi nên không vướng cần số hay bàn đạp phanh. Gắn quá lỏng hoặc đeo vào đùi trái mới dễ vướng.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Túi đeo này có chống nước không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Phụ thuộc từng model — một số có lớp phủ DWR chống thấm nhẹ, một số không. Nên hỏi rõ khi mua hoặc chuẩn bị túi zip lock cho đồ quan trọng (điện thoại, tiền) nếu mua loại không chống nước.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_319$,
       content_bottom_en = $cb_en_wp_cat_319$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · balo-tui-deo-tui-treo-xe/tui-deo</span>
    <h2 class="bb-ci-h2">Motorcycle Sling, Chest and Thigh Bags — Komine, ILM</h2>
    <p class="bb-ci-body">Sling bags are more compact than backpacks, ideal for quick-access items at stops — phone, wallet, documents, earphones. Three common carrying styles: Cross-body sling (over one shoulder), Chest bag (front-mounted, easy to access while seated on the bike), Thigh bag (strapped to the right thigh). Currently in stock: Komine, ILM, LS2. Works well combined with a backpack or independently for short city rides.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">LS2</span><span class="bb-ci-pill">ILM</span><span class="bb-ci-pill">Komine</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Is a chest bag practical while riding?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">More comfortable than a cross-body sling while seated since it does not press against one side. Accessible for phone or cash without fully stopping. However, size is limited — small items only, not a backpack replacement.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Does a thigh bag interfere with riding?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Not if mounted correctly — the right thigh (throttle side) is the standard position. The compact size and close fit mean it does not interfere with the gear lever or brake pedal. Fitting too loosely or wearing it on the left thigh is where problems arise.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Are these bags waterproof?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Depends on the model — some have a light DWR water-resistant coating, others do not. Always confirm before purchasing, or use zip-lock bags for valuables (phone, cash) if buying a non-waterproof option.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_319$,
       seo_title = 'Túi đeo chéo, đeo bụng, đeo đùi cho biker — Komine, ILM | Bigbike.vn',
       seo_title_en = 'Motorcycle Sling, Chest and Thigh Bags — Komine, ILM | Bigbike.vn HCMC',
       seo_description = 'Túi đeo chéo, đeo bụng (bao tử), đeo đùi cho biker. Komine, ILM, LS2. Nhỏ gọn, lấy đồ nhanh, phù hợp đi phố và phượt ngắn. Bigbike.vn — Zalo 0764 640 679.',
       seo_description_en = 'Motorcycle sling bags, chest bags and thigh bags for riders. Komine, ILM, LS2. Compact, quick-access, suited for city and short rides. Bigbike.vn — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-319';

-- Update category ID: wp-cat-324 (Page: B4, url: balo-tui-deo-tui-treo-xe/tui-treo-xe)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_324$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · balo-tui-deo-tui-treo-xe/tui-treo-xe</span>
    <h2 class="bb-ci-h2">Túi treo xe mô tô — túi bình xăng, túi hông, túi yên</h2>
    <p class="bb-ci-body">Túi treo xe gắn trực tiếp lên xe — không chịu tải trên người, phù hợp chở đồ nặng hoặc nhiều cho chuyến phượt dài. Ba loại chính: Túi bình xăng (gắn trên bình, dùng nam châm hoặc dây đai), Túi 2 bên hông xe (panniers, gắn baga 2 bên đuôi xe), Túi trống ràng yên (dry bag buộc lên yên sau). Shop có: Komine, Givi, Taichi, Rhinowalk, Hevik. Chọn theo loại xe và điểm gắn sẵn có trên xe.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Komine</span><span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Hevik</span><span class="bb-ci-pill">Givi</span><span class="bb-ci-pill">Rhinowalk</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Xe không có baga thì có dùng được túi treo xe không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Có — túi bình xăng không cần baga, chỉ cần bình xăng tương thích. Túi trống ràng yên dùng dây buộc qua yên và khung đuôi, cũng không cần baga. Chỉ túi hông panniers mới cần baga hoặc subframe gắn kèm.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Túi bình xăng có ảnh hưởng đến màn hình điện tử của xe không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Túi nam châm có thể ảnh hưởng đến đồng hồ analog và một số cảm biến trên xe hiện đại. Xe có màn hình TFT hoặc cảm biến nhiên liệu dạng điện từ nên dùng túi bình xăng loại dây đai thay vì nam châm để an toàn hơn.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Túi treo xe có chịu được mưa dài không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Phụ thuộc loại — túi trống (dry bag) của Rhinowalk và Givi là chống nước hoàn toàn (IPX6). Túi bình xăng và túi hông thường chống thấm nhẹ, mưa dài cần phủ thêm áo mưa túi riêng. Kiểm tra thông số IP hoặc hỏi shop khi mua.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_324$,
       content_bottom_en = $cb_en_wp_cat_324$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · balo-tui-deo-tui-treo-xe/tui-treo-xe</span>
    <h2 class="bb-ci-h2">Motorcycle Mounted Bags — Tank Bags, Panniers, Seat Bags</h2>
    <p class="bb-ci-body">Bike-mounted bags attach directly to the motorcycle — no body load, ideal for heavy or bulky gear on long tours. Three main types: Tank bag (mounts on fuel tank via magnets or straps), Side panniers (attach to rear rack on both sides), Seat bag / dry bag (strapped across the rear seat). Currently in stock: Komine, Givi, Taichi, Rhinowalk, Hevik. Selection depends on bike type and existing mounting points.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Komine</span><span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Hevik</span><span class="bb-ci-pill">Givi</span><span class="bb-ci-pill">Rhinowalk</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Can bike-mounted bags be used without a rear rack?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Yes — tank bags require no rack, just a compatible fuel tank. Seat dry bags use straps across the seat and tail frame, also rack-free. Only side panniers require a rear rack or mounting subframe.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Can a magnetic tank bag affect the bike's electronics?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Magnetic bags can interfere with analogue gauges and some sensors on modern bikes. Bikes with TFT displays or electromagnetic fuel sensors should use strap-mount tank bags rather than magnetic versions to be safe.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Can bike-mounted bags handle sustained rain?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Depends on the type — Rhinowalk and Givi dry bags are fully waterproof (IPX6). Tank bags and panniers are typically only water-resistant — extended rain requires an additional bag rain cover. Check the IP rating or ask in-store before purchasing.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_324$,
       seo_title = 'Túi treo xe mô tô — túi bình xăng, túi hông, túi yên | Bigbike.vn',
       seo_title_en = 'Motorcycle Mounted Bags — Tank Bags, Panniers, Seat Bags | Bigbike.vn',
       seo_description = 'Túi bình xăng, túi 2 bên hông, túi trống ràng yên xe mô tô. Komine, Givi, Taichi, Rhinowalk, Hevik. Chống nước, gắn chắc. Bigbike.vn TP.HCM — Zalo 0764 640 679.',
       seo_description_en = 'Motorcycle tank bags, side panniers and seat bags. Komine, Givi, Taichi, Rhinowalk, Hevik. Waterproof, secure mounting. Bigbike.vn HCMC — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-324';

-- Update category ID: wp-cat-295 (Page: T1, url: tai-nghe-bluetooth-mu-bao-hiem)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_295$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · tai-nghe-bluetooth-mu-bao-hiem</span>
    <h2 class="bb-ci-h2">Tai nghe Bluetooth mũ bảo hiểm SCS chính hãng</h2>
    <p class="bb-ci-body">Tai nghe Bluetooth gắn mũ bảo hiểm SCS cho phép biker nghe nhạc, nhận chỉ đường GPS và liên lạc nhóm khi đang chạy xe — không cần dừng, không cần cầm điện thoại. Bigbike là đại lý chính hãng SCS tại TP.HCM — dòng tai nghe thiết kế riêng cho mũ bảo hiểm, lắp vừa hầu hết mũ fullface và lật hàm phổ biến. Sản phẩm bán theo đơn vị chiếc (1 rider) hoặc cặp (2 riders) — chọn theo số lượng người trong nhóm phượt.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">SCS</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">SCS khác gì so với Cardo và Sena — tại sao shop chỉ bán SCS?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Cardo và Sena là những thương hiệu lớn toàn cầu — tốt nhưng giá cao và dịch vụ bảo hành tại VN hạn chế. SCS là thương hiệu chuyên dụng với tỉ lệ chi phí — hiệu năng tốt cho cộng đồng biker VN, và Bigbike có thể hỗ trợ bảo hành trực tiếp vì là đại lý chính hãng. Mình chỉ bán cái mình có thể đứng sau bảo hành được.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Một chiếc hay một cặp — cần mua loại nào?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Một chiếc nếu anh chỉ cần nghe nhạc và GPS một mình. Một cặp nếu đi nhóm 2 người muốn liên lạc với nhau. Đi nhóm lớn hơn 2 người thì mỗi người cần 1 chiếc — tất cả kết nối chung một mesh network.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Lắp SCS vào mũ có phức tạp không, có ảnh hưởng đến nón không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Không phức tạp — kẹp vào cạnh tai trong mũ, không cần khoan hay sửa mũ. Bigbike hỗ trợ lắp thử tại shop khi mua. Tháo ra cũng nhanh nếu cần chuyển sang mũ khác.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_295$,
       content_bottom_en = $cb_en_wp_cat_295$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · tai-nghe-bluetooth-mu-bao-hiem</span>
    <h2 class="bb-ci-h2">SCS Bluetooth Helmet Intercom — Authorized Retailer</h2>
    <p class="bb-ci-body">SCS Bluetooth helmet intercoms allow riders to listen to music, receive GPS navigation and communicate with the group while riding — no stopping, no handling the phone. Bigbike is an authorized SCS retailer in Ho Chi Minh City — a helmet-specific intercom brand designed to fit most popular full-face and flip-up helmets. Available as single units (1 rider) or pairs (2 riders) — choose based on your group size.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">SCS</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">How does SCS compare to Cardo and Sena — why does the shop only carry SCS?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Cardo and Sena are major global brands — high quality but expensive, with limited warranty support in Vietnam. SCS offers a strong performance-to-cost ratio for the Vietnamese riding community, and Bigbike can provide direct warranty support as an authorized dealer. We only sell what we can stand behind with proper after-sales service.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Single unit or pair — which should I buy?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Single unit if you only need music and GPS for solo riding. A pair if two riders want to communicate with each other. For groups larger than two, each rider needs one unit — all connect on a shared mesh network.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Is installing SCS in a helmet complicated? Does it damage the helmet?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Not complicated — it clips into the ear cavity inside the helmet, no drilling or modification required. Bigbike assists with a test fit in-store at purchase. It can also be transferred to a different helmet quickly if needed.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_295$,
       seo_title = 'Tai nghe Bluetooth mũ bảo hiểm SCS chính hãng | Bigbike.vn TP.HCM',
       seo_title_en = 'SCS Bluetooth Helmet Intercom — Authorized Retailer | Bigbike.vn HCMC',
       seo_description = 'Tai nghe Bluetooth gắn mũ bảo hiểm SCS chính hãng tại TP.HCM. Kết nối nhóm, nghe nhạc, GPS khi lái xe. Bigbike.vn — đại lý chính hãng SCS — Zalo 0764 640 679.',
       seo_description_en = 'SCS Bluetooth helmet intercom — authorized retailer in Ho Chi Minh City. Group communication, music, GPS navigation while riding. Bigbike.vn — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-295';

-- Update category ID: wp-cat-311 (Page: K2, url: gia-do-dien-thoai-phu-kien-camera/gia-do-dien-thoai)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_311$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · gia-do-dien-thoai-phu-kien-camera/gia-do-dien-thoai</span>
    <h2 class="bb-ci-h2">Giá đỡ điện thoại xe máy Kewig M36 M33 chính hãng</h2>
    <p class="bb-ci-body">Giá đỡ điện thoại Kewig thiết kế cho xe máy và mô tô — chống rung tốt trên đường xóc, gắn chắc vào ghi-đông từ 18 đến 30mm, khóa điện thoại một tay không cần nhìn. Tương thích với tất cả điện thoại có case hoặc không case. Dòng phổ biến: Kewig M36 (màn hình lớn đến 7 inch) · Kewig M33 (5–6.5 inch, nhỏ gọn hơn) · và các model khác theo từng thời điểm kho hàng. Chính hãng, bảo hành tại Bigbike.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Kewig</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Gắn giá đỡ Kewig vào ghi-đông có cần khoan hay sửa gì không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Không — dùng kẹp siết ốc vào ghi-đông, không cần khoan hay dán keo. Tháo ra không để lại dấu. Phù hợp ghi-đông tròn tiêu chuẩn 18–30mm của hầu hết xe máy và mô tô.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Điện thoại có bị rớt khi đi đường xóc không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Không nếu khóa đúng cách — Kewig dùng cơ chế xoay 1/4 vòng khóa cứng điện thoại vào đế. Khác với kẹp lò xo thông thường dễ bung. Nên kiểm tra chắc chắn trước khi chạy, đặc biệt khi mới dùng lần đầu.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Dùng điện thoại gắn trên giá đỡ khi chạy xe có hợp pháp không ở VN?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Xem bản đồ và GPS khi xe đang dừng hoặc đã gắn cố định trên giá đỡ được chấp nhận. Tuy nhiên luật VN nghiêm cấm cầm điện thoại khi lái xe — giá đỡ giúp tuân thủ luật đúng hơn, không phải để nhắn tin hay gọi điện khi đang chạy.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_311$,
       content_bottom_en = $cb_en_wp_cat_311$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · gia-do-dien-thoai-phu-kien-camera/gia-do-dien-thoai</span>
    <h2 class="bb-ci-h2">Kewig M36 M33 Motorcycle Phone Mount — Authorized</h2>
    <p class="bb-ci-body">Kewig phone mounts are engineered for motorcycles — effective vibration damping on rough roads, secure attachment to handlebars from 18 to 30mm diameter, one-handed phone locking without looking down. Compatible with all phones with or without a case. Popular models: Kewig M36 (large screens up to 7 inches) · Kewig M33 (5–6.5 inches, more compact) · additional models available subject to current stock. Authorized, with warranty support directly at Bigbike.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Kewig</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Does installing a Kewig mount require drilling or modification?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">No — it clamps directly onto the handlebar with a bolt, no drilling or adhesive needed. Removal leaves no marks. Fits standard round handlebars 18–30mm diameter found on most motorcycles.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Will the phone fall off on rough roads?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Not if locked correctly — Kewig uses a quarter-turn mechanism that locks the phone rigidly into the mount. Unlike spring clamps which can release under vibration. Always check the lock before riding, especially when using for the first time.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Is using a phone mount while riding legal in Vietnam?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Viewing maps and GPS while the phone is fixed on a mount is accepted. However, Vietnamese law strictly prohibits holding a phone while riding — a mount helps comply with the law correctly, not as a justification for texting or calling while moving.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_311$,
       seo_title = 'Giá đỡ điện thoại xe máy Kewig M36 M33 chính hãng | Bigbike.vn',
       seo_title_en = 'Kewig M36 M33 Motorcycle Phone Mount — Authorized | Bigbike.vn HCMC',
       seo_description = 'Giá đỡ điện thoại Kewig chính hãng cho xe máy và mô tô. M36, M33. Chống rung, khóa 1 tay, phù hợp mọi ghi-đông. Bigbike.vn TP.HCM — Zalo 0764 640 679.',
       seo_description_en = 'Kewig authorized motorcycle phone mounts. M36, M33. Vibration damping, one-hand lock, fits all handlebars. Bigbike.vn HCMC — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-311';

-- Update category ID: wp-cat-299 (Page: P1, url: phu-kien-khac)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_299$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · phu-kien-khac</span>
    <h2 class="bb-ci-h2">Đồ mưa và đồ lót bảo hộ mô tô — Givi, Taichi, Bigbike</h2>
    <p class="bb-ci-body">Phụ kiện bổ trợ giúp hoàn thiện bộ bảo hộ trong mọi điều kiện thời tiết. Chia 2 nhóm: Đồ mưa (áo quần chống mưa khoác bên ngoài giáp khi mưa lớn — Givi, Taichi, RS Taichi) và Đồ lót (lớp áo quần mặc bên trong giáp để giữ ấm mùa lạnh hoặc thấm mồ hôi mùa nóng — Taichi và đồ lót Bigbike tự gia công). Hai loại này khác nhau hoàn toàn về chức năng và thời điểm sử dụng.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Givi</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Đồ mưa và áo giáp touring chống nước khác nhau thế nào?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Áo giáp touring có waterproof tích hợp — chịu được mưa trung bình. Đồ mưa rời khoác bên ngoài — chịu được mưa lớn và kéo dài hơn, và có thể dùng cùng bất kỳ áo giáp nào kể cả áo mesh. Hai thứ bổ trợ nhau, không thay thế nhau.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Đồ lót Bigbike tự gia công khác gì so với đồ lót thương hiệu lớn?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Đồ lót Bigbike được thiết kế phù hợp với khí hậu nhiệt đới VN và cấu trúc của giáp moto — cổ áo và cổ tay đủ cao để không lộ khi mặc giáp, chất liệu thoáng mồ hôi mùa hè. Giá tốt hơn đáng kể so với các thương hiệu ngoại nhập. Không có tên thương hiệu lớn — nhưng được Bigbike đứng sau bảo đảm chất lượng trực tiếp.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Mùa nóng SG có cần đồ lót không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Có ích hơn nhiều người nghĩ — đồ lót thấm mồ hôi tốt giúp mặc giáp thoải mái hơn đáng kể dù trời nóng. Mặc giáp trực tiếp lên da dễ gây hăm và khó chịu khi chạy dài. Đồ lót mỏng của Bigbike và Taichi thiết kế đủ mỏng để không thêm nóng nhiều.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_299$,
       content_bottom_en = $cb_en_wp_cat_299$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · phu-kien-khac</span>
    <h2 class="bb-ci-h2">Motorcycle Rain Suits and Base Layers — Givi, Taichi, Bigbike</h2>
    <p class="bb-ci-body">Supplementary gear that completes a protective kit in all weather conditions. Split into two groups: Rain gear (waterproof over-suits worn on top of protective jackets in heavy rain — Givi, Taichi, RS Taichi) and Base layers (worn underneath protective gear for warmth in cold weather or moisture management in heat — Taichi and Bigbike own-brand). These two categories serve entirely different functions and are used at different times.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Givi</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">What is the difference between rain gear and a waterproof touring jacket?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">A touring jacket has integrated waterproofing — handles moderate rain. A separate rain suit worn over the top handles heavy sustained rain and can be used over any jacket including mesh. The two complement each other, not replace each other.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">How does Bigbike's own-brand base layer compare to branded alternatives?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Bigbike base layers are designed specifically for Vietnam's tropical climate and motorcycle gear fit — high neckline and cuffs that stay covered under protective jackets, moisture-wicking fabric for summer heat. Significantly better value than imported branded alternatives. No major brand name — but quality is backed directly by Bigbike.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Is a base layer necessary in Saigon's heat?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">More useful than most people expect — moisture-wicking base layers make wearing protective gear significantly more comfortable even in heat. Wearing a jacket directly on skin causes chafing and discomfort on longer rides. Bigbike and Taichi base layers are thin enough not to add meaningful warmth.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_299$,
       seo_title = 'Đồ mưa và đồ lót bảo hộ mô tô — Givi, Taichi, Bigbike | Bigbike.vn',
       seo_title_en = 'Motorcycle Rain Suits and Base Layers — Givi, Taichi, Bigbike | Bigbike.vn',
       seo_description = 'Áo quần mưa mặc ngoài giáp và đồ lót mặc trong giáp cho biker. Givi, Taichi, RS Taichi, đồ lót Bigbike tự gia công. TP.HCM — Zalo 0764 640 679.',
       seo_description_en = 'Motorcycle rain suits worn over protective gear, and base layers worn underneath. Givi, Taichi, RS Taichi, Bigbike own-brand base layers. HCMC — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-299';

-- Update category ID: wp-cat-297 (Page: P2, url: phu-kien-khac/do-mua)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_297$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · phu-kien-khac/do-mua</span>
    <h2 class="bb-ci-h2">Đồ mưa moto chính hãng — Givi, Taichi, RS Taichi</h2>
    <p class="bb-ci-body">Đồ mưa mô tô là áo quần chống nước khoác bên ngoài toàn bộ đồ bảo hộ — giữ khô khi mưa lớn, gấp nhỏ gọn bỏ vào balo hoặc túi treo xe, mang theo thường xuyên như vật dụng thiết yếu. Khác với áo mưa thông thường — thiết kế đủ rộng để khoác qua giáp và mũ, có phản quang và cổ chân / cổ tay bịt kín. Shop có: Givi · Taichi rain suit · RS Taichi. Nên có dù đi gần hay đi xa — mưa SG không báo trước.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Givi</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Đồ mưa moto có khác gì áo mưa thông thường ngoài chợ?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Khác nhiều — đồ mưa moto rộng hơn để khoác qua giáp và mũ bảo hiểm, có phản quang tăng khả năng nhìn thấy ban đêm mưa, cổ chân và cổ tay bịt kín chống nước vào. Áo mưa chợ không có các tính năng này và thường bay phất khi chạy tốc độ cao — nguy hiểm khi dính vào bánh xe.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Nên mua loại một mảnh hay hai mảnh (áo + quần riêng)?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Hai mảnh tiện hơn khi mưa bất chợt — anh có thể chỉ mặc áo nếu mưa nhỏ và đường ngắn. Một mảnh (liền thân) kín hơn, chống nước tốt hơn ở vùng eo — tốt cho mưa lớn kéo dài. Bigbike có cả hai loại, hỏi shop khi mua để chọn phù hợp.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Mặc đồ mưa bên ngoài giáp có ảnh hưởng khả năng bảo vệ của giáp không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Không — đồ mưa chỉ là lớp chống nước, không thay thế giáp. Giáp vẫn hoạt động bình thường bên trong. Nếu ngã, lớp đồ mưa ngoài trầy trước — giáp bên trong vẫn bảo vệ như bình thường.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_297$,
       content_bottom_en = $cb_en_wp_cat_297$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · phu-kien-khac/do-mua</span>
    <h2 class="bb-ci-h2">Genuine Motorcycle Rain Suits — Givi, Taichi, RS Taichi</h2>
    <p class="bb-ci-body">Motorcycle rain suits are waterproof over-garments worn on top of all protective gear — keeping you dry in heavy rain, packing small into a backpack or bike bag, carried as an essential on every ride. Unlike standard rain coats — designed wide enough to go over full protective gear and helmet, with reflective details and sealed wrist and ankle cuffs. Currently in stock: Givi · Taichi rain suit · RS Taichi. Essential regardless of ride length — Saigon rain arrives without warning.</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">Givi</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">How is a motorcycle rain suit different from a regular rain poncho?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Very different — motorcycle rain suits are wide enough to go over full gear and helmet, include reflective panels for night visibility in rain, and have sealed cuffs at ankles and wrists. Regular ponchos lack all of these and flap dangerously at speed — a real risk if caught in the wheel.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">One-piece or two-piece (jacket and pants separate) rain suit?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Two-piece is more versatile for sudden rain — you can wear just the jacket for light rain on short distances. One-piece is more sealed at the waist, better for heavy sustained rain. Bigbike carries both — ask in-store when purchasing.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Does wearing a rain suit over protective gear affect the gear's protection?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">No — the rain suit is only a waterproof layer, not a replacement for protection. The protective gear functions normally underneath. In a fall, the outer rain suit abrades first — the protective gear inside still performs as intended.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_297$,
       seo_title = 'Đồ mưa moto chính hãng — Givi, Taichi, RS Taichi | Bigbike.vn TP.HCM',
       seo_title_en = 'Genuine Motorcycle Rain Suits — Givi, Taichi, RS Taichi | Bigbike.vn HCMC',
       seo_description = 'Áo quần mưa mặc ngoài đồ giáp cho biker. Givi, Taichi, RS Taichi. Chống nước, gọn nhẹ, mang theo thường xuyên. Bigbike.vn TP.HCM — Zalo 0764 640 679.',
       seo_description_en = 'Motorcycle rain suits worn over protective gear. Givi, Taichi, RS Taichi. Waterproof, packable, carry on every ride. Bigbike.vn HCMC — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-297';

-- Update category ID: wp-cat-305 (Page: P3, url: phu-kien-khac/do-lot)
UPDATE categories 
SET    content_bottom = $cb_vi_wp_cat_305$<div class="bb-cat-intro" lang="vi">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Danh mục · phu-kien-khac/do-lot</span>
    <h2 class="bb-ci-h2">Đồ lót bảo hộ mô tô — Taichi, Đồ lót Bigbike</h2>
    <p class="bb-ci-body">Đồ lót mặc bên trong giáp bảo hộ — lớp tiếp xúc trực tiếp với da giúp thoáng mồ hôi mùa hè hoặc giữ ấm mùa lạnh, đồng thời bảo vệ da khỏi cọ xát với lớp lót trong của giáp khi chạy dài. Shop có: Taichi base layer (mùa hè và mùa đông) và Đồ lót Bigbike tự gia công — thiết kế riêng cho khí hậu VN, phù hợp với cấu trúc đặc thù của giáp moto (cổ cao, cổ tay kín, không lộ khi mặc giáp ngoài).</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">SCS</span><span class="bb-ci-pill">Kewig</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 câu hỏi thường gặp nhất</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Đồ lót Bigbike tự gia công có khác gì Taichi không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Taichi base layer là thương hiệu Nhật — chất liệu cao cấp hơn, giá cao hơn, có cả dòng giữ ấm mùa đông. Đồ lót Bigbike thiết kế cho khí hậu nhiệt đới VN — thoáng mồ hôi tốt cho mùa hè, giá tốt hơn đáng kể. Nếu hay đi phượt mùa lạnh vùng núi thì Taichi đáng đầu tư hơn. Đi phố và phượt mùa nóng thì đồ lót Bigbike đủ dùng.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Mặc đồ lót dài tay có làm tăng nhiệt độ cơ thể không khi trời nóng?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Ít hơn bạn nghĩ nếu chất liệu đúng — đồ lót thoáng mồ hôi tốt thực ra mát hơn mặc trực tiếp da vào giáp, vì mồ hôi được hút ra và thoát hơi thay vì đọng lại. Vải cotton giữ mồ hôi thì nóng — vải polyester mesh hoặc coolmax thì không.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Có cần mua đồ lót riêng cho trên và dưới không?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Nên có đủ bộ — áo lót giữ thân trên không bị cọ vào lót giáp, quần lót giữ đùi và bắp chân không bị cọ vào lót quần giáp khi ngồi xe lâu. Bộ đủ trên dưới đặc biệt quan trọng cho chuyến phượt 3+ ngày.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Nhắn Zalo tư vấn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Nhắn Zalo Mrs. Thư</a>
  </div>
</div>$cb_vi_wp_cat_305$,
       content_bottom_en = $cb_en_wp_cat_305$<div class="bb-cat-intro" lang="en">
  <div class="bb-ci-a">
    <span class="bb-ci-eyebrow">Category · phu-kien-khac/do-lot</span>
    <h2 class="bb-ci-h2">Motorcycle Base Layers — Taichi, Bigbike Own-Brand</h2>
    <p class="bb-ci-body">Base layers are worn directly against the skin under protective gear — managing moisture in summer heat or retaining warmth in cold weather, while protecting skin from friction against the inner lining of protective jackets on long rides. Currently in stock: Taichi base layer (summer and winter weights) and Bigbike own-brand base layers — designed for Vietnam's climate and motorcycle gear fit (high neckline, full-length sleeves, stays covered under outer protective gear).</p>
    <div class="bb-ci-pills">
      <span class="bb-ci-pill">Taichi</span><span class="bb-ci-pill">SCS</span><span class="bb-ci-pill">Kewig</span>
    </div>
  </div>
  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">
    <span class="bb-ci-b-head">3 most common questions</span>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">How does Bigbike's own-brand base layer compare to Taichi?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Taichi is a Japanese brand — premium materials, higher price, includes cold-weather thermal weight options. Bigbike base layers are designed for Vietnam's tropical climate — strong moisture-wicking for summer heat, significantly better value. For cold-weather mountain riding, Taichi is worth the investment. For city and warm-weather touring, Bigbike base layers are fully adequate.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Does a long-sleeve base layer increase body heat in warm weather?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">Less than you would expect with the right material — a good moisture-wicking base layer is actually cooler than bare skin against protective gear, since sweat is pulled away and evaporates rather than pooling. Cotton holds moisture and feels hot — polyester mesh or Coolmax does not.</p></div>
    </div>
    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">Should I buy both top and bottom base layers?</span></div>
      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">A full set is recommended — the top prevents torso friction against jacket lining, the bottom prevents inner thigh and calf chafing against pants lining on long rides. A complete top-and-bottom set is especially important for tours of 3 or more days.</p></div>
    </div>
  </div>
  <div class="bb-ci-c">
    <span class="bb-ci-ct"></span>
    <a class="bb-ci-btn" href="https://zalo.me/84764640679" target="_blank" rel="noopener" aria-label="Message Zalo for advice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>Message Mrs. Thư on Zalo</a>
  </div>
</div>$cb_en_wp_cat_305$,
       seo_title = 'Đồ lót bảo hộ mô tô — Taichi, Đồ lót Bigbike | Bigbike.vn TP.HCM',
       seo_title_en = 'Motorcycle Base Layers — Taichi, Bigbike Own-Brand | Bigbike.vn HCMC',
       seo_description = 'Áo quần lót mặc trong đồ giáp mô tô. Taichi base layer và đồ lót Bigbike tự gia công. Thoáng mồ hôi mùa hè, giữ ấm mùa lạnh. Bigbike.vn — Zalo 0764 640 679.',
       seo_description_en = 'Base layers worn under motorcycle protective gear. Taichi and Bigbike own-brand. Moisture-wicking for summer, thermal for cold weather. Bigbike.vn — Zalo 0764 640 679.',
       updated_at = now()
WHERE  id = 'wp-cat-305';
