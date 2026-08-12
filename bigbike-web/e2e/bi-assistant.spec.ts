import { expect, test, type Page, type Route } from "@playwright/test";

const CONTACTS = {
  hotline: "0900 000 000",
  zaloUrl: "https://zalo.example/bigbike",
  messengerUrl: "https://m.me/bigbike",
  zaloDisplay: "BigBike Zalo",
  messengerDisplay: "BigBike Messenger",
};

const CONVERSATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type AvailabilityOverrides = {
  mode?: "AI" | "CONTACT";
  greeting?: string | null;
  quickPrompts?: string[];
  maxTurns?: number;
  contacts?: Record<string, unknown>;
  delayMs?: number;
};

type MessageOverrides = {
  conversationId?: string | null;
  mode?: "AI" | "CONTACT";
  answer?: string | null;
  turnCount?: number;
  maxTurns?: number;
  remainingTurns?: number;
  products?: Array<Record<string, unknown>>;
  handoffRecommended?: boolean;
  leadPrompt?: boolean;
  actions?: Array<Record<string, unknown>>;
  contacts?: Record<string, unknown>;
};

async function fulfillJson(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ data }),
  });
}

async function stubAvailability(page: Page, overrides: AvailabilityOverrides = {}) {
  await page.route("**/api/v1/chat/availability?lang=vi", async (route) => {
    if (overrides.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, overrides.delayMs));
    }
    const mode = overrides.mode ?? "AI";
    await fulfillJson(route, {
      mode,
      reason: mode,
      greeting: overrides.greeting === undefined
        ? "Anh/chị đang tìm loại sản phẩm nào?"
        : overrides.greeting,
      quickPrompts: overrides.quickPrompts ?? [
        "Tìm theo nhu cầu",
        "Lọc theo ngân sách",
        "So sánh sản phẩm",
        "Kiểm tra còn hàng",
      ],
      maxTurns: overrides.maxTurns ?? 12,
      contacts: overrides.contacts ?? CONTACTS,
    });
  });
}

function messageResponse(overrides: MessageOverrides = {}) {
  return {
    conversationId: overrides.conversationId === undefined ? CONVERSATION_ID : overrides.conversationId,
    mode: overrides.mode ?? "AI",
    reason: overrides.mode ?? "AI",
    answer: overrides.answer === undefined ? "Bi đã kiểm tra dữ liệu sản phẩm hiện có." : overrides.answer,
    turnCount: overrides.turnCount ?? 1,
    maxTurns: overrides.maxTurns ?? 12,
    remainingTurns: overrides.remainingTurns ?? 11,
    products: overrides.products ?? [],
    handoffRecommended: overrides.handoffRecommended ?? false,
    leadPrompt: overrides.leadPrompt ?? false,
    actions: overrides.actions ?? [],
    contacts: overrides.contacts ?? CONTACTS,
  };
}

function biDialog(page: Page) {
  return page.locator("[data-bi-assistant]");
}

function conversation(page: Page) {
  return page.locator("[data-bi-conversation]");
}

function composer(page: Page) {
  return page.locator("[data-bi-composer]");
}

function launcher(page: Page) {
  return page.getByRole("button", { name: /Mở trợ lý Bi|Open Bi assistant/i });
}

function messageInput(page: Page) {
  return page.getByLabel(/Câu hỏi dành cho Bi|Question for Bi/i);
}

async function openBi(page: Page) {
  const trigger = launcher(page);
  await expect(trigger).toBeVisible();
  await expect(page.locator("#bb-floating-chat-trigger")).toHaveAttribute("data-bi-launcher-ready", "true");
  await trigger.focus();
  await trigger.press("Enter");
  await expect(biDialog(page)).toBeVisible();
}

async function sendMessage(page: Page, message: string) {
  await messageInput(page).fill(message);
  await page.getByRole("button", { name: /Gửi tin nhắn|Send message/i }).click();
}

