import { expect, test } from "@playwright/test";

test("khách từ chối thư mời đánh giá mà không cần đăng nhập", async ({ page }) => {
  let submittedToken: string | undefined;

  await page.route("**/api/v1/review-invitations/unsubscribe", async (route) => {
    submittedToken = route.request().postDataJSON()?.token;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ unsubscribed: true }),
    });
  });

  await page.goto("/tu-choi-thu-moi-danh-gia/#token=e2e-stop-token");

  await expect(page).not.toHaveURL(/#token=/);
  await expect(
    page.getByRole("heading", { name: "Không nhận thư mời đánh giá nữa?" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Xác nhận từ chối" }).click();

  await expect(page.getByRole("heading", { name: "Đã ghi nhận" })).toBeVisible();
  await expect(
    page.getByText("Email của anh/chị sẽ không nhận thêm thư mời đánh giá từ BigBike."),
  ).toBeVisible();
  expect(submittedToken).toBe("e2e-stop-token");
});
