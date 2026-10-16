import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { loadEnvConfig } from "@next/env";

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Configura DATABASE_URL antes de inicializar la base de datos.");
  }

  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  const sql = neon(databaseUrl);
  const statements = schema.split(";").map((statement) => statement.trim()).filter(Boolean);
  await sql.transaction(statements.map((statement) => sql.query(statement)));
  console.log("Esquema de alumnos, clases y asistencia creado correctamente.");
}

main().catch((error: unknown) => {
  console.error("No se pudo inicializar la base de datos:", error);
  process.exitCode = 1;
});
