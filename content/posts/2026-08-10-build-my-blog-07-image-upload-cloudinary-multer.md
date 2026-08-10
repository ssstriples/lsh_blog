---
title: "기술 블로그를 직접 만들어보자 #7 — 에디터에 이미지 올리기, Cloudinary와 multer"
slug: "build-my-blog-07-image-upload-cloudinary-multer"
date: "2026-08-10"
category: "프로젝트 회고"
tags: ["백엔드", "Express", "파일업로드", "Cloudinary"]
status: "DRAFT"
summary: "TipTap 에디터에 이미지를 넣으려면 그 파일 자체를 서버가 받아서 어딘가에 저장해야 합니다. multer로 파일을 받고, Cloudinary에 업로드해서 URL만 돌려주는 방법을 다룹니다."
---

# 기술 블로그를 직접 만들어보자 #7 — 에디터에 이미지 올리기, Cloudinary와 multer

> [5편](./2026-08-10-build-my-blog-05-post-crud-ownership-authorization.md)에서
> 게시글 CRUD를 만들었는데, 지금까지는 본문이 전부 **텍스트(HTML)**였습니다.
> 이번 편에서는 에디터에서 이미지를 첨부할 수 있게, "이미지 파일을 서버에
> 올리고 URL을 돌려받는" 업로드 API를 만들어봅니다.

## 이 글에서 다루는 내용

1. 이미지 업로드는 왜 "텍스트 저장"과 다른가요?
2. multer로 파일 받기 — 디스크에 저장할까, 메모리에만 둘까?
3. Cloudinary로 스트리밍 업로드하기
4. 파일 크기/타입 제한하기
5. 에러 처리 — 서드파티 라이브러리 에러를 우리 방식대로 통일하기
6. (트러블슈팅) 시크릿이 든 `.env` 파일은 AI가 직접 못 건드리게 막아뒀던 이유

---

## 1. 이미지 업로드는 왜 다른가요?

지금까지 만든 API(회원가입, 로그인, 게시글 작성)는 전부 JSON 텍스트를
받아서 처리했습니다. 그런데 이미지 파일은 JSON으로 표현할 수 없는
**바이너리 데이터**입니다. 그래서 이미지를 올릴 때는 요청 형식 자체가
다릅니다 — `multipart/form-data`라는, 파일과 텍스트를 섞어서 보낼 수 있는
형식을 씁니다.

Express는 기본적으로 JSON 바디만 파싱할 수 있어서, `multipart/form-data`를
읽으려면 별도의 미들웨어가 필요합니다. 이 프로젝트에서는 Node.js 생태계에서
가장 널리 쓰이는 **multer**를 사용했습니다.

---

## 2. multer로 파일 받기 — 어디에 저장할까?

multer는 파일을 받은 뒤 어디에 둘지 두 가지 방식을 지원합니다.

| 방식 | 설명 |
|---|---|
| `diskStorage` | 서버 디스크에 임시 파일로 저장. 이후 그 경로를 읽어 처리 |
| `memoryStorage` | 파일 내용을 메모리 버퍼(`req.file.buffer`)로만 들고 있음 |

이 블로그의 이미지는 최종적으로 **Cloudinary**(이미지 전용 클라우드
스토리지 서비스)에 저장할 계획이라, 우리 서버 디스크에 파일을 남길 이유가
없습니다. 그래서 `memoryStorage`를 선택했습니다 — 받는 즉시 Cloudinary로
흘려보내고, 우리 서버에는 흔적을 남기지 않는 방식입니다.

```ts
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("이미지 파일만 업로드할 수 있습니다."));
    }
    cb(null, true);
  },
}).single("image"); // 폼 필드 이름이 "image"인 파일 하나만 받음
```

> `diskStorage`를 썼다면 "업로드 처리 후 임시 파일을 지우는" 코드도 따로
> 챙겨야 합니다. 지우는 걸 깜빡하면 서버 디스크가 조용히 차오르는 사고가
> 날 수 있습니다. `memoryStorage`는 처음부터 그런 정리 작업 자체가 필요
> 없다는 게 장점입니다.

---

## 3. Cloudinary로 스트리밍 업로드하기

메모리에 있는 파일 버퍼를 Cloudinary SDK의 `upload_stream`으로 그대로
흘려보내면, Cloudinary가 업로드를 끝낸 뒤 이미지 URL을 돌려줍니다.

