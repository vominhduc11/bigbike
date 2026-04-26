"use client";

import { useState } from "react";
import { submitContactForm } from "@/lib/api/client-api";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ContactForm({ hotline, email }: { hotline: string; email: string }) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
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
      <div className="wp-alert-success" style={{ borderRadius: "var(--bb-radius-lg)", padding: "var(--bb-space-5)" }}>
        <p style={{ color: "var(--bb-state-success)", fontWeight: 600, marginBottom: 8 }}>Gửi tin nhắn thành công!</p>
        <p style={{ color: "var(--bb-text-secondary)", fontSize: "var(--bb-text-sm)" }}>
          Cảm ơn bạn đã liên hệ. Chúng tôi sẽ phản hồi sớm nhất có thể.
        </p>
        <button
          type="button"
          className="bb-button bb-button-secondary"
          style={{ marginTop: "var(--bb-space-4)" }}
          onClick={() => setSuccess(false)}
        >
          Gửi tin nhắn khác
        </button>
      </div>
    );
  }

  return (
    <div className="bb-card" style={{ padding: "var(--bb-space-5)" }}>
      <h2 style={{ marginBottom: "var(--bb-space-4)", fontSize: "var(--bb-text-lg)" }}>Gửi tin nhắn</h2>

      {error && (
        <div style={{ padding: "10px 14px", background: "var(--bb-brand-primary-soft)", border: "1px solid var(--bb-brand-primary-border)", borderRadius: 6, marginBottom: "var(--bb-space-4)" }}>
          <p style={{ fontSize: "var(--bb-text-sm)", color: "rgba(255,255,255,0.85)", margin: 0 }}>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bb-form-grid">
          <label className="bb-form-label">
            Họ tên *
            <input className="bb-input" type="text" name="fullName" placeholder="Nguyen Van A" required />
          </label>
          <label className="bb-form-label">
            Số điện thoại *
            <input className="bb-input" type="tel" name="phone" placeholder="0901234567" required />
          </label>
          <label className="bb-form-label">
            Email
            <input className="bb-input" type="email" name="email" placeholder="email@example.com" />
          </label>
          <label className="bb-form-label" style={{ gridColumn: "1 / -1" }}>
            Nội dung *
            <textarea
              className="bb-input"
              name="content"
              style={{ minHeight: "120px", resize: "vertical" }}
              placeholder="Nhập nội dung cần hỗ trợ..."
              required
            />
          </label>
        </div>
        <button
          type="submit"
          className="bb-button bb-button-primary"
          style={{ marginTop: "var(--bb-space-4)" }}
          disabled={saving}
        >
          {saving ? "Đang gửi..." : "Gửi tin nhắn"}
        </button>
      </form>
    </div>
  );
}
