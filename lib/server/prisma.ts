import { PrismaPg } from "@prisma/adapter-pg";
// Use runtime require for @prisma/client to avoid TypeScript type export mismatch
// during certain build environments where the package's type shape differs.
// Import the PrismaClient type-only for compile-time typing while using a runtime
// require for the actual constructor to avoid bundler/runtime issues.
import type { PrismaClient as PrismaClientType } from "@prisma/client";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient: PrismaClientRuntime } = require("@prisma/client");
type PrismaClient = PrismaClientType;
import { serverEnv } from "./env";

type GlobalPrismaState = typeof globalThis & {
  __airaPrismaAdapter?: PrismaPg;
  __airaPrisma?: PrismaClient;
};

const globalPrisma = globalThis as GlobalPrismaState;
const adapter =
  globalPrisma.__airaPrismaAdapter ||
  new PrismaPg({
    connectionString: serverEnv.DATABASE_URL,
  });

export const prisma: PrismaClient =
  globalPrisma.__airaPrisma ||
  (new PrismaClientRuntime({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }) as unknown as PrismaClient);

if (!globalPrisma.__airaPrismaAdapter) {
  globalPrisma.__airaPrismaAdapter = adapter;
}

if (!globalPrisma.__airaPrisma) {
  globalPrisma.__airaPrisma = prisma;
}
