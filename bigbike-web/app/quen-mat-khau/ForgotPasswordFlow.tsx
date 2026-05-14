"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestPasswordReset, resetCustomerPassword } from "@/lib/api/client-api";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordFormValues,
  type ResetPasswordFormValues,
} from "@/lib/schemas/auth";
import { toLoginPath, toRegisterPath } from "@/lib/utils/routes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

type ForgotPasswordFlowProps = {
  token?: string | null;
};

function RequestResetForm() {
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    try {
      await requestPasswordReset(values.login.trim());
      reset();
      setSuccess(true);
    } catch (err: unknown) {
      setError("root", { message: (err as Error).message });
    }
  }

  return (
    <>
      {errors.root && (
        <div className="rounded-none border border-destructive/30 bg-destructive/10 px-4 py-3 mb-5 text-sm text-destructive">
          {errors.root.message}
        </div>
      )}

      {success ? (
        <Card className="p-5 mb-5">
          <p>Nếu tài khoản tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu.</p>
        </Card>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="bb-form-stack" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="forgot-login">Email hoặc số điện thoại</Label>
            <Input
              id="forgot-login"
              autoComplete="username"
              placeholder="email@example.com"
              {...register("login")}
            />
            {errors.login && <p className="text-sm text-destructive">{errors.login.message}</p>}
          </div>
          <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Đang gửi..." : "Gửi liên kết đặt lại"}
          </Button>
        </form>
      )}
    </>
  );
}

function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) return undefined;
    const redirectTimer = setTimeout(() => router.replace(toLoginPath()), 1500);

    return () => {
      clearTimeout(redirectTimer);
    };
  }, [router, success]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    try {
      await resetCustomerPassword(token, values.password);
      setSuccess(true);
    } catch (err: unknown) {
      setError("root", { message: (err as Error).message });
    }
  }

  return (
    <>
      {errors.root && (
        <div className="rounded-none border border-destructive/30 bg-destructive/10 px-4 py-3 mb-5 text-sm text-destructive">
          {errors.root.message}
        </div>
      )}

      {success ? (
        <Card className="p-5 mb-5">
          <p>Mật khẩu đã được thay đổi. Đang chuyển sang trang đăng nhập...</p>
          <Link href={toLoginPath()} className="bb-link bb-auth-footer-link mt-3">
            Đi đến trang đăng nhập
          </Link>
        </Card>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="bb-form-stack" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-password">Mật khẩu mới</Label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              placeholder="Nhập mật khẩu mới"
              {...register("password")}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-confirm">Xác nhận mật khẩu</Label>
            <Input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              {...register("confirm")}
            />
            {errors.confirm && <p className="text-sm text-destructive">{errors.confirm.message}</p>}
          </div>
          <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
          </Button>
        </form>
      )}
    </>
  );
}

export default function ForgotPasswordFlow({ token }: ForgotPasswordFlowProps) {
  const hasToken = Boolean(token);

  return (
    <div className="bb-auth-wrap">
      <Card className="p-6">
        <header className="bb-auth-header">
          <p className="bb-kicker">Tài khoản</p>
          <h1 className="bb-auth-title">
            {hasToken ? "Đặt lại mật khẩu" : "Quên mật khẩu"}
          </h1>
          <p className="bb-page-subtitle mx-auto">
            {hasToken
              ? "Nhập mật khẩu mới để hoàn tất."
              : "Nhập email hoặc số điện thoại để nhận liên kết đặt lại mật khẩu."}
          </p>
        </header>

        {hasToken && token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <RequestResetForm />
        )}

        <div className="bb-auth-footer mt-5">
          <Link href={toLoginPath()} className="bb-link">Quay lại đăng nhập</Link>
          {" "}
          <span aria-hidden="true">·</span>
          {" "}
          <Link href={toRegisterPath()} className="bb-link">Tạo tài khoản mới</Link>
        </div>
      </Card>
    </div>
  );
}
