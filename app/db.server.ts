import { PrismaClient } from "@prisma/client";

/**
 * Single PrismaClient instance, reused across hot reloads in development to
 * avoid exhausting database connections. Used only for Shopify session storage.
 */
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const prisma = global.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}

export default prisma;
