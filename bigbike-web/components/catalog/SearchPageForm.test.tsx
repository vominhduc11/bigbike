import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SearchPageForm } from "./SearchPageForm";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  trackSearch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "vi",
}));

vi.mock("@/lib/analytics", () => ({ trackSearch: mocks.trackSearch }));

describe("SearchPageForm", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.trackSearch.mockReset();
  });

  // SEARCH_RULE_006: trước đây trang kết quả in "Nhập từ khoá để tìm kiếm sản phẩm."
  // mà không có ô nào để nhập.
  it("hiện ô nhập ngay cả khi chưa có từ khoá", () => {
    render(<SearchPageForm initialQuery="" resultCount={0} resultsAvailable={false} />);

    expect(screen.getByRole("searchbox")).toHaveValue("");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "komine" } });
    fireEvent.submit(screen.getByRole("search"));

    expect(mocks.push).toHaveBeenCalledWith("/tim-kiem/?s=komine");
  });

  it("điền sẵn từ khoá đang tìm để khách sửa tại chỗ", () => {
    render(<SearchPageForm initialQuery="komine" resultCount={12} resultsAvailable />);

    expect(mocks.trackSearch).toHaveBeenCalledWith("komine", 12, "results_page");

    const input = screen.getByRole("searchbox");
    expect(input).toHaveValue("komine");

    fireEvent.change(input, { target: { value: "  ls2  " } });
    fireEvent.submit(screen.getByRole("search"));

    expect(mocks.push).toHaveBeenCalledWith("/tim-kiem/?s=ls2");
  });

  it("không điều hướng khi ô rỗng hoặc từ khoá quá dài", () => {
    render(<SearchPageForm initialQuery="" resultCount={0} resultsAvailable={false} />);
    const input = screen.getByRole("searchbox");

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("search"));
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "x".repeat(101) } });
    fireEvent.submit(screen.getByRole("search"));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("đo cả kết quả rỗng thành công nhưng không đo trang lỗi", () => {
    const { rerender } = render(
      <SearchPageForm initialQuery="không có" resultCount={0} resultsAvailable />,
    );
    expect(mocks.trackSearch).toHaveBeenCalledExactlyOnceWith("không có", 0, "results_page");

    rerender(
      <SearchPageForm initialQuery="lỗi hệ thống" resultCount={0} resultsAvailable={false} />,
    );
    expect(mocks.trackSearch).toHaveBeenCalledTimes(1);
  });
});
