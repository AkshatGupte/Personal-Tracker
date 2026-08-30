import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma 7 talks to the database through a "driver adapter" — a small piece
// that knows how to speak to one specific database. Ours is SQLite, backed by
// a single file on disk.
const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
    }),
  });

// Next.js reloads modules on every edit in development. Without this, each
// reload would open a brand new database connection and eventually exhaust
// them, so we stash one client on the global object and reuse it.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
