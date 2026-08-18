import { describe, expect, it } from "vitest";
import { extractCategoryFaqs } from "@/lib/seo/category-intro";

describe("extractCategoryFaqs", () => {
  it("đọc câu hỏi từ thẻ tiêu đề và câu trả lời thành chữ thuần", () => {
    expect(extractCategoryFaqs(
      '<div class="bb-ci-faq"><h3 class="bb-ci-qt">Chọn <strong>loại</strong> nào?</h3><p class="bb-ci-at">12&nbsp;tháng.</p></div>',
    )).toEqual([{ question: "Chọn loại nào?", answer: "12 tháng." }]);
  });

  it("không tạo câu hỏi nếu thiếu câu trả lời", () => {
    expect(extractCategoryFaqs('<h3 class="bb-ci-qt">Câu hỏi?</h3>')).toEqual([]);
  });
});
