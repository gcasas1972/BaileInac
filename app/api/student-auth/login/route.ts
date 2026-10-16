import { NextRequest, NextResponse } from "next/server";
import { createStudentSession, sessionDurationSeconds, studentSessionCookieName } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { verifyStudentPassword } from "@/lib/student-password";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La solicitud no contiene JSON válido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("email" in body) || !("password" in body)) {
    return NextResponse.json({ error: "Ingresa tu correo y contraseña." }, { status: 400 });
  }

  const { email, password } = body;
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.trim().length > 254 ||
    password.length > 128
  ) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  }

  const sql = getSql();
  const [student] = await sql`
    SELECT id, name, email, password_hash
    FROM students
    WHERE email = ${email.trim().toLowerCase()}
  `;
  if (
    !student ||
    typeof student.password_hash !== "string" ||
    !(await verifyStudentPassword(password, student.password_hash))
  ) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  }

  const token = await createStudentSession(student.id);
  const response = NextResponse.json({ student: { id: student.id, name: student.name, email: student.email } });
  response.cookies.set(studentSessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: sessionDurationSeconds,
  });
  return response;
}