```ts
import { cloudinary } from "@/lib/cloudinary";

function uploadImageBuffer(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "lsh_blog/posts", resource_type: "image" },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve(result.secure_url); // https://res.cloudinary.com/.../xxx.jpg
      },
    );
    stream.end(buffer);
  });
}
```

컨트롤러는 이 URL을 그대로 클라이언트에 돌려줍니다. 프론트엔드(TipTap
에디터)는 이 URL을 받아서 `<img src="...">`로 본문에 삽입하면 됩니다.

```ts
export async function uploadPostImage(req, res, next) {
  try {
    if (!req.file) throw new AppError("업로드할 이미지 파일이 없습니다.", 400);
    const url = await uploadImageBuffer(req.file.buffer);
    res.status(201).json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
}
```

---

## 4. 파일 크기/타입 제한하기

누구나(로그인만 하면) 올릴 수 있는 API이기 때문에, 아무 제한이 없으면
누군가 수백 MB짜리 파일이나 실행 파일을 이미지인 척 올릴 수도 있습니다.
그래서 두 가지를 제한했습니다.

- **크기**: 5MB 초과 시 거부
- **타입**: `jpeg`, `png`, `webp`, `gif`만 허용 (그 외는 전부 거부)

앞서 본 `multer({ limits, fileFilter })` 설정이 바로 이 역할을 합니다.

---

## 5. 에러 처리 — multer 에러를 우리 방식으로 통일하기

이 프로젝트는 모든 에러를 `AppError`라는 하나의 클래스로 통일해서, 전역
에러 핸들러가 "상태 코드 + 사용자에게 보여줄 메시지"를 일관되게 만들어주고
있습니다 (2편 참고). 그런데 multer가 자체적으로 던지는 `MulterError`(예:
"파일이 너무 큼")는 이 규칙을 모릅니다. 그대로 두면 우리 에러 핸들러가
알 수 없는 에러로 취급해서 "서버 내부 오류"(500)라는 뭉뚱그린 메시지를
내려줍니다 — 사실은 사용자가 파일을 줄이면 해결되는 문제인데도요.

그래서 multer를 감싸는 작은 래퍼를 만들어서, multer의 에러를 우리
`AppError`로 번역해줬습니다.

```ts
function uploadImageMiddleware(req, res, next) {
  multerUpload(req, res, (err) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("이미지 파일은 5MB 이하만 업로드할 수 있습니다.", 400));
    }
    return next(new AppError("파일 업로드 중 오류가 발생했습니다.", 400));
  });
}
```

이렇게 하면 프론트엔드는 다른 API와 똑같은 모양의 에러 응답(`{ success: false, message }`)을 그대로 받아서 처리할 수 있습니다.

---

## 6. (트러블슈팅) `.env` 파일은 왜 AI가 못 건드리게 막아뒀나요?

Cloudinary를 쓰려면 `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`이라는 세 가지 비밀 값이 필요합니다. 이 프로젝트는
AI 코딩 툴로 개발하고 있는데, 정작 이 값을 `.env` 파일에 채우는 작업은
AI가 아니라 **직접 손으로** 했습니다.

이유는 간단합니다 — AI 코딩 툴의 권한 설정에서 `.env`류 파일 자체를 읽고
쓰지 못하게 미리 막아뒀기 때문입니다. 코드나 설정 파일 구조는 AI가
자유롭게 만들고 고치게 해도 괜찮지만, 실제 비밀 키 값이 오가는 지점만큼은
사람이 직접 확인하고 넣는 게 안전하다고 판단해서입니다. 이렇게 해두면
"이 키 값을 누가, 언제, 어떻게 넣었는지"에 대한 책임 소재가 명확해집니다.

---

## 마무리

이번 편에서는 텍스트가 아닌 **파일**을 다루는 첫 API를 만들어봤습니다.
`multipart/form-data` 요청을 받아 multer로 파싱하고, 디스크에 남기지
않고 Cloudinary로 바로 스트리밍하는 방식, 그리고 서드파티 라이브러리의
에러를 우리 프로젝트의 에러 규칙에 맞게 번역하는 패턴을 다뤘습니다.

다음 편에서는 게시글에 **댓글을 달고, 본인 댓글만 삭제할 수 있는 기능**을
5편에서 만든 소유권 검증 패턴을 그대로 재사용해서 구현해보겠습니다.
