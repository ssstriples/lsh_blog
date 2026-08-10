import crypto from "crypto";

/**
 * IP 주소를 그대로 저장하지 않고 해시화하여 저장한다 (개인정보 보호 + 조회수 중복 방지 용도).
 * 솔트(SALT)가 없어도 되는 이유: 조회수 어뷰징 방지 목적일 뿐, 암호학적 보안이 필요한 값이 아니다.
 */
export function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export function getClientIp(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return req.socket?.remoteAddress ?? "unknown";
}
