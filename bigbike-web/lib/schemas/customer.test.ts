import { describe, expect, it } from "vitest";
import { createAddressSchema, createChatLeadSchema, createOrderLookupSchema, createProfileSchema, createReviewSchema } from "./customer";

const t = (key: string) => key;

describe("customer form schemas", () => {
  it("accepts the server address contract and rejects an invalid phone", () => {
    const schema = createAddressSchema(t);
    expect(schema.safeParse({ type: "SHIPPING", fullName: "Nguyễn An", phone: "+84901234567", email: "", province: "Hồ Chí Minh", ward: "Phường 1", addressLine1: "1 Đường A", isDefault: false }).success).toBe(true);
    expect(schema.safeParse({ type: "SHIPPING", fullName: "Nguyễn An", phone: "12", email: "", province: "Hồ Chí Minh", ward: "Phường 1", addressLine1: "1 Đường A", isDefault: false }).success).toBe(false);
  });

  it("covers review, profile, chat lead and order lookup constraints", () => {
    expect(createReviewSchema(t, false).safeParse({ rating: 1.5, authorName: "An", authorEmail: "", comment: "", website: "" }).success).toBe(true);
    expect(createReviewSchema(t, false).safeParse({ rating: 1.2, authorName: "An", authorEmail: "", comment: "", website: "" }).success).toBe(false);
    expect(createProfileSchema(t, "a@example.test").safeParse({ displayName: "An", email: "b@example.test", currentPassword: "", newPassword: "", confirmPassword: "" }).success).toBe(false);
    expect(createChatLeadSchema(t).safeParse({ name: "An", phone: "+84 901 234 567", note: "", consented: true }).success).toBe(true);
    expect(createOrderLookupSchema(t).safeParse({ orderNumber: "", orderKey: "key" }).success).toBe(false);
  });
});
