-- V308: Gỡ 3 thiết lập chỉ phục vụ footer, không còn tác dụng.
-- footer_tagline, bct_url, business_registration KHÔNG còn được web đọc: nội dung footer
-- (slogan / link Bộ Công Thương / dòng ĐKKD) đã hardcode trong WpFooter.tsx theo quyết định
-- chủ shop 2026-07-03. footer_description GIỮ LẠI vì header (mobile shop-info panel) vẫn đọc.
-- Gỡ cùng: khai báo trong SettingDefinitionRegistry. Idempotent.

delete from site_settings
where setting_key in ('footer_tagline', 'bct_url', 'business_registration');
