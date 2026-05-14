"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Link2Off, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type Status = "idle" | "loading" | "success" | "error" | "missing";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "loading" : "missing");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) return;

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
      <div className="bb-container max-w-[480px] py-[var(--bb-space-15)] text-center">
        {status === "loading" && (
          <div className="grid justify-items-center gap-3 border border-border bg-card p-6">
            <LoaderCircle className="h-10 w-10 animate-spin text-brand" aria-hidden />
            <h1 className="m-0 font-heading text-2xl font-semibold uppercase">Đang xác thực email...</h1>
            <p className="bb-text-muted">Vui lòng đợi trong giây lát.</p>
          </div>
        )}

        {status === "success" && (
          <div className="grid justify-items-center gap-4 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-6">
            <CheckCircle2 className="h-11 w-11 text-[var(--bb-state-success-text)]" aria-hidden />
            <h1 className="m-0 font-heading text-2xl font-semibold uppercase">Email đã được xác thực!</h1>
            <p className="bb-text-muted m-0">
              Tài khoản của bạn đã được kích hoạt đầy đủ.
            </p>
            <Button asChild variant="primary">
              <Link href="/tai-khoan/">Vào tài khoản</Link>
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="grid justify-items-center gap-4 border border-[var(--bb-state-danger-border)] bg-[var(--bb-state-danger-bg)] p-6">
            <AlertTriangle className="h-11 w-11 text-destructive" aria-hidden />
            <h1 className="m-0 font-heading text-2xl font-semibold uppercase">Xác thực không thành công</h1>
            <p className="bb-text-muted m-0">{errorMsg}</p>
            <p className="m-0 text-sm text-muted-foreground">
              Link có thể đã hết hạn hoặc đã được sử dụng.{" "}
              <Link href="/tai-khoan/" className="bb-link">
                Vào tài khoản
              </Link>{" "}
              để yêu cầu gửi lại email xác thực.
            </p>
          </div>
        )}

        {status === "missing" && (
          <div className="grid justify-items-center gap-4 border border-border bg-card p-6">
            <Link2Off className="h-11 w-11 text-muted-foreground" aria-hidden />
            <h1 className="m-0 font-heading text-2xl font-semibold uppercase">Liên kết không hợp lệ</h1>
            <p className="bb-text-muted m-0">
              Không tìm thấy token xác thực trong URL.
            </p>
            <Button asChild variant="secondary">
              <Link href="/">Về trang chủ</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
