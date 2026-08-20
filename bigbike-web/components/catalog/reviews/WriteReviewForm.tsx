"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth/auth-store";
import {
  ReviewRequestError,
  submitProductReview,
  uploadReviewPhoto,
} from "./api";
import { StarRatingInput } from "./stars";
import type { PhotoItem } from "./types";
import { createReviewSchema, type ReviewFormValues } from "@/lib/schemas/customer";

// Customer review photos: max 10, ≤8MB each, images only — must mirror the backend caps.
const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function WriteReviewForm({
  productId,
  onSuccess,
  variant = "card",
}: {
  productId: string;
  onSuccess: () => void;
  // "card" = khung viền + tiêu đề riêng (cũ, dùng inline). "dialog" = bỏ khung +
  // tiêu đề vì DialogTitle của modal đã là tiêu đề. Hiện chỉ modal dùng form này.
  variant?: "card" | "dialog";
}) {
  const t = useTranslations("Product.reviews");
  const tValidation = useTranslations("FormValidation");
  const isDialog = variant === "dialog";
  // Đã đăng nhập: lấy tên + email thẳng từ tài khoản, ẩn 2 ô nhập. Tên hiển thị khi đó
  // luôn khớp với ảnh đại diện resolve theo phiên đăng nhập (REVIEW_RULE_006) — nếu để
  // khách tự gõ, đánh giá có thể hiện tên này kèm ảnh của người khác.
  const auth = useAuth();
  const signedInProfile = auth.status === "authenticated" ? auth.profile : null;
  const signedInName = signedInProfile
    ? signedInProfile.displayName?.trim() || signedInProfile.email?.split("@")[0] || ""
    : "";
  const [rating, setRating] = useState(0);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reviewValidation = (key: string) => key === "ratingInvalid"
    ? t("errorPickStars")
    : key === "required" ? t("errorPickName") : tValidation(key);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<ReviewFormValues>({
    resolver: zodResolver(createReviewSchema(reviewValidation, Boolean(signedInProfile))),
    defaultValues: { rating: 0, authorName: "", authorEmail: "", comment: "", website: "" },
  });

  const uploading = photos.some((p) => p.status === "uploading");

  async function uploadOne(file: File) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const previewUrl = URL.createObjectURL(file);
    setPhotos((prev) => [...prev, { id, previewUrl, status: "uploading" }]);
    try {
      const url = await uploadReviewPhoto(productId, file);
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, status: "done", url } : p)));
    } catch (uploadError) {
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, status: "error" } : p)));
      setPhotoError(
        uploadError instanceof ReviewRequestError && uploadError.message
          ? uploadError.message
          : t("errorPhotoUpload"),
      );
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setPhotoError("");
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setPhotoError(t("errorPhotoCount", { count: MAX_PHOTOS }));
      return;
    }
    const picked = Array.from(fileList);
    if (picked.length > remaining) {
      setPhotoError(t("errorPhotoCount", { count: MAX_PHOTOS }));
    }
    for (const file of picked.slice(0, remaining)) {
      if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
        setPhotoError(t("errorPhotoType"));
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoError(t("errorPhotoSize"));
        continue;
      }
      void uploadOne(file);
    }
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function submit(values: ReviewFormValues) {
    const effectiveName = signedInProfile ? signedInName : values.authorName;
    const effectiveEmail = signedInProfile ? signedInProfile.email?.trim() : values.authorEmail;
    setError("");
    try {
      const photoUrls = photos
        .filter((p) => p.status === "done" && p.url)
        .map((p) => p.url as string);
      await submitProductReview(productId, {
          authorName: effectiveName,
          authorEmail: effectiveEmail || undefined,
          rating: values.rating,
          comment: values.comment,
          photos: photoUrls,
          website: values.website,
      });
      setDone(true);
      onSuccess();
    } catch (submitError) {
      if (submitError instanceof ReviewRequestError) {
        if (submitError.status === 429) {
          setError(t("errorRateLimit"));
        } else if (submitError.status === 409) {
          setError(t("errorDuplicate"));
        } else {
          setError(t("errorSubmit"));
        }
      } else {
        setError(t("errorNetwork"));
      }
    } finally { /* react-hook-form owns submitting state */ }
  }

  return (
    <div className={cn(isDialog ? "px-5 pb-5 pt-4" : "border border-border p-6")}>
      {!isDialog && (
        <h3 className="m-0 mb-5 font-body text-a3-section font-semibold text-[var(--bb-text-primary)]">
          {t("formTitle")}
        </h3>
      )}

      {done ? (
        <p className="m-0 border border-border bg-muted px-4 py-3 text-a5-meta text-[var(--bb-text-primary)]">
          {t("thanks")}
        </p>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)} noValidate>
          {/* Honeypot — bots fill this, humans never see it. */}
          <input
            type="text"
            {...register("website")}
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            className="absolute -left-[9999px] h-0 w-0 opacity-0 [pointer-events:none]"
          />

          <div className="flex flex-col gap-1.5">
            <Label className="text-a5-meta font-semibold text-[var(--bb-text-primary)]">
              {t("formStars")} <span className="text-brand">*</span>
            </Label>
            <StarRatingInput value={rating} onChange={(next) => { setRating(next); setValue("rating", next, { shouldValidate: true }); }} />
            {errors.rating && <p className="m-0 text-a5-meta text-brand">{errors.rating.message}</p>}
          </div>

          {signedInProfile ? (
            <div className="flex items-center gap-3 border border-border bg-muted px-4 py-3">
              <Avatar
                url={signedInProfile.avatarUrl}
                name={signedInName}
                size="sm"
                variant="brand"
              />
              <div className="min-w-0">
                <p className="m-0 text-a5-meta text-muted-foreground">{t("formSignedInAs")}</p>
                <p className="m-0 truncate text-a4-content font-semibold text-[var(--bb-text-primary)]">
                  {signedInName}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="review-author"
                  className="text-a5-meta font-semibold text-[var(--bb-text-primary)]"
                >
                  {t("formName")} <span className="text-brand">*</span>
                </Label>
                <Input
                  id="review-author"
                  type="text"
                  {...register("authorName")}
                  placeholder={t("formNamePlaceholder")}
                  maxLength={80}
                />
                {errors.authorName && <p className="m-0 text-a5-meta text-brand">{errors.authorName.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="review-email"
                  className="text-a5-meta font-semibold text-[var(--bb-text-primary)]"
                >
                  {t("formEmail")}
                </Label>
                <Input
                  id="review-email"
                  type="email"
                  {...register("authorEmail")}
                />
                {errors.authorEmail && <p className="m-0 text-a5-meta text-brand">{errors.authorEmail.message}</p>}
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="review-comment"
              className="text-a5-meta font-semibold text-[var(--bb-text-primary)]"
            >
              {t("formComment")}
            </Label>
            <Textarea
              id="review-comment"
              {...register("comment")}
              placeholder={t("formCommentPlaceholder")}
              maxLength={1000}
              rows={5}
            />
            {errors.comment && <p className="m-0 text-a5-meta text-brand">{errors.comment.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-a5-meta font-semibold text-[var(--bb-text-primary)]">
              {t("formPhotos")}
            </Label>
            <p className="m-0 text-a5-meta text-muted-foreground">{t("formPhotosHint")}</p>

            {photos.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-2 p-0 m-0 list-none">
                {photos.map((photo) => (
                  <li key={photo.id} className="relative h-16 w-16">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url ?? photo.previewUrl}
                      alt=""
                      className={cn(
                        "h-full w-full border border-border object-cover",
                        photo.status !== "done" && "opacity-50",
                      )}
                    />
                    {photo.status === "uploading" && (
                      <span className="absolute inset-0 flex items-center justify-center bg-background/50 text-a5-meta text-muted-foreground">
                        …
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      aria-label={t("removePhoto")}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center bg-[var(--bb-text-primary)] font-cta text-b5-label uppercase leading-none text-white outline-none focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(event) => {
                handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
            {photos.length < MAX_PHOTOS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 w-fit"
                onClick={() => fileInputRef.current?.click()}
              >
                {t("addPhoto")}
              </Button>
            )}
            {photoError && <p className="m-0 text-a5-meta text-brand">{photoError}</p>}
          </div>

          {error && <p className="m-0 text-a5-meta text-brand">{error}</p>}

          <Button type="submit" disabled={isSubmitting || uploading} className="w-full">
            {isSubmitting ? t("submitting") : t("submit")}
          </Button>
        </form>
      )}
    </div>
  );
}
