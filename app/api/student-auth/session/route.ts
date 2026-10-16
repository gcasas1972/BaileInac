import { NextResponse } from "next/server";
import { getStudentId } from "@/lib/auth";
import { getSql } from "@/lib/db";

export async function GET() {
  const studentId = await getStudentId();
  if (!studentId) {
    return NextResponse.json({ authenticated: false, student: null });
  }

  const sql = getSql();
  const [student] = await sql`
    SELECT id, name, email
    FROM students
    WHERE id = ${studentId}
  `;
  return NextResponse.json({ authenticated: Boolean(student), student: student || null });
}
