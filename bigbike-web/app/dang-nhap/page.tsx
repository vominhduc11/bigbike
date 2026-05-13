"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginCustomer } from "@/lib/api/client-api";
import { refreshAuth } from "@/lib/auth/auth-store";
import { loginSchema, type LoginFormValues } from "@/lib/schemas/auth";
import { toAccountPath, toForgotPasswordPath, toRegisterPath } from "@/lib/utils/routes";
import { isSafeReturnTo } from "@/lib/utils/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tiep") ?? "";
  const returnTo = isSafeReturnTo(raw) ? raw : toAccountPath();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      await loginCustomer(values.login, values.password);
      await refreshAuth();
      router.push(returnTo);
      router.refresh();
    } catch (err: unknown) {
      setError("root", { message: (err as Error).message });
    }
  }

  return (
    <div className="bb-auth-wrap">
      <div className="bb-card bb-card-padded">
        <header className="bb-auth-header">
          <p className="bb-kicker">Tài khoản</p>
          <h1 className="bb-auth-title">Đăng nhập</h1>
        </header>

        {errors.root && (
          <p className="bb-status-banner" style={{ marginBottom: "var(--bb-space-4)" }}>
            {errors.root.message}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="bb-form-stack" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-username">Email hoặc số điện thoại</Label>
            <Input
              id="login-username"
              autoComplete="username"
              placeholder="email@example.com"
              {...register("login")}
            />
            {errors.login && (
              <p className="wp-field-error">{errors.login.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-password">Mật khẩu</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
            />
            {errors.password && (
              <p className="wp-field-error">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>

        <p className="bb-auth-footer">
          <Link href={toForgotPasswordPath()} className="bb-link bb-auth-footer-link">
            Quên mật khẩu?
          </Link>
          <br />
          Chưa có tài khoản?{" "}
          <Link href={toRegisterPath()} className="bb-link">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="bb-auth-wrap" aria-busy="true">
      <div className="bb-card bb-card-padded" style={{ padding: 24 }}>
        <div className="bb-skel-stack">
          <span className="bb-skel bb-skel--text bb-skel-w-25" />
          <span className="bb-skel bb-skel--title bb-skel-w-50" style={{ height: "1.8em" }} />
          <div style={{ height: 8 }} />
          <span className="bb-skel bb-skel--text bb-skel-w-40" />
          <span className="bb-skel" style={{ height: 42, width: "100%", borderRadius: "var(--bb-radius-input)" }} />
          <span className="bb-skel bb-skel--text bb-skel-w-25" />
          <span className="bb-skel" style={{ height: 42, width: "100%", borderRadius: "var(--bb-radius-input)" }} />
          <span className="bb-skel bb-skel--btn" style={{ width: "100%" }} />
          <span className="bb-skel bb-skel--text bb-skel-w-60" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <section className="bb-page">
      <div className="bb-container">
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm />
        </Suspense>
      </div>
    </section>
  );
}
