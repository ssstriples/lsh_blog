/** 백엔드 Express API 서버의 Base URL */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";

export interface ApiErrorBody {
  success: false;
  message: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * 백엔드 API 공용 fetch 헬퍼.
 * - accessToken이 있으면 Authorization 헤더에 자동으로 실어 보낸다.
 * - 응답이 실패(success: false)면 ApiError를 throw한다 (호출부에서 try/catch로 처리).
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, headers, ...rest } = options;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    const message = (body as ApiErrorBody | null)?.message ?? "요청 처리 중 오류가 발생했습니다.";
    throw new ApiError(message, res.status);
  }

  return body.data as T;
}
