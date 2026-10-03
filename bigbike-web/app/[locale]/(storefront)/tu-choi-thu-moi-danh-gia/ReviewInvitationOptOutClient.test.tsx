import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewInvitationOptOutClient } from "./ReviewInvitationOptOutClient";
const localeState = vi.hoisted(() => ({ value: "vi" }));

vi.mock("next-intl", () => ({
  useLocale: () => localeState.value,
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      loading: "Đang tải",
      confirmTitle: "Xác nhận từ chối",
      confirmMessage: "Bạn sẽ không nhận thư mời đánh giá nữa.",
      confirm: "Không nhận nữa",
      submitting: "Đang cập nhật",
      retry: "Thử lại",
      errorTitle: "Không cập nhật được",
      errorMessage: "Vui lòng thử lại.",
      successTitle: "Đã ghi nhận",
      successMessage: "Bạn sẽ không nhận loại thư này nữa.",
      missingTitle: "Đường dẫn không hợp lệ",
      missingMessage: "Vui lòng mở lại từ email.",
      backHome: "Về trang chủ",
    };
    return messages[key] ?? key;
  },
}));

vi.mock("@/i18n/StorefrontLink", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));

afterEach(() => {
  localeState.value = "vi";
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("ReviewInvitationOptOutClient", () => {
  it.each(["vi", "en"])(
    "keeps the Home link in %s without submitting an opt-out",
    async (locale) => {
      localeState.value = locale;
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      render(<ReviewInvitationOptOutClient />);
      expect(await screen.findByRole("link", { name: "Về trang chủ" })).toHaveAttribute(
        "href",
        locale === "en" ? "/en/" : "/",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("lets a guest permanently opt out using only the secret email fragment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { unsubscribed: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/tu-choi-thu-moi-danh-gia/#token=anonymous-stop-token");

    render(<ReviewInvitationOptOutClient />);

    const confirm = await screen.findByRole("button", { name: "Không nhận nữa" });
    expect(window.location.hash).toBe("");
    await userEvent.click(confirm);

    await screen.findByText("Đã ghi nhận");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/review-invitations\/unsubscribe$/);
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(JSON.parse(String(init.body))).toEqual({ token: "anonymous-stop-token" });
    await waitFor(() => expect(screen.getByRole("link", { name: "Về trang chủ" })).toBeVisible());
  });
});
