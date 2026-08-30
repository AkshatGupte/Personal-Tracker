import { defineConfig } from "prisma/config";

// Node reads .env natively (process.loadEnvFile, Node 20.12+), so this file
// deliberately avoids a `dotenv` dependency. Next.js loads .env on its own for
// app code; this call only covers the Prisma CLI.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env present — fall back to whatever is already in the environment.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
