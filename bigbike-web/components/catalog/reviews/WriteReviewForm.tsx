"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StarRatingInput } from "./stars";
import type { PhotoItem } from "./types";

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
  const isDialog = variant === "dialog";
  const [rating, setRating] = useState(0);
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploading = photos.some((p) => p.status === "uploading");

  async function uploadOne(file: File) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const previewUrl = URL.createObjectURL(file);
    setPhotos((prev) => [...prev, { id, previewUrl, status: "uploading" }]);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/products/${productId}/reviews/photos/`, {
        method: "POST",
        body: form,
      });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !json?.url) {
        setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, status: "error" } : p)));
        setPhotoError(json?.error ?? t("errorPhotoUpload"));
        return;
      }
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, status: "done", url: json.url } : p)));
    } catch {
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, status: "error" } : p)));
      setPhotoError(t("errorPhotoUpload"));
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError(t("errorPickStars"));
      return;
    }
    if (!authorName.trim()) {
      setError(t("errorPickName"));
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const photoUrls = photos
        .filter((p) => p.status === "done" && p.url)
        .map((p) => p.url as string);
      const res = await fetch(`/api/products/${productId}/reviews/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim(),
          rating,
          title: title.trim(),
          comment: comment.trim(),
          photos: photoUrls,
          website,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        if (res.status === 429) {
          setError(t("errorRateLimit"));
        } else if (res.status === 409) {
          setError(json?.error ?? t("errorDuplicate"));
        } else {
          setError(json?.error ?? t("errorSubmit"));
        }
        return;
      }
      setDone(true);
      onSuccess();
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn(isDialog ? "p-5" : "border border-border p-6")}>
      {!isDialog && (
        <h3 className="m-0 mb-5 font-body text-ui-20 max-md:text-ui-18 font-semibold uppercase tracking-wide text-[var(--bb-text-primary)]">
          {t("formTitle")}
        </h3>
      )}

      {done ? (
        <p className="m-0 border border-border bg-muted px-4 py-3 text-ui-14 max-md:text-ui-12 text-[var(--bb-text-primary)]">
          {t("thanks")}
        </p>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          {/* Honeypot — bots fill this, humans never see it. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            className="absolute -left-[9999px] h-0 w-0 opacity-0 [pointer-events:none]"
          />

          <div className="flex flex-col gap-1.5">
            <Label className="text-ui-14 max-md:text-ui-12 font-semibold text-[var(--bb-text-primary)]">
              {t("formStars")} <span className="text-brand">*</span>
            </Label>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="review-author"
              className="text-ui-14 max-md:text-ui-12 font-semibold text-[var(--bb-text-primary)]"
            >
              {t("formName")} <span className="text-brand">*</span>
            </Label>
            <Input
              id="review-author"
              name="author"
              type="text"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              placeholder={t("formNamePlaceholder")}
              maxLength={80}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="review-email"
              className="text-ui-14 max-md:text-ui-12 font-semibold text-[var(--bb-text-primary)]"
            >
              {t("formEmail")}
            </Label>
            <Input
              id="review-email"
              name="email"
              type="email"
              value={authorEmail}
              onChange={(event) => setAuthorEmail(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="review-title"
              className="text-ui-14 max-md:text-ui-12 font-semibold text-[var(--bb-text-primary)]"
            >
              {t("formTitleField")}
            </Label>
            <Input
              id="review-title"
              name="title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("formTitlePlaceholder")}
              maxLength={160}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="review-comment"
              className="text-ui-14 max-md:text-ui-12 font-semibold text-[var(--bb-text-primary)]"
            >
              {t("formComment")}
            </Label>
            <Textarea
              id="review-comment"
              name="comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t("formCommentPlaceholder")}
              maxLength={1000}
              rows={5}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-ui-14 max-md:text-ui-12 font-semibold text-[var(--bb-text-primary)]">
              {t("formPhotos")}
            </Label>
            <p className="m-0 text-ui-14 max-md:text-ui-12 text-muted-foreground">{t("formPhotosHint")}</p>

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
                      <span className="absolute inset-0 flex items-center justify-center bg-background/50 text-ui-14 max-md:text-ui-12 text-muted-foreground">
                        …
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      aria-label={t("removePhoto")}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center bg-[var(--bb-text-primary)] text-ui-11 leading-none text-white outline-none focus-visible:outline-2 focus-visible:outline-ring"
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
            {photoError && <p className="m-0 text-ui-14 max-md:text-ui-12 text-brand">{photoError}</p>}
          </div>

          {error && <p className="m-0 text-ui-14 max-md:text-ui-12 text-brand">{error}</p>}

          <Button type="submit" disabled={submitting || uploading} className="w-full">
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </form>
      )}
    </div>
  );
}
