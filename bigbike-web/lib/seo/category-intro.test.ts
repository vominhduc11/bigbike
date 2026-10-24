import { describe, expect, it } from "vitest";
import { buildCategoryDescription, extractCategoryFaqs } from "@/lib/seo/category-intro";

describe("extractCategoryFaqs", () => {
  it("đọc câu hỏi từ thẻ tiêu đề và câu trả lời thành chữ thuần", () => {
    expect(
      extractCategoryFaqs(
        '<div class="bb-ci-faq"><h3 class="bb-ci-qt">Chọn <strong>loại</strong> nào?</h3><p class="bb-ci-at">12&nbsp;tháng.</p></div>',
      ),
    ).toEqual([{ question: "Chọn loại nào?", answer: "12 tháng." }]);
  });

  it("không tạo câu hỏi nếu thiếu câu trả lời", () => {
    expect(extractCategoryFaqs('<h3 class="bb-ci-qt">Câu hỏi?</h3>')).toEqual([]);
  });
});

describe("mô tả CollectionPage — SEO_RULE_014", () => {
  const intro =
    '<div class="bb-cat-intro"><span>Danh mục · Mũ</span><p class="bb-ci-body lead">Đoạn <strong>giới thiệu</strong> đúng.&nbsp;Câu thứ hai.</p><span>AGV</span><table><tr><td>Nhóm Điểm mạnh Hạn chế</td></tr></table><h3 class="bb-ci-qt">Câu hỏi?</h3></div>';

  it("ưu tiên SEO theo ngôn ngữ hiện tại, không dùng nhãn/bảng/FAQ", () => {
    expect(buildCategoryDescription("Genuine helmets. Find your fit.", intro, "en")).toBe(
      "Genuine helmets. Find your fit.",
    );
  });

  it.each([null, undefined, "", "  ", "&nbsp;"])("chỉ lấy bb-ci-body khi SEO trống: %s", (seo) => {
    expect(buildCategoryDescription(seo, intro, "vi")).toBe("Đoạn giới thiệu đúng. Câu thứ hai.");
  });

  it("giữ tối đa hai câu và không lấy một phần câu thứ hai quá dài", () => {
    expect(buildCategoryDescription("Một câu. Hai câu. Ba câu.", null, "vi")).toBe(
      "Một câu. Hai câu.",
    );
    expect(
      buildCategoryDescription(`Câu đầu. ${"Câu thứ hai rất dài ".repeat(20)}.`, null, "vi"),
    ).toBe("Câu đầu.");
  });

  it("không nhầm dấu chấm thập phân và TP.HCM thành ranh giới câu", () => {
    const description =
      "Mũ chính hãng tại TP.HCM đạt chuẩn ECE 22.06, từ 1.251g. Chọn theo nhu cầu. Liên hệ shop.";
    expect(buildCategoryDescription(description, null, "vi")).toBe(
      "Mũ chính hãng tại TP.HCM đạt chuẩn ECE 22.06, từ 1.251g. Chọn theo nhu cầu.",
    );
  });

  it("cắt câu đầu quá dài ở cuối từ, dấu … nằm trong giới hạn 160", () => {
    const result = buildCategoryDescription("Chọn mũ bảo hiểm ".repeat(30), null, "vi");
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result).toMatch(/(?:Chọn|mũ|bảo|hiểm)…$/);
  });

  it("không gom chữ từ HTML không có đoạn giới thiệu hoặc class gần giống", () => {
    expect(
      buildCategoryDescription(null, '<div class="bb-ci-body-extra">Bảng và nhãn.</div>', "vi"),
    ).toBe("");
    expect(buildCategoryDescription(null, "<p>Nội dung không có nguồn mô tả.</p>", "vi")).toBe("");
    expect(buildCategoryDescription(null, null, "en")).toBe("");
  });
});
