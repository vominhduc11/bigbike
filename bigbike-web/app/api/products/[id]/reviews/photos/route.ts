import { NextResponse } from "next/server";
import { BACKEND, readBackendError, type ProductRouteParams } from "@/lib/api/backend-proxy";

export const dynamic = "force-dynamic";

// Max 8MB per photo — mirrors the backend cap so we reject oversize files before the upstream call.
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Uploads one customer review photo. Accepts multipart/form-data ("file"), forwards it to the
// backend which stores it in MinIO and returns the /media/reviews/... URL.
export async function POST(req: Request, { params }: ProductRouteParams) {
  const { id } = await params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Vui lòng chọn một ảnh." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Ảnh không được vượt quá 8MB." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Chỉ chấp nhận ảnh JPG, PNG hoặc WebP." }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.set("file", file, file.name || "photo");

  try {
    const res = await fetch(`${BACKEND}/api/v1/products/${id}/reviews/photos`, {
      method: "POST",
      cache: "no-store",
      headers: { Accept: "application/json" },
      body: upstream,
    });

    if (!res.ok) {
      const error = await readBackendError(res);
      return NextResponse.json(
        { error: error ?? "Không thể tải ảnh lên." },
        { status: res.status },
      );
    }

    const json = (await res.json()) as { data?: { url?: string } };
    const url = json.data?.url;
    if (!url) {
      return NextResponse.json({ error: "Không thể tải ảnh lên." }, { status: 502 });
    }
    return NextResponse.json({ url }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Lỗi kết nối, vui lòng thử lại." }, { status: 503 });
  }
}
