"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { loginCustomer } from "@/lib/api/client-api";
import { refreshAuth, useAuth } from "@/lib/auth/auth-store";
import { loginSchema, type LoginFormValues } from "@/lib/schemas/auth";
import { toAccountPath, toForgotPasswordPath, toRegisterPath } from "@/lib/utils/routes";
import { isSafeReturnTo } from "@/lib/utils/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tiep") ?? "";
  const returnTo = isSafeReturnTo(raw) ? raw : toAccountPath();

  const auth = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (auth.status === "authenticated") {
      router.replace(returnTo);
    }
  }, [auth.status, router, returnTo]);

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
    } catch (err: unknown) {
      setError("root", { message: (err as Error).message });
    }
  }

  if (auth.status === "authenticated") return null;

  return (
    <div className="bb-auth-wrap">
      <Card className="p-6 border-t-[3px] border-t-primary">
        <header className="bb-auth-header">
          <h1 className="bb-auth-title">Đăng nhập</h1>
        </header>

        {errors.root && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-none border border-destructive/30 bg-destructive/10 px-4 py-3 mb-5 text-sm text-destructive"
          >
            {errors.root.message}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="bb-form-stack" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-username">Email hoặc số điện thoại</Label>
            <Input
              id="login-username"
              autoComplete="username"
              placeholder="email@example.com hoặc 0901234567"
              aria-invalid={!!errors.login}
              aria-describedby={errors.login ? "login-username-error" : undefined}
              {...register("login")}
            />
            {errors.login && (
              <p id="login-username-error" role="alert" className="text-sm text-destructive">
                {errors.login.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="login-password">Mật khẩu</Label>
              <Link
                href={toForgotPasswordPath()}
                className="text-sm bb-link font-normal"
                tabIndex={0}
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pr-12"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "login-password-error" : undefined}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="login-password-error" role="alert" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
            {isSubmitting && (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            )}
            {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 mt-4 text-sm text-muted-foreground text-center">
          <p>
            Chưa có tài khoản?{" "}
            <Link href={toRegisterPath()} className="bb-link">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="bb-auth-wrap" aria-busy="true">
      <Card className="p-6 border-t-[3px] border-t-primary">
        <div className="bb-skel-stack">
          <span className="bb-skel bb-skel--title bb-skel-w-50" style={{ height: "1.8em" }} />
          <div className="h-2" />
          <span className="bb-skel bb-skel--text bb-skel-w-40" />
          <span className="bb-skel" style={{ height: 42, width: "100%", borderRadius: "var(--bb-radius-input)" }} />
          <span className="bb-skel bb-skel--text bb-skel-w-25" />
          <span className="bb-skel" style={{ height: 42, width: "100%", borderRadius: "var(--bb-radius-input)" }} />
          <span className="bb-skel bb-skel--btn w-full" />
          <span className="bb-skel bb-skel--text bb-skel-w-60" />
        </div>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <section className="bb-page bb-page--auth">
      <div className="bb-container">
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm />
        </Suspense>
      </div>
    </section>
  );
}
