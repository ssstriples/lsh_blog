import { cloudinary } from "@/lib/cloudinary";

/** 게시글 에디터 이미지가 저장되는 Cloudinary 폴더 */
const UPLOAD_FOLDER = "lsh_blog/posts";

/**
 * multer가 메모리에 올려둔 파일 버퍼를 Cloudinary로 스트리밍 업로드한다.
 * (디스크에 임시 파일을 남기지 않기 위해 upload_stream 사용)
 */
export function uploadImageBuffer(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: UPLOAD_FOLDER, resource_type: "image" },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary 업로드 결과가 없습니다."));
          return;
        }
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}
