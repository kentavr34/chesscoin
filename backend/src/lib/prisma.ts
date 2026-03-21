import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// U10: connection_limit через DATABASE_URL параметр (?connection_limit=10)
// Prisma по умолчанию использует num_cpus * 2 + 1 соединений
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
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
