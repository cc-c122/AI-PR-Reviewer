import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const migrationPath = path.resolve(
  currentDirectory,
  "../prisma/migrations/20260529000000_init/migration.sql",
);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL ?? "file:./dev.db",
    },
  },
});

try {
  const migrationSql = await readFile(migrationPath, "utf8");
  const statements = migrationSql
    .replaceAll("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ")
    .replaceAll("CREATE UNIQUE INDEX ", "CREATE UNIQUE INDEX IF NOT EXISTS ")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
} finally {
  await prisma.$disconnect();
}
