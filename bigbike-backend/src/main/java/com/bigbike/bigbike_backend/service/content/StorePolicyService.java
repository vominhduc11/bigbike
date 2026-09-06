package com.bigbike.bigbike_backend.service.content;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.public_.dto.PublicStorePolicyResponse;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.util.List;
import java.util.Locale;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class StorePolicyService {

    private static final Safelist POLICY_HTML = Safelist.relaxed()
            .addTags("section", "article")
            .addAttributes(":all", "class", "style", "id", "aria-label")
            .addAttributes("a", "target", "rel")
            .addProtocols("a", "href", "http", "https", "mailto", "tel");

    private final SiteSettingJpaRepository settingRepo;
    private final FrozenStorePolicyContent frozenContent;

    public StorePolicyService(
            SiteSettingJpaRepository settingRepo,
            FrozenStorePolicyContent frozenContent) {
        this.settingRepo = settingRepo;
        this.frozenContent = frozenContent;
    }

    public PublicStorePolicyResponse get(String rawTopic, String rawLang) {
        PolicyKeys keys = PolicyKeys.fromPath(rawTopic);
        String lang = "en".equalsIgnoreCase(rawLang) ? "en" : "vi";
        FrozenStorePolicyContent.PolicyDocument source = frozenContent.get(keys.path(), lang);
        String selectedBody = hydrateSharedContact(keys, source.bodyHtml(), lang);
        return new PublicStorePolicyResponse(
                keys.path(), source.title(),
                Jsoup.clean(selectedBody, POLICY_HTML), FrozenStorePolicyContent.FROZEN_AT);
    }

    public String plainText(String rawTopic, String lang) {
        return Jsoup.parse(get(rawTopic, lang).bodyHtml()).text().replaceAll("\\s+", " ").trim();
    }

    /**
     * The published policy split at its own headings, in document order. BigBike Assistant answers
     * the part of the policy the customer actually asked about; pasting the whole page into a chat
     * bubble was unreadable on a phone.
     */
    public List<PolicySection> sections(String rawTopic, String lang) {
        Document document = Jsoup.parse(get(rawTopic, lang).bodyHtml());
        List<PolicySection> sections = new java.util.ArrayList<>();
        StringBuilder lead = new StringBuilder();
        String heading = null;
        StringBuilder body = new StringBuilder();
        for (Element element : document.body().children()) {
            for (Element node : element.select("h2").isEmpty()
                    ? List.of(element) : element.children()) {
                if ("h2".equalsIgnoreCase(node.tagName())) {
                    if (heading != null) sections.add(section(heading, body));
                    heading = node.text().replaceAll("\\s+", " ").trim();
                    body = new StringBuilder();
                } else if (heading == null) {
                    lead.append(' ').append(node.text());
                } else {
                    body.append(' ').append(node.text());
                }
            }
        }
        if (heading != null) sections.add(section(heading, body));
        String intro = lead.toString().replaceAll("\\s+", " ").trim();
        if (!intro.isBlank()) sections.add(0, new PolicySection("", intro));
        return List.copyOf(sections);
    }

    private static PolicySection section(String heading, StringBuilder body) {
        return new PolicySection(heading, body.toString().replaceAll("\\s+", " ").trim());
    }

    /** One heading of a published policy plus its plain text. */
    public record PolicySection(String heading, String text) {}

    private static String pick(SiteSettingEntity setting, String lang) {
        String value = "en".equals(lang) ? setting.getSettingValueEn() : setting.getSettingValue();
        if (value == null || value.isBlank()) value = setting.getSettingValue();
        return value == null ? "" : value.trim();
    }

    /**
     * Policy terms are frozen in backend resources, while public contact details remain shared
     * site settings.
     * Hydrating those contact fields keeps one policy source without freezing a phone number,
     * address or opening time inside policy HTML.
     */
    private String hydrateSharedContact(PolicyKeys keys, String html, String lang) {
        boolean english = "en".equals(lang);
        String hotline = settingValue("hotline", lang);
        String zalo = firstNonBlank(
                settingValue("hotline_2", lang), settingValue("zalo_display", lang));
        String messenger = firstNonBlank(
                settingValue("messenger_display", lang), settingValue("messenger_url", lang));
        String address = settingValue("contact_address", lang);
        String hours = String.join(" · ", List.of(
                        settingValue("opening_hours_weekday", lang),
                        settingValue("opening_hours_weekend", lang)).stream()
                .filter(value -> !value.isBlank())
                .toList());

        Document document = Jsoup.parseBodyFragment(html);
        if ("return-exchange".equals(keys.path())) {
            hydrateReturnExchangeContact(document, hotline, zalo, messenger, address, hours, english);
            return document.body().html();
        }

        List<Element> steps = document.select("ol > li");
        if (!steps.isEmpty()) {
            Element body = steps.get(0).selectFirst("div.leading-body span");
            if (body != null) {
                String channels = contactChannels(zalo, hotline, messenger, english);
                body.text(channels + (english
                        ? " — describe the issue and send photos or video of the product."
                        : " — mô tả lỗi và gửi ảnh hoặc video sản phẩm."));
            }
        }
        if (steps.size() >= 3 && !address.isBlank()) {
            Element body = steps.get(2).selectFirst("div.leading-body span");
            if (body != null) {
                body.text((english
                        ? "Bring it directly to the shop or ship it as instructed. Address: "
                        : "Mang trực tiếp đến shop hoặc gửi theo hướng dẫn. Địa chỉ: ")
                        + address + ".");
            }
        }

        Element emptyContactBody = document.select("table tbody").stream()
                .filter(element -> element.childrenSize() == 0)
                .findFirst()
                .orElse(null);
        if (emptyContactBody != null) {
            addContactRow(emptyContactBody, english ? "Hotline" : "Hotline", hotline);
            addContactRow(emptyContactBody, english ? "Zalo support" : "Zalo tư vấn", zalo);
            addContactRow(emptyContactBody, "Messenger", messenger);
            addContactRow(emptyContactBody, english ? "Business hours" : "Giờ làm việc", hours);
            addContactRow(emptyContactBody, english ? "Address" : "Địa chỉ", address);
        }
        return document.body().html();
    }

    private static void hydrateReturnExchangeContact(
            Document document,
            String hotline,
            String zalo,
            String messenger,
            String address,
            String hours,
            boolean english) {
        for (Element cell : document.select("td")) {
            String text = cell.text().trim().toLowerCase(Locale.ROOT);
            if (text.startsWith("liên hệ bigbike trong thời hạn")
                    || text.startsWith("contact bigbike within")) {
                cell.empty();
                cell.appendElement("strong").text(english
                        ? "Contact BigBike within the applicable period"
                        : "Liên hệ BigBike trong thời hạn");
                cell.appendElement("br");
                cell.appendText(contactChannels(zalo, hotline, messenger, english) + (english
                        ? ". Describe the reason and send product photos or video."
                        : " — mô tả lý do và gửi ảnh hoặc video sản phẩm."));
            } else if (text.startsWith("gửi hàng về bigbike")
                    || text.startsWith("send the product to bigbike")) {
                cell.empty();
                cell.appendElement("strong").text(english
                        ? "Send the product to BigBike"
                        : "Gửi hàng về BigBike");
                cell.appendElement("br");
                if (address.isBlank()) {
                    cell.appendText(english
                            ? "Follow BigBike's shipping instructions."
                            : "Gửi theo hướng dẫn của BigBike.");
                } else {
                    cell.appendText((english
                            ? "Pack it securely and clearly write your name and phone number. Send it to "
                            : "Đóng gói kỹ, ghi rõ tên và số điện thoại. Gửi về ")
                            + address + ".");
                }
            }
        }

        Element contactHeading = document.select("h2").stream()
                .filter(element -> {
                    String text = element.text().trim().toLowerCase(Locale.ROOT);
                    return text.contains("liên hệ hỗ trợ đổi")
                            || text.contains("returns and exchanges support");
                })
                .findFirst()
                .orElse(null);
        Element contactTable = nextSiblingTable(contactHeading);
        if (contactTable == null) return;
        Element body = contactTable.selectFirst("tbody");
        if (body == null) body = contactTable.appendElement("tbody");
        body.empty();
        addContactRow(body, "Hotline", hotline);
        addContactRow(body, english ? "Zalo support" : "Zalo tư vấn", zalo);
        addContactRow(body, "Messenger", messenger);
        addContactRow(body, english ? "Business hours" : "Giờ làm việc", hours);
        addContactRow(body, english ? "Address" : "Địa chỉ", address);
    }

    private static Element nextSiblingTable(Element heading) {
        Element next = heading == null ? null : heading.nextElementSibling();
        while (next != null && !"table".equals(next.normalName())) {
            next = next.nextElementSibling();
        }
        return next;
    }

    private String settingValue(String key, String lang) {
        return settingRepo.findBySettingKey(key).map(setting -> pick(setting, lang)).orElse("");
    }

    private static String firstNonBlank(String first, String second) {
        return first == null || first.isBlank() ? (second == null ? "" : second) : first;
    }

    private static String contactChannels(String zalo, String hotline, String messenger, boolean english) {
        List<String> channels = new java.util.ArrayList<>();
        if (hotline != null && !hotline.isBlank()) {
            channels.add(english ? "call Hotline " + hotline : "gọi Hotline " + hotline);
        }
        if (zalo != null && !zalo.isBlank()) {
            channels.add(english ? "message Zalo " + zalo : "nhắn Zalo " + zalo);
        }
        if (messenger != null && !messenger.isBlank()) {
            channels.add(english ? "message Messenger " + messenger : "nhắn Messenger " + messenger);
        }
        if (channels.isEmpty()) {
            return english
                    ? "contact BigBike through Hotline, Zalo or Messenger"
                    : "liên hệ BigBike qua Hotline, Zalo hoặc Messenger";
        }
        if (channels.size() == 1) return english ? "Please " + channels.get(0) : "Vui lòng " + channels.get(0);
        String separator = english ? ", " : ", ";
        int last = channels.size() - 1;
        String joined = String.join(separator, channels.subList(0, last));
        return english
                ? "Please " + joined + " or " + channels.get(last)
                : "Vui lòng " + joined + " hoặc " + channels.get(last);
    }

    private static void addContactRow(Element body, String label, String value) {
        if (value == null || value.isBlank()) return;
        Element row = body.appendElement("tr");
        row.appendElement("th").attr("scope", "row").text(label);
        row.appendElement("td").text(value);
    }

    private record PolicyKeys(String path) {
        static PolicyKeys fromPath(String raw) {
            String topic = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
            return switch (topic) {
                case "warranty" -> new PolicyKeys("warranty");
                case "return-exchange" -> new PolicyKeys("return-exchange");
                default -> throw new NotFoundException("Không tìm thấy chính sách.");
            };
        }
    }
}
