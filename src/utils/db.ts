import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  FRONTEND_URL?: string;
}

let cachedPrisma: PrismaClient | undefined;

export function getPrisma(env: Env): PrismaClient {
  if (!cachedPrisma) {
    const adapter = new PrismaD1(env.DB);
    cachedPrisma = new PrismaClient({ adapter });
  }
  return cachedPrisma;
}