test("Bi loads availability once, shows AI onboarding, and sends a quick reply through chat API", async ({ page }) => {
  let availabilityRequests = 0;
  const cloudinaryRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("res.cloudinary.com")) cloudinaryRequests.push(request.url());
  });
  await page.route("**/api/v1/chat/availability?lang=vi", async (route) => {
    availabilityRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fulfillJson(route, {
      mode: "AI",
      reason: "AI",
      greeting: "Anh/chị đang tìm loại sản phẩm nào?",
      quickPrompts: ["Tìm theo nhu cầu", "Lọc theo ngân sách", "So sánh sản phẩm", "Kiểm tra còn hàng", "Prompt dư"],
      maxTurns: 12,
      contacts: CONTACTS,
    });
  });
  await page.route("**/api/v1/chat/messages", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      conversationId: null,
      message: "Tìm theo nhu cầu",
      lang: "vi",
    });
    await fulfillJson(route, messageResponse({ answer: "Anh/chị chủ yếu dùng sản phẩm để đi phố, touring hay đi xa?" }));
  });

  await page.goto("/", { waitUntil: "load" });
  const trigger = launcher(page);
  await expect(page.locator("#bb-floating-chat-trigger")).toHaveAttribute("data-bi-launcher-ready", "true");
  await trigger.focus();
  await trigger.press("Enter");
  await expect(biDialog(page)).toBeVisible();
  await expect(biDialog(page).getByText("Bi đang chuẩn bị phiên tư vấn…")).toBeVisible();
  const onboarding = biDialog(page).locator("[data-bi-onboarding]");
  await expect(onboarding).toBeVisible();
  await expect(onboarding.getByText("Anh/chị đang tìm loại sản phẩm nào?")).toBeVisible();
  await expect(biDialog(page).locator('[data-bi-avatar] img[src*="res.cloudinary.com"]')).toHaveCount(2);
  expect(cloudinaryRequests).toEqual([]);
  const panelBox = await biDialog(page).boundingBox();
  const viewport = page.viewportSize();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.width).toBeGreaterThanOrEqual(400);
  expect(panelBox!.width).toBeLessThanOrEqual(440);
  expect(panelBox!.height).toBeLessThanOrEqual(640);
  expect(panelBox!.height).toBeLessThanOrEqual((viewport?.height ?? 736) - 96);
  await expect(onboarding.getByRole("button")).toHaveCount(4);
  await expect(onboarding.getByRole("button", { name: "Prompt dư" })).toHaveCount(0);
  await expect(composer(page).getByRole("button", { name: "Gặp nhân viên" })).toBeVisible();

  await onboarding.getByRole("button", { name: "Tìm theo nhu cầu" }).press("Enter");
  await expect(conversation(page).getByText("Anh/chị chủ yếu dùng sản phẩm để đi phố, touring hay đi xa?")).toBeVisible();

  await biDialog(page).getByRole("button", { name: "Thu nhỏ trợ lý Bi" }).click();
  await page.getByRole("button", { name: "Mở lại trợ lý Bi" }).click();
  await expect(conversation(page).getByText("Anh/chị chủ yếu dùng sản phẩm để đi phố, touring hay đi xa?")).toBeVisible();
  expect(availabilityRequests).toBe(1);
});

