import { Request, Response, NextFunction } from "express";
import { logger } from "@/lib/logger";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * 전역 에러 핸들러
 *
 * - 운영 환경에서는 스택 트레이스(내부 코드 구조)를 절대 클라이언트에 노출하지 않습니다.
 *   (스택 트레이스가 노출되면 공격자가 서버 내부 구조를 유추하는 단서가 될 수 있음)
 * - 에러는 winston 로거를 통해 서버 로그(파일/콘솔)에만 상세히 기록합니다.
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const isOperational = err instanceof AppError ? err.isOperational : false;

  logger.error(`[${req.method} ${req.originalUrl}] ${err.message}`, {
    stack: err.stack,
  });

  res.status(statusCode).json({
    success: false,
    message: isOperational ? err.message : "서버 내부 오류가 발생했습니다.",
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `요청하신 경로를 찾을 수 없습니다: ${req.originalUrl}`,
  });
}
