# Phase 3-2: 에디터 이미지 업로드 (T051~T052)

> 관련 태스크: `T051`, `T052`
> 작업일: 2026-08-10
> 결과물 위치: `backend/src/lib/cloudinary.ts`, `backend/src/services/uploadService.ts`,
> `backend/src/middlewares/uploadMiddleware.ts`, `backend/src/controllers/postController.ts`,
> `backend/src/routes/postRoutes.ts`, `backend/src/lib/validateEnv.ts`

## 1. 목표

TipTap 에디터에서 이미지를 삽입하면, 그 이미지 파일 자체를 서버에 올려서
Cloudinary에 저장하고, 에디터 본문에는 Cloudinary가 돌려준 URL만 들어가게
만든다. 이 기능은 **로그인한 유저라면 누구나** 쓸 수 있어야 한다 (Phase 3-1의
게시글 CRUD와 동일하게, 관리자 전용이 아니다).

---

## 2. 설치한 패키지

```bash
pnpm add cloudinary multer
pnpm add -D @types/multer
```

| 패키지 | 역할 |
|---|---|
| `cloudinary` | Cloudinary 공식 Node SDK — 이미지 업로드/URL 발급 |
| `multer` | `multipart/form-data` 요청에서 파일을 파싱하는 Express 미들웨어 |
| `@types/multer` | multer의 TypeScript 타입 정의 |

---

## 3. 핵심 설계: 디스크에 파일을 남기지 않는다

파일 업로드 미들웨어를 짤 때 가장 먼저 결정해야 하는 것은 "받은 파일을 어디에
두느냐"다. multer는 두 가지 저장 방식을 지원한다.

- `diskStorage`: 서버 디스크에 임시 파일로 저장 후, 그 경로를 읽어서 처리
- `memoryStorage`: 파일을 메모리 버퍼(`req.file.buffer`)로만 들고 있음

이 프로젝트는 받은 이미지를 그대로 Cloudinary로 전달하고 나면 로컬에 보관할
이유가 전혀 없으므로 `memoryStorage`를 선택했다. 디스크에 임시 파일이 안
남으니 "업로드 후 임시 파일 정리" 로직 자체가 필요 없어진다.

```ts
// backend/src/middlewares/uploadMiddleware.ts
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new AppError("이미지 파일(jpeg, png, webp, gif)만 업로드할 수 있습니다.", 400));
      return;
    }
    cb(null, true);
  },
}).single("image");
```

버퍼는 이후 `cloudinary.uploader.upload_stream`으로 그대로 흘려보낸다.

```ts
// backend/src/services/uploadService.ts
export function uploadImageBuffer(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "lsh_blog/posts", resource_type: "image" },
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
```

---

## 4. T052 — multer 에러를 기존 에러 핸들러 체계에 편입시키기

이 프로젝트는 이미 `AppError` + 전역 `errorHandler`로 모든 에러 응답 형식을
통일해두고 있다 (Phase 0-3). 그런데 multer가 파일 크기 초과 등으로 던지는
`MulterError`는 `AppError`가 아니라서, 그대로 두면 `errorHandler`가
"서버 내부 오류가 발생했습니다"(500)라는 뭉뚱그린 메시지로 처리해버린다.
실제로는 "파일이 너무 크다"는, 클라이언트가 고칠 수 있는 400 에러인데 말이다.

그래서 multer를 직접 라우트에 물리지 않고, `MulterError`를 가로채 `AppError`로
변환해주는 래퍼 미들웨어를 만들었다.

```ts
// backend/src/middlewares/uploadMiddleware.ts
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
```

`fileFilter`에서 던진 `AppError`(허용되지 않는 파일 타입)는 multer를 거치면서
래핑되지 않고 그대로 콜백에 전달되므로, `err instanceof AppError` 분기로
그대로 통과시킨다.

---

## 5. T051 — 라우트 및 컨트롤러

```ts
// backend/src/routes/postRoutes.ts
router.post("/upload-image", requireAuth, uploadImageMiddleware, uploadPostImage);
```

