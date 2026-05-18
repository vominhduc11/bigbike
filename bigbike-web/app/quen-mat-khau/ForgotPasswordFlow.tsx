"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestPasswordReset, resetCustomerPassword } from "@/lib/api/client-api";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordFormValues,
  type ResetPasswordFormValues,
} from "@/lib/schemas/auth";
import { toLoginPath } from "@/lib/utils/routes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type ForgotPasswordFlowProps = {
  token?: string | null;
};

function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="bb-auth-header">
      <h1 className="bb-auth-title">{title}</h1>
      {subtitle && <p className="bb-page-subtitle mx-auto">{subtitle}</p>}
    </header>
  );
}

function RequiredMark() {
  return <span className="text-destructive">*</span>;
}

function RootError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-none border border-destructive/30 bg-destructive/10 px-4 py-3 mb-5 text-sm text-destructive"
    >
      {message}
    </div>
  );
}

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

  if (success) {
    return (
      <>
        <AuthHeader title="QUÊN MẬT KHẨU" />
        <div className="text-center">
          <Image
            src="/auth/forgot-password-sent.png"
            alt="Đã gửi email khôi phục mật khẩu"
            width={224}
            height={200}
            className="mx-auto"
          />
          <p className="bb-page-subtitle mx-auto mt-6">
            Chúng tôi vừa gửi email khôi phục mật khẩu đến hộp thư quý khách cung cấp.
            Vui lòng kiểm tra email và đặt lại mật khẩu.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeader
        title="QUÊN MẬT KHẨU"
        subtitle="Vui lòng nhập địa chỉ email để khôi phục mật khẩu của bạn."
      />
      <RootError message={errors.root?.message} />
      <form onSubmit={handleSubmit(onSubmit)} className="bb-form-stack" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="forgot-login">
            Email <RequiredMark />
          </Label>
          <Input
            id="forgot-login"
            autoComplete="username"
            placeholder="Email đăng nhập..."
            aria-invalid={!!errors.login}
            aria-describedby={errors.login ? "forgot-login-error" : undefined}
            {...register("login")}
          />
          {errors.login && (
            <p id="forgot-login-error" role="alert" className="text-sm text-destructive">
              {errors.login.message}
            </p>
          )}
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Đang gửi..." : "Khôi phục mật khẩu"}
        </Button>
      </form>
    </>
  );
}

function ResetPasswordForm({ token }: { token: string }) {
  const [success, setSuccess] = useState(false);

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

  if (success) {
    return (
      <div className="text-center">
        <Image
          src="/auth/reset-success.png"
          alt="Đặt lại mật khẩu thành công"
          width={200}
          height={220}
          className="mx-auto"
        />
        <h2 className="bb-auth-title mt-6">Đặt lại mật khẩu thành công</h2>
        <p className="bb-page-subtitle mx-auto mt-3">
          Đăng nhập tài khoản Bigbike với mật khẩu mới.
        </p>
        <Button asChild variant="primary" className="w-full mt-8">
          <Link href={toLoginPath()}>Đăng nhập ngay</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <AuthHeader
        title="QUÊN MẬT KHẨU"
        subtitle="Vui lòng nhập mật khẩu mới cho tài khoản Bigbike."
      />
      <RootError message={errors.root?.message} />
      <form onSubmit={handleSubmit(onSubmit)} className="bb-form-stack" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-password">
            Nhập mật khẩu mới <RequiredMark />
          </Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder="Vui lòng nhập mật khẩu mới..."
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "reset-password-error" : undefined}
            {...register("password")}
          />
          {errors.password && (
            <p id="reset-password-error" role="alert" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-confirm">
            Xác nhận mật khẩu mới <RequiredMark />
          </Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Vui lòng xác nhận mật khẩu mới..."
            aria-invalid={!!errors.confirm}
            aria-describedby={errors.confirm ? "reset-confirm-error" : undefined}
            {...register("confirm")}
          />
          {errors.confirm && (
            <p id="reset-confirm-error" role="alert" className="text-sm text-destructive">
              {errors.confirm.message}
            </p>
          )}
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Đang cập nhật..." : "Xác nhận"}
        </Button>
      </form>
    </>
  );
}

export default function ForgotPasswordFlow({ token }: ForgotPasswordFlowProps) {
  return (
    <div className="bb-auth-wrap">
      {token ? <ResetPasswordForm token={token} /> : <RequestResetForm />}
    </div>
  );
}
