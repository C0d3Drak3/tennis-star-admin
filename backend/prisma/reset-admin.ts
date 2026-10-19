import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/auth/password";

class ResetAdminConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResetAdminConfigurationError";
  }
}

async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const connectionString = process.env.DATABASE_URL;

  if (!email) {
    throw new ResetAdminConfigurationError(
      "INITIAL_ADMIN_EMAIL must be configured to reset the administrator password.",
    );
  }
  if (!password || password.trim().length === 0) {
    throw new ResetAdminConfigurationError(
      "INITIAL_ADMIN_PASSWORD must be configured to reset the administrator password.",
    );
  }
  if (!connectionString) {
    throw new ResetAdminConfigurationError(
      "DATABASE_URL must be configured to reset the administrator password.",
    );
  }

  const passwordHash = await hashPassword(password);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const result = await prisma.user.updateMany({
      where: { email },
      data: { passwordHash },
    });

    if (result.count !== 1) {
      throw new Error(
        result.count === 0
          ? "No administrator exists for INITIAL_ADMIN_EMAIL."
          : "More than one user matched INITIAL_ADMIN_EMAIL.",
      );
    }

    console.info("Administrator password reset successfully.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof ResetAdminConfigurationError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const errorType = error instanceof Error ? error.name : "Unknown error";
  const message =
    error instanceof Error &&
    (error.message === "No administrator exists for INITIAL_ADMIN_EMAIL." ||
      error.message ===
        "More than one user matched INITIAL_ADMIN_EMAIL.")
      ? ` ${error.message}`
      : "";
  console.error(`Administrator password reset failed (${errorType}).${message}`);
  process.exitCode = 1;
});
