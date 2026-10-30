import { apiFetch } from "@/lib/api";

/** 백엔드 uploadMiddleware.ts와 같은 제한 — 서버가 최종 검증하지만, 업로드 전에 미리 걸러 UX를 개선한다. */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** POST /api/posts/upload-image — Cloudinary 업로드 후 이미지 URL을 반환한다. */
export async function uploadImage(file: File, accessToken: string | undefined): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("jpeg, png, webp, gif 이미지만 업로드할 수 있습니다.");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("이미지는 5MB 이하만 업로드할 수 있습니다.");
  }

  const formData = new FormData();
  formData.append("image", file); // 백엔드 multer `.single("image")` 필드명과 일치해야 한다

  const { url } = await apiFetch<{ url: string }>("/api/posts/upload-image", {
    method: "POST",
    body: formData,
    accessToken,
  });
  return url;
}
