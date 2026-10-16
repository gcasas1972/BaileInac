import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { isUniqueViolation } from "@/lib/http";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const sql = getSql();
  const studentsNeedingInvites = await sql`
    SELECT id
    FROM students
    WHERE password_hash IS NULL AND registration_code IS NULL
  `;
  if (studentsNeedingInvites.length > 0) {
    const invites = studentsNeedingInvites.map((student) => ({
      id: student.id,
      code: randomBytes(24).toString("hex"),
    }));
    await sql`
      WITH invites AS (
        SELECT id, code
        FROM jsonb_to_recordset(${JSON.stringify(invites)}::jsonb) AS entry(id uuid, code text)
      )
      UPDATE students AS s
      SET registration_code = invites.code
      FROM invites
      WHERE s.id = invites.id
        AND s.password_hash IS NULL
        AND s.registration_code IS NULL
    `;
  }
  const students = await sql`
    SELECT id, name, email, document, created_at, registration_code
    FROM students
    ORDER BY name ASC
  `;
  return NextResponse.json({ students });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const sql = getSql();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La solicitud no contiene JSON válido." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ingresa los datos del alumno." }, { status: 400 });
  }

  const { name, email, document } = body as Record<string, unknown>;
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof document !== "string"
  ) {
    return NextResponse.json(
      { error: "Nombre, correo y documento son obligatorios." },
      { status: 400 },
    );
  }

  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedDocument = document.trim().toUpperCase();
  if (normalizedName.length < 2 || normalizedName.length > 120) {
    return NextResponse.json({ error: "El nombre debe tener entre 2 y 120 caracteres." }, { status: 400 });
  }
  if (
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    return NextResponse.json({ error: "Ingresa un correo electrónico válido." }, { status: 400 });
  }
  if (normalizedDocument.length < 4 || normalizedDocument.length > 32) {
    return NextResponse.json({ error: "El documento debe tener entre 4 y 32 caracteres." }, { status: 400 });
  }

  try {
    const [student] = await sql`
      INSERT INTO students (name, email, document)
      VALUES (${normalizedName}, ${normalizedEmail}, ${normalizedDocument})
      RETURNING id, name, email, document, created_at
    `;
    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "Ya existe un alumno con ese correo o documento." },
        { status: 409 },
      );
    }
    throw error;
  }
}
