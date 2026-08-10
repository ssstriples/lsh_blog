import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError } from "@/middlewares/errorHandler";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * 업로드 파일을 디스크에 남기지 않고 메모리 버퍼로만 받는다.
 * (Cloudinary로 바로 스트리밍하고 버리므로 서버에 파일이 쌓일 필요가 없음)
 */
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new AppError("이미지 파일(jpeg, png, webp, gif)만 업로드할 수 있습니다.", 400));
      return;
    }
    cb(null, true);
  },
}).single("image");

/** multer 에러(MulterError)를 전역 에러 핸들러가 처리할 수 있는 AppError로 변환한다. */
export function uploadImageMiddleware(req: Request, res: Response, next: NextFunction): void {
  multerUpload(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      next(new AppError("이미지 파일은 5MB 이하만 업로드할 수 있습니다.", 400));
      return;
    }

    next(err instanceof AppError ? err : new AppError("파일 업로드 중 오류가 발생했습니다.", 400));
  });
}
