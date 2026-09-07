import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SearchPageForm } from "./SearchPageForm";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "vi",
}));

describe("SearchPageForm", () => {
  beforeEach(() => push.mockReset());

  // SEARCH_RULE_006: trước đây trang kết quả in "Nhập từ khoá để tìm kiếm sản phẩm."
  // mà không có ô nào để nhập.
  it("hiện ô nhập ngay cả khi chưa có từ khoá", () => {
    render(<SearchPageForm initialQuery="" />);

    expect(screen.getByRole("searchbox")).toHaveValue("");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "komine" } });
    fireEvent.submit(screen.getByRole("search"));

    expect(push).toHaveBeenCalledWith("/tim-kiem/?s=komine");
  });

  it("điền sẵn từ khoá đang tìm để khách sửa tại chỗ", () => {
    render(<SearchPageForm initialQuery="komine" />);

    const input = screen.getByRole("searchbox");
    expect(input).toHaveValue("komine");

    fireEvent.change(input, { target: { value: "  ls2  " } });
    fireEvent.submit(screen.getByRole("search"));

    expect(push).toHaveBeenCalledWith("/tim-kiem/?s=ls2");
  });

  it("không điều hướng khi ô rỗng hoặc từ khoá quá dài", () => {
    render(<SearchPageForm initialQuery="" />);
    const input = screen.getByRole("searchbox");

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("search"));
    expect(push).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "x".repeat(101) } });
    fireEvent.submit(screen.getByRole("search"));
    expect(push).not.toHaveBeenCalled();
  });
});
