import { NextRequest, NextResponse } from "next/server";
import {
  assertAuthConfigured,
  createStudentSession,
  sessionDurationSeconds,
  studentSessionCookieName,
} from "@/lib/auth";
import { getSql } from "@/lib/db";
import { isUniqueViolation } from "@/lib/http";
import { hashStudentPassword } from "@/lib/student-password";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La solicitud no contiene JSON válido." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Completa los datos para registrarte." }, { status: 400 });
  }

  const { name, email, document, password, registrationCode } = body as Record<string, unknown>;
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof document !== "string" ||
    typeof password !== "string"
  ) {
    return NextResponse.json(
      { error: "Nombre, correo, documento y contraseña son obligatorios." },
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
  if (password.length < 10 || password.length > 128) {
    return NextResponse.json(
      { error: "La contraseña debe tener entre 10 y 128 caracteres." },
      { status: 400 },
    );
  }
  if (
    registrationCode !== undefined &&
    registrationCode !== "" &&
    (typeof registrationCode !== "string" || !/^[0-9a-f]{48}$/i.test(registrationCode))
  ) {
    return NextResponse.json({ error: "El enlace de invitación no es válido." }, { status: 400 });
  }

  assertAuthConfigured();
  const sql = getSql();
  const passwordHash = await hashStudentPassword(password);
  try {
    let student;
    if (typeof registrationCode === "string" && registrationCode) {
      [student] = await sql`
        UPDATE students
        SET password_hash = ${passwordHash}, registration_code = NULL
        WHERE registration_code = ${registrationCode}
          AND password_hash IS NULL
          AND email = ${normalizedEmail}
          AND document = ${normalizedDocument}
        RETURNING id, name, email
      `;
      if (!student) {
        return NextResponse.json(
          { error: "La invitación no es válida, ya fue utilizada o los datos no coinciden." },
          { status: 409 },
        );
      }
    } else {
      [student] = await sql`
        INSERT INTO students (name, email, document, password_hash)
        VALUES (${normalizedName}, ${normalizedEmail}, ${normalizedDocument}, ${passwordHash})
        RETURNING id, name, email
      `;
    }

    const token = await createStudentSession(student.id);
    const response = NextResponse.json({ student }, { status: 201 });
    response.cookies.set(studentSessionCookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: sessionDurationSeconds,
    });
    return response;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "Ya existe un alumno con ese correo o documento. Inicia sesión si ya tienes una cuenta." },
        { status: 409 },
      );
    }
    throw error;
  }
}
