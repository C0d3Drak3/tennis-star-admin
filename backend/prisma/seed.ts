import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/auth/password";

class SeedConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedConfigurationError";
  }
}

async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const connectionString = process.env.DATABASE_URL;

  if (!email) {
    throw new SeedConfigurationError(
      "INITIAL_ADMIN_EMAIL must be configured to run the seed.",
    );
  }
  if (!password || password.trim().length === 0) {
    throw new SeedConfigurationError(
      "INITIAL_ADMIN_PASSWORD must be configured to run the seed.",
    );
  }
  if (!connectionString) {
    throw new SeedConfigurationError(
      "DATABASE_URL must be configured to run the seed.",
    );
  }

  const passwordHash = await hashPassword(password);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash },
      update: {},
    });
    console.info("Initial administrator is ready.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof SeedConfigurationError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const errorType = error instanceof Error ? error.name : "Unknown error";
  console.error(`Initial administrator seed failed (${errorType}).`);
  process.exitCode = 1;
});
