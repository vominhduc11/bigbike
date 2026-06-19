-- V223: Đưa toàn bộ copy trang Giới thiệu (/gioi-thieu) — trước đây hardcode trong theme/i18n
-- (namespace About của bigbike-web) — vào site_settings nhóm public_about để admin sửa được qua
-- màn Cài đặt, vẫn giữ nguyên bố cục lưới 5 ô dịch vụ. Seed = đúng nội dung đang hiển thị (VI + EN).
-- valueType/public do SettingDefinitionRegistry cung cấp; bảng chỉ giữ value/value_en/group/is_public.
-- Web đọc settings-first, fallback copy theme khi key trống nên trang không bao giờ trắng.

insert into site_settings
    (id, setting_key, setting_value, setting_value_en, setting_group, is_public, description, created_at, updated_at)
values
    (gen_random_uuid(), 'about_page_kicker',
        'Bigbike',
        'Bigbike',
        'public_about', true, 'Trang Giới thiệu — kicker khối đầu trang.', now(), now()),

    (gen_random_uuid(), 'about_page_tagline',
        'Cửa hàng chuyên phân phối phụ kiện bảo hộ moto chính hãng uy tín tại TP HCM',
        'A trusted store specialising in genuine motorcycle protective gear in Ho Chi Minh City',
        'public_about', true, 'Trang Giới thiệu — tagline khối đầu trang.', now(), now()),

    (gen_random_uuid(), 'about_page_intro_html',
        '<p>Thời gian gần đây, du lịch phượt đang dần trở thành trào lưu trải nghiệm mang tính lan tỏa nhanh chóng, thu hút ngày càng đông mọi người tham gia, đặc biệt là những người đam mê xe phân khối lớn. Và hầu hết các biker luôn mong muốn tìm kiếm và trang bị các thiết bị bảo hộ moto chất lượng nhằm đảm bảo an toàn cho chuyến hành trình của mình.</p><p>Được thành lập từ năm 2013, Bigbike hiện là một trong những nhà cung cấp đồ bảo hộ moto uy tín tại TP HCM. Chúng tôi tự hào là người bạn đồng hành đáng tin cậy của cộng đồng biker Việt Nam trong suốt thời gian qua.</p><p>Chúng tôi cung cấp các dòng sản phẩm như mũ bảo hiểm, quần - áo bảo hộ, găng tay và giày bảo hộ moto chính hãng từ các thương hiệu nổi tiếng trên thế giới như Alpinestars, Helite, Furygan, LS2, Scoyco, Sena và SCS. Các sản phẩm của Bigbike sở hữu nhiều thiết kế đa dạng với những kiểu dáng và mẫu mã khác nhau để đáp ứng mọi nhu cầu của khách hàng.</p><p>Đến với Bigbike, khách hàng có thể hoàn toàn yên tâm về chất lượng của các sản phẩm. Những dòng sản phẩm bảo hộ đều được đảm bảo đạt đủ các tiêu chuẩn an toàn nên các biker có thể hoàn toàn yên tâm khi sử dụng.</p>',
        '<p>In recent years, motorbike touring has steadily become a fast-spreading experience trend, drawing ever more participants — especially big-bike enthusiasts. Most bikers always look to find and equip themselves with quality motorcycle protective gear to keep their journeys safe.</p><p>Established in 2013, Bigbike is now one of the trusted suppliers of motorcycle protective gear in Ho Chi Minh City. We take pride in being a reliable companion to the Vietnamese biker community throughout the years.</p><p>We supply product lines such as helmets, protective jackets and trousers, gloves and motorcycle boots — all genuine, from world-renowned brands like Alpinestars, Helite, Furygan, LS2, Scoyco, Sena and SCS. Bigbike products come in many diverse designs and styles to meet every customer need.</p><p>At Bigbike, customers can be completely assured of product quality. Every protective line is guaranteed to meet full safety standards, so bikers can use them with total peace of mind.</p>',
        'public_about', true, 'Trang Giới thiệu — đoạn giới thiệu mở đầu.', now(), now()),

    (gen_random_uuid(), 'about_page_quality_heading',
        'Chất lượng dịch vụ tạo nên sự khác biệt',
        'Service quality that makes the difference',
        'public_about', true, 'Trang Giới thiệu — tiêu đề khối Chất lượng dịch vụ.', now(), now()),

    (gen_random_uuid(), 'about_page_quality_body',
        'Trong suốt quá trình hoạt động của mình, Bigbike đã được hân hạnh được trở thành nhà tài trợ đồng hành cho các sự kiện sinh nhật, kỉ niệm và từ thiện cùng câu lạc bộ xe exciter và câu lạc bộ moto Việt Nam. Bigbike luôn lắng nghe và ghi nhận những ý kiến đóng góp của khách hàng. Để từ đó, chúng tôi không ngừng nỗ lực cải thiện và nâng cao chất lượng dịch vụ. Sự hài lòng của khách hàng chính là sự thành công của Bigbike.',
        'Throughout its operation, Bigbike has been honoured to become an accompanying sponsor for birthday, anniversary and charity events together with the Exciter club and the Vietnam moto club. Bigbike always listens to and takes note of customer feedback. From there, we keep striving to improve and raise our service quality. Customer satisfaction is Bigbike''s success.',
        'public_about', true, 'Trang Giới thiệu — mô tả khối Chất lượng dịch vụ.', now(), now()),

    -- ── Ô dịch vụ 1 (nền cam) ──
    (gen_random_uuid(), 'about_page_service1_title',
        'Các chương trình khuyến mãi hấp dẫn',
        'Attractive promotion programs',
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 1: tiêu đề.', now(), now()),
    (gen_random_uuid(), 'about_page_service1_body',
        'Ngoài ra, những thông tin, tin tức mới nhất về các sản phẩm moto cũng như các sự kiện nổi bật cũng luôn được chúng tôi cập nhật thường xuyên trên website chính thức của Bigbike. Ngoài ra, các biker có thể tham khảo thêm một số bài viết so sánh và đánh giá về các trang thiết bị bảo hộ phượt tại đây.',
        'We also regularly update the latest information and news about moto products as well as standout events on the official Bigbike website. Bikers can also check out a number of comparison and review articles about touring protective equipment here.',
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 1: mô tả.', now(), now()),
    (gen_random_uuid(), 'about_page_service1_image',
        '/wp-content/themes/bigbike/images/a-1.png', null,
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 1: hình.', now(), now()),
    (gen_random_uuid(), 'about_page_service1_highlight',
        'true', null,
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 1: nền cam.', now(), now()),

    -- ── Ô dịch vụ 2 ──
    (gen_random_uuid(), 'about_page_service2_title',
        'Cập nhật xu hướng liên tục',
        'Continuously updated trends',
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 2: tiêu đề.', now(), now()),
    (gen_random_uuid(), 'about_page_service2_body',
        'Những xu hướng và mẫu mã sản phẩm thịnh hành nhất trên thị trường hiện nay luôn được Bigbike cập nhật liên tục nhằm đáp ứng kịp thời thị hiếu và nhu cầu từ cơ bản đến nâng cao của khách hàng. Và chúng tôi thường xuyên có những chương trình ưu đãi và hậu mãi hấp dẫn để đem đến cho các biker nhiều cơ hội trải nghiệm sản phẩm cũng như tri ân khách hàng thân thiết.',
        'The most popular trends and product designs on today''s market are continuously updated by Bigbike to promptly meet customers'' tastes and needs, from basic to advanced. We also frequently run attractive promotions and after-sales programs to give bikers many chances to experience products and to thank our loyal customers.',
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 2: mô tả.', now(), now()),
    (gen_random_uuid(), 'about_page_service2_image',
        '/wp-content/themes/bigbike/images/a-2.png', null,
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 2: hình.', now(), now()),
    (gen_random_uuid(), 'about_page_service2_highlight',
        'false', null,
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 2: nền cam.', now(), now()),

    -- ── Ô dịch vụ 3 ──
    (gen_random_uuid(), 'about_page_service3_title',
        'Chất lượng dịch vụ tạo nên sự khác biệt',
        'Service quality that makes the difference',
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 3: tiêu đề.', now(), now()),
    (gen_random_uuid(), 'about_page_service3_body',
        'Khi đến với Bigbike, khách hàng sẽ được tư vấn kỹ lượng về mọi thông tin chi tiết sản phẩm cũng như được giải đáp các thắc mắc một cách tận tình và chu đáo. Đội ngũ nhân viên Bigbike được đào tạo chuyên nghiệp và có sự am hiểu thông tin của sản phẩm sẽ luôn sẵn sàng tư vấn và hỗ trợ khách hàng khi cần thiết. Bạn có thể trực tiếp kiểm tra chất lượng sản phẩm và lựa chọn cho mình các vật dụng bảo hộ phù hợp nhất.',
        'When coming to Bigbike, customers receive careful advice on every product detail and have their questions answered attentively and thoughtfully. The Bigbike staff are professionally trained and knowledgeable about the products, always ready to advise and support customers when needed. You can directly check product quality and choose the protective items that suit you best.',
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 3: mô tả.', now(), now()),
    (gen_random_uuid(), 'about_page_service3_image',
        '/wp-content/themes/bigbike/images/a-3.png', null,
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 3: hình.', now(), now()),
    (gen_random_uuid(), 'about_page_service3_highlight',
        'false', null,
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 3: nền cam.', now(), now()),

    -- ── Ô dịch vụ 4 ──
    (gen_random_uuid(), 'about_page_service4_title',
        'Dịch vụ hậu cần tối ưu',
        'Optimised logistics service',
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 4: tiêu đề.', now(), now()),
    (gen_random_uuid(), 'about_page_service4_body',
        'Các dịch vụ hậu cần cũng luôn được thực hiện nhanh chóng. Các hoạt động giao nhận hàng hóa, các chính sách bảo hành và đổi trả sản phẩm luôn được áp dụng tiện lợi nhất cho khách hàng. Các quy trình luôn được chú trọng và được thực hiện cẩn thận, từ khâu đóng gói hàng hóa cho đến khâu vận chuyển. Nhằm đảm bảo hàng hóa được giao đến tay khách hàng với trạng thái tốt nhất.',
        'Logistics services are always carried out quickly. Goods delivery, warranty and product return policies are always applied in the most convenient way for customers. Processes are always emphasised and handled carefully, from packaging to shipping, to ensure goods reach customers in the best condition.',
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 4: mô tả.', now(), now()),
    (gen_random_uuid(), 'about_page_service4_image',
        '/wp-content/themes/bigbike/images/a-4.png', null,
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 4: hình.', now(), now()),
    (gen_random_uuid(), 'about_page_service4_highlight',
        'false', null,
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 4: nền cam.', now(), now()),

    -- ── Ô dịch vụ 5 (nền cam) ──
    (gen_random_uuid(), 'about_page_service5_title',
        'Các thông tin nổi bật luôn được cập nhật nhanh chóng',
        'Standout information always updated quickly',
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 5: tiêu đề.', now(), now()),
    (gen_random_uuid(), 'about_page_service5_body',
        'Chúng tôi cung cấp đầy đủ những gì bạn cần cho một cuộc hành trình. Bigbike tự hào luôn nhận được sự tin tưởng cũng như những đánh giá tích cực từ khách hàng và là đơn vị uy tín và xứng đáng để bạn trao gửi niềm tin.',
        'We provide everything you need for a journey. Bigbike is proud to always earn customers'' trust and positive reviews, and to be a reputable name worthy of your confidence.',
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 5: mô tả.', now(), now()),
    (gen_random_uuid(), 'about_page_service5_image',
        '/wp-content/themes/bigbike/images/a-5.png', null,
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 5: hình.', now(), now()),
    (gen_random_uuid(), 'about_page_service5_highlight',
        'true', null,
        'public_about', true, 'Trang Giới thiệu — ô dịch vụ 5: nền cam.', now(), now()),

    -- ── Khối Kết nối ──
    (gen_random_uuid(), 'about_page_connect_heading',
        'KẾT NỐI ĐỂ CHÚNG TÔI CÓ THỂ GẦN BẠN HƠN',
        'CONNECT SO WE CAN BE CLOSER TO YOU',
        'public_about', true, 'Trang Giới thiệu — tiêu đề khối Kết nối.', now(), now()),
    (gen_random_uuid(), 'about_page_connect_intro1',
        'Bigbike hiện đã nhận được hơn 80 lượt review 5 sao trên Google map và nhận được nhiều lời khen ngợi khác. Đây chính là những động lực to lớn để chúng tôi tiếp tục cố gắng trở thành người bạn đồng hành tốt nhất của cộng đồng biker Việt Nam.',
        'Bigbike has received more than 80 five-star reviews on Google Maps along with many other compliments. These are huge motivations for us to keep striving to be the best companion of the Vietnamese biker community.',
        'public_about', true, 'Trang Giới thiệu — dòng 1 khối Kết nối.', now(), now()),
    (gen_random_uuid(), 'about_page_connect_intro2',
        'Hãy liên hệ với chúng tôi để được tư vấn thêm về các thông tin chi tiết sản phẩm và để nhận được giá ưu đãi tốt nhất.',
        'Get in touch with us for more advice on detailed product information and to receive the best preferential prices.',
        'public_about', true, 'Trang Giới thiệu — dòng 2 khối Kết nối.', now(), now())
on conflict (setting_key) do nothing;
