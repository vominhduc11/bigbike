"use client";

import { useRef, useState } from "react";
import { submitContactForm } from "@/lib/api/client-api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COOLDOWN_MS = 30_000;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ContactForm({ hotline, email }: { hotline: string; email: string }) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const lastSubmitAt = useRef<number>(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const now = Date.now();
    if (now - lastSubmitAt.current < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - lastSubmitAt.current)) / 1000);
      setError(`Vui lòng chờ ${remaining} giây trước khi gửi lại.`);
      return;
    }
    const fd = new FormData(e.currentTarget);

    const fullName = (fd.get("fullName") as string).trim();
    const phone = (fd.get("phone") as string).trim();
    const emailVal = (fd.get("email") as string).trim();
    const content = (fd.get("content") as string).trim();

    if (!fullName) { setError("Vui lòng nhập họ tên."); return; }
    if (!phone) { setError("Vui lòng nhập số điện thoại."); return; }
    if (!/^0[3-9]\d{8}$/.test(phone)) { setError("Số điện thoại không hợp lệ. Vui lòng nhập số VN 10 chữ số (ví dụ: 0901234567)."); return; }
    if (!content) { setError("Vui lòng nhập nội dung."); return; }

    setSaving(true);
    lastSubmitAt.current = Date.now();
    try {
      await submitContactForm({ fullName, phone, email: emailVal || undefined, content });
      setSuccess(true);
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gửi thất bại, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="p-5 bg-[rgba(119,136,102,0.08)] border border-[rgba(119,136,102,0.34)]">
        <p className="text-[#778866] font-semibold mb-2">Gửi tin nhắn thành công!</p>
        <p className="text-sm text-muted-foreground">
          Cảm ơn bạn đã liên hệ. Chúng tôi sẽ phản hồi sớm nhất có thể.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => setSuccess(false)}
        >
          Gửi tin nhắn khác
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Gửi tin nhắn</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-accent border border-brand-soft">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium font-body" htmlFor="contact-name">
                Họ tên <span className="text-destructive">*</span>
              </label>
              <Input
                id="contact-name"
                type="text"
                name="fullName"
                placeholder="Nguyễn Văn A"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium font-body" htmlFor="contact-phone">
                Số điện thoại <span className="text-destructive">*</span>
              </label>
              <Input
                id="contact-phone"
                type="tel"
                name="phone"
                placeholder="0901234567"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium font-body" htmlFor="contact-email">Email</label>
              <Input
                id="contact-email"
                type="email"
                name="email"
                placeholder="email@example.com"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium font-body" htmlFor="contact-content">
                Nội dung <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="contact-content"
                name="content"
                placeholder="Nhập nội dung cần hỗ trợ..."
                required
              />
            </div>
          </div>
          <Button type="submit" variant="primary" disabled={saving} className="self-start">
            {saving ? "Đang gửi..." : "Gửi tin nhắn"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
