import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Оптимизация: connection pool
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

// Graceful shutdown
process.on("beforeExit", async () => { await prisma.$disconnect(); });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
