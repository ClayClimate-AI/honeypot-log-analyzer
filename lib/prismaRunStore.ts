import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "./generated/prisma/client";
import type { RunStore } from "./runStore";

// The real store: Neon Postgres through Prisma 7's Neon adapter (D18). Only
// the route loads this, and only for a live run. The app uses the pooled
// DATABASE_URL; migrations use DATABASE_URL_UNPOOLED (prisma.config.ts).
let client: InstanceType<typeof PrismaClient> | null = null;

function getClient(): InstanceType<typeof PrismaClient> {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    client = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
  }
  return client;
}

export const prismaRunStore: RunStore = {
  async saveRun(run) {
    await getClient().savedRun.create({ data: run });
  },
};
