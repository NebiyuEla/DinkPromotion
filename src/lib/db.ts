import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function pooledDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    // Vercel can create many function instances. Keep each instance to a single
    // database connection so Supabase's small session pool is not exhausted.
    url.searchParams.set("connection_limit", "1");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "10");
    return url.toString();
  } catch {
    return raw;
  }
}

const databaseUrl = pooledDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
