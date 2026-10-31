import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 reads the database URL here, not from the schema. Only the Prisma
// CLI uses this file (Joseph runs `prisma migrate deploy` on his Mac); the app
// connects at runtime through the Neon adapter with DATABASE_URL.
//
// Secrets live only in .env.local (CLAUDE.md §11), which Prisma doesn't load
// by itself. It's absent in CI and in the sandbox, where the dummy URL or no
// URL is fine: `prisma generate` never connects.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need a direct (unpooled) connection, per Neon's Prisma guide.
    // Read without `env()` so a missing value doesn't break `prisma generate`.
    url: process.env.DATABASE_URL_UNPOOLED,
  },
});