```ts
// backend/src/controllers/postController.ts
export async function uploadPostImage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new AppError("업로드할 이미지 파일이 없습니다.", 400);
    }
    const url = await uploadImageBuffer(req.file.buffer);
    res.status(201).json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
}
```

`GET /:slug`와 경로가 겹칠까 걱정할 필요는 없다 — `upload-image`는 `POST`
메서드라 `GET /:slug`(공개 상세 조회)와 라우팅이 충돌하지 않는다. 다만
`create`(`POST /`)와 같은 그룹에 있으므로, 코드 가독성을 위해 바로 아래에
배치했다.

---

## 6. Cloudinary 자격 증명 — 필수 환경변수로 등록

기존 `validateEnv.ts`는 서버 시작 시 5개 환경변수(`PORT`, JWT 시크릿 2종,
`CORS_ORIGIN`, `DATABASE_URL`)가 모두 있는지 검사해서, 하나라도 없으면
서버를 아예 띄우지 않는다 (T020-S3). Cloudinary 자격 증명도 없으면 업로드
기능이 조용히 실패하는 대신, 배포 시점에 바로 알 수 있도록 같은 목록에
추가했다.

```ts
const REQUIRED_ENV_VARS = [
  "PORT",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "CORS_ORIGIN",
  "DATABASE_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;
```

## 트러블슈팅: `.env` 파일에 직접 손을 댈 수 없었다

이번 작업에서는 AI 코딩 툴(Claude Code)의 권한 설정상 `.env`류 파일을
읽거나 쓰는 것 자체가 차단되어 있었다 — 시크릿이 담긴 파일을 AI가 직접
만지지 못하게 막아둔 것이다. 그래서 `backend/.env`와 `backend/.env.example`에
아래 3개 항목을 추가하는 것은 실제 사람이 직접 처리했다.

```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

> 이 프로젝트에서는 시크릿이 든 파일은 AI가 아니라 항상 사람이 값을 채운다는
> 원칙을 유지한다 — 코드/설정 스캐폴딩은 자동화하되, 실제 키 값이 오가는
> 지점은 사람이 최종 확인한다.

---

## 7. 남은 검증 항목

Cloudinary 자격 증명이 채워지기 전까지는 `pnpm dev` 실행 시 `validateEnv()`가
서버 기동을 막는다. 자격 증명이 채워진 뒤 다음을 확인해야 한다.

- [ ] `POST /api/posts/upload-image`에 정상 이미지(jpeg/png/webp/gif) 업로드 → 201 + Cloudinary URL 반환
- [ ] 5MB 초과 파일 업로드 → 400 "이미지 파일은 5MB 이하만 업로드할 수 있습니다."
- [ ] 허용되지 않는 타입(예: `.pdf`, `.svg`) 업로드 → 400 "이미지 파일(jpeg, png, webp, gif)만 업로드할 수 있습니다."
- [ ] 로그인 없이 요청 → 401

---

## 8. 배운 점

- 파일 업로드는 "받은 파일을 어디에 얼마나 오래 둘 것인가"부터 먼저 정하는
  게 순서다. 이 프로젝트처럼 받은 즉시 외부 스토리지(Cloudinary)로 넘기고
  버릴 데이터라면, 굳이 디스크에 썼다가 지우는 단계를 넣지 않고
  `memoryStorage` + 스트리밍 업로드로 끝내는 게 더 단순하고 안전하다
  (임시 파일 정리 실패로 디스크가 차는 사고를 원천 차단).
- 서드파티 미들웨어(multer)가 던지는 에러는 프로젝트 고유의 에러 클래스로
  한 번 감싸줘야, 기존 에러 핸들러/응답 형식과 일관성을 유지할 수 있다.
- 시크릿이 들어가는 `.env` 파일은 AI 툴의 쓰기 권한에서 배제해두는 편이,
  "어떤 값이 어떻게 채워졌는지"에 대한 책임 소재를 명확히 가져간다.
