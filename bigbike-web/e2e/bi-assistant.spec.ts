import { expect, test } from "@playwright/test";

const BACKEND = process.env.PW_BACKEND_URL || "http://localhost:8080";

test.describe.configure({ mode: "serial" });

test("Bi: customer asks for a product, receives a real product card, then opens staff contact", async ({ page, request }) => {
  const availabilityResponse = await request.get(`${BACKEND}/api/v1/chat/availability?lang=vi`);
  if (!availabilityResponse.ok()) {
    test.skip(true, "Backend đang chạy chưa được cập nhật endpoint Bi; cần deploy migration V1016 và bản backend mới.");
    return;
  }
  const availabilityPayload = await availabilityResponse.json();
  if (availabilityPayload?.data?.mode !== "AI") {
    test.skip(true, `Bi không ở chế độ AI trên môi trường hiện tại (${availabilityPayload?.data?.reason || "không rõ lý do"}).`);
    return;
  }

  await page.goto("/", { waitUntil: "load", timeout: 60000 });
  const openButton = page.getByRole("button", { name: /Mở trợ lý Bi|Open Bi assistant/i });
  await expect(openButton).toBeVisible();
  await openButton.click();
  await expect(page.getByText(/Trợ lý ảo AI|AI assistant/i).first()).toBeVisible();

  const input = page.getByLabel(/Câu hỏi dành cho Bi|Question for Bi/i);
  await input.fill("cho em mũ 3/4 tầm 2 triệu rưỡi đổ lại");
  await page.getByRole("button", { name: /Gửi câu hỏi|Send question/i }).click();

  await expect(page.getByRole("link", { name: /Xem sản phẩm|View product/i }).first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/₫|VND/).first()).toBeVisible();

  await page.getByRole("button", { name: /Gặp nhân viên|Talk to staff/i }).click();
  await expect(page.getByText(/Liên hệ nhân viên BigBike|Contact BigBike staff/i)).toBeVisible();
  await expect(page.getByText(/Hotline/i).first()).toBeVisible();
});

test("Bi: when AI is unavailable, the existing contact channels remain available", async ({ page }) => {
  await page.goto("/", { waitUntil: "load", timeout: 60000 });
  const openButton = page.getByRole("button", { name: /Mở trợ lý Bi|Open Bi assistant/i });
  await expect(openButton).toBeVisible();
  await openButton.click();

  const fallback = page.getByText(/Bi đang tạm không khả dụng|Bi is temporarily unavailable/i);
  const aiInput = page.getByLabel(/Câu hỏi dành cho Bi|Question for Bi/i);
  await expect(fallback.or(aiInput)).toBeVisible({ timeout: 30000 });

  if (await aiInput.isVisible().catch(() => false)) {
    test.skip(true, "Bi đang bật trên môi trường thật; không tự ý tắt setting dùng chung chỉ để chạy E2E.");
    return;
  }

  await expect(fallback).toBeVisible();
  await expect(page.getByText(/Liên hệ nhân viên BigBike|Contact BigBike staff/i)).toBeVisible();
  await expect(page.getByText(/Hotline|Zalo|Messenger/i).first()).toBeVisible();
});
