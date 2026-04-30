"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type Status = "idle" | "loading" | "success" | "error" | "missing";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "loading" : "missing");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("missing");
      return;
    }

    // POST token in body — keeps it out of server access logs and Referer headers.
    fetch(`${API_BASE_URL}/api/v1/customer/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            (payload as { error?: { message?: string } } | null)?.error?.message ??
            "Xác thực thất bại.";
          throw new Error(msg);
        }
        setStatus("success");
      })
      .catch((e: Error) => {
        setErrorMsg(e.message ?? "Đã xảy ra lỗi.");
        setStatus("error");
      });
  }, [token]);

  return (
    <section className="bb-page">
      <div className="bb-container" style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
        {status === "loading" && (
          <>
            <p style={{ fontSize: "2rem", marginBottom: 12 }}>⏳</p>
            <h1 style={{ marginBottom: 8 }}>Đang xác thực email…</h1>
            <p className="bb-text-muted">Vui lòng đợi trong giây lát.</p>
          </>
        )}

        {status === "success" && (
          <>
            <p style={{ fontSize: "2.5rem", marginBottom: 12 }}>✅</p>
            <h1 style={{ marginBottom: 8 }}>Email đã được xác thực!</h1>
            <p className="bb-text-muted" style={{ marginBottom: 24 }}>
              Tài khoản của bạn đã được kích hoạt đầy đủ.
            </p>
            <Link href="/tai-khoan" className="bb-btn bb-btn-primary">
              Vào tài khoản
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <p style={{ fontSize: "2.5rem", marginBottom: 12 }}>❌</p>
            <h1 style={{ marginBottom: 8 }}>Xác thực không thành công</h1>
            <p className="bb-text-muted" style={{ marginBottom: 24 }}>{errorMsg}</p>
            <p style={{ fontSize: "0.9rem" }}>
              Link có thể đã hết hạn hoặc đã được sử dụng.{" "}
              <Link href="/tai-khoan" style={{ color: "var(--bb-color-primary)" }}>
                Vào tài khoản
              </Link>{" "}
              để yêu cầu gửi lại email xác thực.
            </p>
          </>
        )}

        {status === "missing" && (
          <>
            <p style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔗</p>
            <h1 style={{ marginBottom: 8 }}>Liên kết không hợp lệ</h1>
            <p className="bb-text-muted" style={{ marginBottom: 24 }}>
              Không tìm thấy token xác thực trong URL.
            </p>
            <Link href="/" className="bb-btn bb-btn-secondary">
              Về trang chủ
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
