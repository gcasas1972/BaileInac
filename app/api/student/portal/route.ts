import { NextResponse } from "next/server";
import { getStudentId, requireStudent } from "@/lib/auth";
import { getSql } from "@/lib/db";

export async function GET() {
  const unauthorized = await requireStudent();
  if (unauthorized) return unauthorized;

  const studentId = await getStudentId();
  if (!studentId) {
    return NextResponse.json({ error: "Inicia sesión como alumno para continuar." }, { status: 401 });
  }

  const sql = getSql();
  const [student] = await sql`
    SELECT id, name, email
    FROM students
    WHERE id = ${studentId}
  `;
  if (!student) {
    return NextResponse.json({ error: "No se encontró la cuenta del alumno." }, { status: 404 });
  }

  const classes = await sql`
    SELECT
      c.id,
      c.title,
      c.scheduled_at,
      (e.student_id IS NOT NULL OR a.student_id IS NOT NULL) AS is_enrolled,
      a.status AS attendance_status
    FROM classes c
    LEFT JOIN class_enrollments e
      ON e.class_id = c.id AND e.student_id = ${studentId}
    LEFT JOIN attendance a
      ON a.class_id = c.id AND a.student_id = ${studentId}
    ORDER BY
      CASE WHEN c.scheduled_at >= now() THEN 0 ELSE 1 END,
      CASE WHEN c.scheduled_at >= now() THEN c.scheduled_at END ASC,
      CASE WHEN c.scheduled_at < now() THEN c.scheduled_at END DESC
  `;
  return NextResponse.json({ student, classes });
}