test("Bi renders at most three verified, sellable product cards", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages", async (route) => {
    await fulfillJson(route, messageResponse({
      answer: "Dạ, em đã tìm được các mẫu phù hợp. Anh/chị có thể xem các thẻ sản phẩm bên dưới nhé.",
      products: [
        {
          slug: "mu-pho",
          name: "Mũ đi phố",
          imageUrl: null,
          retailPrice: 1_590_000,
          salePrice: null,
          currency: "VND",
          stockState: "IN_STOCK",
        },
        {
          slug: "mu-touring",
          name: "Mũ touring",
          imageUrl: null,
          retailPrice: 2_400_000,
          salePrice: null,
          currency: "VND",
          stockState: "IN_STOCK",
        },
        {
          slug: "mu-fullface",
          name: "Mũ fullface",
          imageUrl: null,
          retailPrice: 3_000_000,
          salePrice: null,
          currency: "VND",
          stockState: "IN_STOCK",
        },
      ],
    }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBi(page);
  await sendMessage(page, "Tìm ba mẫu mũ phù hợp");

  const cards = conversation(page).locator("[data-bi-product-card]");
  await expect(cards).toHaveCount(3);
  await expect(conversation(page).locator("[data-bi-product-list]")).toHaveClass(/overflow-x-auto/);
  await expect(cards.filter({ hasText: "Mũ đi phố" })).toContainText("Còn hàng");
  await expect(cards.filter({ hasText: "Mũ touring" })).toContainText("Còn hàng");
  await expect(cards.filter({ hasText: "Mũ fullface" })).toContainText("Còn hàng");
  await expect(cards.getByRole("link", { name: "Xem chi tiết" })).toHaveCount(3);
});

test("Bi fails closed when a product card is unpriced, unsellable or exceeds the safe limit", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages", async (route) => {
    await fulfillJson(route, messageResponse({
      answer: "Dạ, em đã kiểm tra kết quả. Anh/chị xem các thẻ sản phẩm bên dưới nhé.",
      products: [
        {
          slug: "mu-hop-le",
          name: "Mũ hợp lệ",
          retailPrice: 1_590_000,
          currency: "VND",
          stockState: "IN_STOCK",
        },
        {
          slug: "camera-khong-hop-le",
          name: "Camera không được bán",
          retailPrice: null,
          currency: "VND",
          stockState: "OUT_OF_STOCK",
        },
      ],
    }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBi(page);
  await sendMessage(page, "tai nghe dưới 3 triệu");

  await expect(page.locator("[data-bi-contact-view]")).toBeVisible();
  await expect(conversation(page).getByText("Camera không được bán")).toHaveCount(0);
  await expect(page.getByText("BigBike Zalo")).toBeVisible();
  await expect(page.getByText("BigBike Messenger")).toBeVisible();
});

test("Bi presents a handoff recommendation without pretending a staff connection", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages", async (route) => {
    await fulfillJson(route, messageResponse({
      answer: "Bi chưa có đủ dữ liệu đã xác nhận cho yêu cầu này.",
      handoffRecommended: true,
    }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBi(page);
  await sendMessage(page, "Mẫu này có phù hợp tuyệt đối không?");

  await expect(conversation(page).getByText(/chưa đủ dữ liệu để trả lời chính xác/i)).toBeVisible();
  await expect(composer(page).getByRole("button", { name: "Gặp nhân viên" })).toBeVisible();
  await expect(composer(page).getByRole("button", { name: "Tiếp tục hỏi Bi" })).toBeVisible();
  await expect(page.getByText(/nhân viên đang online/i)).toHaveCount(0);
  await expect(messageInput(page)).toBeEnabled();

  await composer(page).getByRole("button", { name: "Tiếp tục hỏi Bi" }).click();
  await expect(page.locator("[data-bi-contact-view]")).toHaveCount(0);
  await expect(messageInput(page)).toBeFocused();

  await composer(page).getByRole("button", { name: "Gặp nhân viên" }).click();
  await expect(page.locator("[data-bi-contact-view]")).toContainText("Bi vẫn giữ cuộc trò chuyện này trong phiên hiện tại.");
});

test("Bi shows no-results only for an explicit product-finding quick reply", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages", async (route) => {
    await fulfillJson(route, messageResponse({ answer: "Chưa có mẫu nào đáp ứng đồng thời các điều kiện này." }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBi(page);
  await biDialog(page).locator("[data-bi-onboarding]").getByRole("button", { name: "Tìm theo nhu cầu" }).click();

  await expect(conversation(page).getByText("Chưa tìm thấy mẫu khớp đủ điều kiện.")).toBeVisible();
  await expect(composer(page).getByRole("button", { name: "Đổi ngân sách" })).toBeVisible();
  await expect(composer(page).getByRole("button", { name: "Đổi nhu cầu" })).toBeVisible();
  await expect(composer(page).getByRole("button", { name: "Gặp nhân viên" })).toBeVisible();
});

test("A product-free FAQ answer is not mislabeled as no-results", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages", async (route) => {
    await fulfillJson(route, messageResponse({ answer: "BigBike sẽ tư vấn theo thông tin đã được xác nhận." }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBi(page);
  await sendMessage(page, "BigBike tư vấn thế nào?");

  await expect(conversation(page).getByText("BigBike sẽ tư vấn theo thông tin đã được xác nhận.")).toBeVisible();
  await expect(conversation(page).getByText("Chưa tìm thấy mẫu khớp đủ điều kiện.")).toHaveCount(0);
});

test("A message network error fails safely to contact mode and offers retry", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages", (route) => route.abort("failed"));

  await page.goto("/", { waitUntil: "load" });
  await openBi(page);
  await sendMessage(page, "Tìm mũ bảo hiểm");

  const contactView = page.locator("[data-bi-contact-view]");
  await expect(contactView).toBeVisible();
  await expect(contactView.getByText("Kết nối đang gián đoạn; anh/chị có thể thử lại hoặc liên hệ nhân viên.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await expect(page.getByText(/stack trace|exception|functionCall|SQL/i)).toHaveCount(0);
});

test("CONTACT availability renders only valid channels and handles no contact data", async ({ page }) => {
  await stubAvailability(page, {
    mode: "CONTACT",
    quickPrompts: [],
    contacts: {
      hotline: "not-a-phone",
      zaloUrl: "javascript:alert(1)",
      messengerUrl: "not-a-url",
    },
  });
  let messageRequests = 0;
  await page.route("**/api/v1/chat/messages", async (route) => {
    messageRequests += 1;
    await route.abort("failed");
  });

  await page.goto("/", { waitUntil: "load" });
  await openBi(page);

  await expect(page.getByText("Kết nối tư vấn", { exact: true })).toBeVisible();
  await expect(page.getByText("Thông tin liên hệ đang được cập nhật. Anh/chị vui lòng thử lại sau.")).toBeVisible();
  await expect(page.locator('[data-bi-contact-view] a[href=""]')).toHaveCount(0);
  await expect(page.getByText(/null|undefined|\[object Object\]/i)).toHaveCount(0);
  expect(messageRequests).toBe(0);
});

test("Lead capture validates consent, keeps values after submit error, and succeeds on retry", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages", async (route) => {
    await fulfillJson(route, messageResponse({
      answer: "BigBike có thể liên hệ lại nếu anh/chị đồng ý.",
      leadPrompt: true,
    }));
  });
  let leadAttempts = 0;
  await page.route("**/api/v1/chat/leads", async (route) => {
    leadAttempts += 1;
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({
      conversationId: CONVERSATION_ID,
      phone: "0909123456",
      name: "Minh",
      note: "Cần tư vấn mũ touring",
      consent: true,
    });
    if (leadAttempts === 1) {
      await fulfillJson(route, { message: "temporary" }, 500);
      return;
    }
    await fulfillJson(route, { captured: true });
  });

  await page.goto("/", { waitUntil: "load" });
  await openBi(page);
  await sendMessage(page, "Nhờ BigBike gọi lại");

  const leadForm = conversation(page).getByRole("heading", { name: "Để BigBike liên hệ lại" }).locator("..").locator("..");
  await expect(leadForm).toBeVisible();
  await leadForm.getByRole("button", { name: "Đồng ý gửi thông tin" }).click();
  await expect(leadForm.getByText("Vui lòng nhập số điện thoại hoặc Zalo.")).toBeVisible();
  await expect(leadForm.getByText("Anh/chị cần đồng ý trước khi gửi thông tin.")).toBeVisible();

  await leadForm.getByLabel("Tên của anh/chị (không bắt buộc)").fill("Minh");
  await leadForm.getByLabel("Số điện thoại hoặc Zalo").fill("0909123456");
  await leadForm.getByLabel("Nhu cầu cần hỗ trợ (không bắt buộc)").fill("Cần tư vấn mũ touring");
  await leadForm.getByRole("checkbox").check();
  await leadForm.getByRole("button", { name: "Đồng ý gửi thông tin" }).click();

  await expect(leadForm.getByText(/Chưa gửi được thông tin/)).toBeVisible();
  await expect(leadForm.getByLabel("Số điện thoại hoặc Zalo")).toHaveValue("0909123456");
  await expect(leadForm.getByLabel("Nhu cầu cần hỗ trợ (không bắt buộc)")).toHaveValue("Cần tư vấn mũ touring");

  await leadForm.getByRole("button", { name: "Đồng ý gửi thông tin" }).click();
  await expect(conversation(page).getByText(/BigBike đã ghi nhận và sẽ liên hệ/)).toBeVisible();
  expect(leadAttempts).toBe(2);
});

test("Bi warns only near the turn limit and then disables further AI questions", async ({ page }) => {
  await stubAvailability(page);
  let messageCount = 0;
  await page.route("**/api/v1/chat/messages", async (route) => {
    messageCount += 1;
    await fulfillJson(route, messageResponse(messageCount === 1
      ? {
          answer: "Bi sẽ ưu tiên giúp anh/chị chốt lựa chọn.",
          turnCount: 9,
          remainingTurns: 3,
        }
      : {
          answer: "Cuộc tư vấn đã đến lượt cuối.",
          turnCount: 12,
          remainingTurns: 0,
        }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBi(page);
  await sendMessage(page, "Câu hỏi thứ chín");
  await expect(composer(page).getByText(/Cuộc trò chuyện còn 3 lượt/)).toBeVisible();

  await sendMessage(page, "Câu hỏi cuối");
  await expect(page.locator("[data-bi-contact-view]").getByText(/Cuộc trò chuyện đã đạt giới hạn/)).toBeVisible();
  await expect(messageInput(page)).toHaveCount(0);
});

test("Minimize, close, reopen, Escape, and focus restoration preserve the conversation", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages", async (route) => {
    await fulfillJson(route, messageResponse({ answer: "Kết quả tư vấn được giữ lại trong phiên này." }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBi(page);
  await sendMessage(page, "Giữ lại hội thoại này");
  await expect(conversation(page).getByText("Kết quả tư vấn được giữ lại trong phiên này.")).toBeVisible();

  await biDialog(page).getByRole("button", { name: "Thu nhỏ trợ lý Bi" }).click();
  const minimized = page.getByRole("button", { name: "Mở lại trợ lý Bi" });
  await expect(minimized).toBeVisible();
  await expect(page.getByText("Bi · Tiếp tục tư vấn")).toBeVisible();
  await minimized.click();
  await expect(conversation(page).getByText("Kết quả tư vấn được giữ lại trong phiên này.")).toBeVisible();

  await biDialog(page).getByRole("button", { name: "Đóng trợ lý Bi" }).click();
  await expect(biDialog(page)).toBeHidden();
  await expect(launcher(page)).toBeFocused();
  await launcher(page).press("Enter");
  await expect(conversation(page).getByText("Kết quả tư vấn được giữ lại trong phiên này.")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(biDialog(page)).toBeHidden();
  await expect(launcher(page)).toBeFocused();
  const scrollState = await page.evaluate(() => ({
    body: getComputedStyle(document.body).overflowY,
    html: getComputedStyle(document.documentElement).overflowY,
    locked: document.body.hasAttribute("data-scroll-locked"),
  }));
  expect(scrollState.body).not.toBe("hidden");
  expect(scrollState.html).not.toBe("hidden");
  expect(scrollState.locked).toBe(false);
});

test("An invalid backend payload is hidden and downgraded to safe contact mode", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages", async (route) => {
    await fulfillJson(route, {
      mode: "AI",
      answer: "functionCall search_products SELECT * FROM products",
      remainingTurns: 11,
      products: [{ slug: "unsafe", name: "Unsafe" }],
      actions: [{ type: "https://evil.example" }],
      contacts: CONTACTS,
    });
  });

  await page.goto("/", { waitUntil: "load" });
  await openBi(page);
  await sendMessage(page, "Tìm mũ bảo hiểm");

  await expect(page.locator("[data-bi-contact-view]")).toBeVisible();
  await expect(page.getByText(/functionCall|SELECT \* FROM|Unsafe|evil\.example/i)).toHaveCount(0);
});

test.describe("Bi mobile full-screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

  test("covers navigation, keeps the composer visible, and supports keyboard close", async ({ page }) => {
    await stubAvailability(page);
    await page.goto("/sp/", { waitUntil: "load" });
    const trigger = launcher(page);
    await expect(page.locator("#bb-floating-chat-trigger")).toHaveAttribute("data-bi-launcher-ready", "true");
    await trigger.focus();
    await trigger.press("Enter");

    const dialog = biDialog(page);
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box!.x)).toBe(0);
    expect(Math.round(box!.y)).toBe(0);
    expect(Math.round(box!.width)).toBe(390);
    expect(Math.round(box!.height)).toBe(844);

    const composerBox = await composer(page).boundingBox();
    expect(composerBox).not.toBeNull();
    expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(845);
    const inputFontSize = await messageInput(page).evaluate((element) => getComputedStyle(element).fontSize);
    expect(Number.parseFloat(inputFontSize)).toBeGreaterThanOrEqual(16);

    const nav = page.locator("nav.bb-bottom-nav").first();
    if (await nav.count()) {
      const layering = await page.evaluate(() => {
        const panel = document.querySelector("[data-bi-assistant]");
        const bottomNav = document.querySelector("nav.bb-bottom-nav");
        return {
          panel: panel ? Number.parseInt(getComputedStyle(panel).zIndex || "0", 10) : 0,
          nav: bottomNav ? Number.parseInt(getComputedStyle(bottomNav).zIndex || "0", 10) : 0,
        };
      });
      expect(layering.panel).toBeGreaterThan(layering.nav);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(launcher(page)).toBeFocused();
    await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked");
  });
});
