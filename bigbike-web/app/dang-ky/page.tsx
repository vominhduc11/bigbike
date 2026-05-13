"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerCustomer } from "@/lib/api/client-api";
import { refreshAuth } from "@/lib/auth/auth-store";
import { registerSchema, type RegisterFormValues } from "@/lib/schemas/auth";
import { toAccountPath, toLoginPath } from "@/lib/utils/routes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [registered, setRegistered] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(values: RegisterFormValues) {
    try {
      await registerCustomer(
        values.email,
        values.password,
        values.firstName,
        values.lastName || undefined,
      );
      await refreshAuth();
      setConfirmedEmail(values.email);
      setRegistered(true);
    } catch (err: unknown) {
      setError("root", { message: (err as Error).message });
    }
  }

  if (registered) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <div className="bb-auth-wrap">
            <div className="bb-card bb-card-padded" style={{ textAlign: "center" }}>
              <div style={{ marginBottom: "var(--bb-space-4)", display: "flex", justifyContent: "center" }}>
                <svg
                  width="52"
                  height="52"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--bb-brand-primary)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h1 style={{ fontSize: "clamp(1.25rem, 3vw, 1.75rem)", marginBottom: "var(--bb-space-3)" }}>
                Tài khoản đã được tạo!
              </h1>
              {confirmedEmail && (
                <p className="bb-auth-footer" style={{ marginBottom: "var(--bb-space-5)" }}>
                  Chúng tôi đã gửi email xác nhận đến{" "}
                  <strong style={{ color: "var(--bb-text-primary)" }}>{confirmedEmail}</strong>.
                  Vui lòng kiểm tra hộp thư (kể cả thư mục spam) để xác nhận tài khoản.
                </p>
              )}
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => router.push(toAccountPath())}
              >
                Vào tài khoản
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bb-page">
      <div className="bb-container">
        <div className="bb-auth-wrap">
          <div className="bb-card bb-card-padded">
            <header className="bb-auth-header">
              <p className="bb-kicker">Tài khoản</p>
              <h1 className="bb-auth-title">Đăng ký</h1>
            </header>

            {errors.root && (
              <p className="bb-status-banner" style={{ marginBottom: "var(--bb-space-4)" }}>
                {errors.root.message}
              </p>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="bb-form-stack" noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-firstName">
                  Tên <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reg-firstName"
                  autoComplete="given-name"
                  placeholder="Văn A"
                  {...register("firstName")}
                />
                {errors.firstName && (
                  <p className="wp-field-error">{errors.firstName.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-lastName">Họ</Label>
                <Input
                  id="reg-lastName"
                  autoComplete="family-name"
                  placeholder="Nguyễn"
                  {...register("lastName")}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  placeholder="email@example.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="wp-field-error">{errors.email.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-password">
                  Mật khẩu <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Ít nhất 8 ký tự"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="wp-field-error">{errors.password.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-confirm">
                  Xác nhận mật khẩu <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                  {...register("confirm")}
                />
                {errors.confirm && (
                  <p className="wp-field-error">{errors.confirm.message}</p>
                )}
              </div>

              <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
              </Button>
            </form>

            <p className="bb-auth-footer">
              Đã có tài khoản?{" "}
              <Link href={toLoginPath()} className="bb-link">
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
