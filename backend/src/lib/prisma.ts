import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma Client 싱글턴
 *
 * 개발 중 nodemon이 파일을 저장할 때마다 서버를 재시작하는데,
 * 그때마다 새로운 PrismaClient 인스턴스를 만들면 DB 커넥션이 계속 누적되어
 * "너무 많은 연결(Too many connections)" 에러가 발생할 수 있습니다.
 * 그래서 global 객체에 인스턴스를 캐싱해서 재사용합니다.
 *
 * Prisma 7부터는 driver adapter(@prisma/adapter-pg)를 통해 PostgreSQL에 연결합니다.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
