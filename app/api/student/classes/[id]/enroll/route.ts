import { NextRequest, NextResponse } from "next/server";
import { getStudentId, requireStudent } from "@/lib/auth";
import { getSql } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const unauthorized = await requireStudent();
  if (unauthorized) return unauthorized;

  const studentId = await getStudentId();
  if (!studentId) {
    return NextResponse.json({ error: "Inicia sesión como alumno para continuar." }, { status: 401 });
  }

  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "El identificador de clase no es válido." }, { status: 400 });
  }

  const sql = getSql();
  const [classInfo] = await sql`
    SELECT id
    FROM classes
    WHERE id = ${id} AND scheduled_at > now()
  `;
  if (!classInfo) {
    return NextResponse.json(
      { error: "La clase no existe o ya comenzó." },
      { status: 404 },
    );
  }

  const [enrollment] = await sql`
    INSERT INTO class_enrollments (class_id, student_id)
    VALUES (${id}, ${studentId})
    ON CONFLICT (class_id, student_id) DO NOTHING
    RETURNING class_id
  `;

  return NextResponse.json({ enrolled: true }, { status: enrollment ? 201 : 200 });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const unauthorized = await requireStudent();
  if (unauthorized) return unauthorized;

  const studentId = await getStudentId();
  if (!studentId) {
    return NextResponse.json({ error: "Inicia sesión como alumno para continuar." }, { status: 401 });
  }

  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "El identificador de clase no es válido." }, { status: 400 });
  }

  const sql = getSql();
  const [result] = await sql`
    WITH class_state AS MATERIALIZED (
      SELECT
        c.id,
        c.scheduled_at,
        EXISTS (
          SELECT 1 FROM class_enrollments e
          WHERE e.class_id = c.id AND e.student_id = ${studentId}
        ) AS has_enrollment,
        EXISTS (
          SELECT 1 FROM attendance a
          WHERE a.class_id = c.id AND a.student_id = ${studentId}
        ) AS has_attendance
      FROM classes c
      WHERE c.id = ${id}
    ),
    eligible AS MATERIALIZED (
      SELECT id
      FROM class_state
      WHERE scheduled_at > now() + interval '1 hour'
        AND (has_enrollment OR has_attendance)
    ),
    deleted_attendance AS (
      DELETE FROM attendance a
      USING eligible e
      WHERE a.class_id = e.id AND a.student_id = ${studentId}
      RETURNING a.class_id
    ),
    deleted_enrollment AS (
      DELETE FROM class_enrollments e
      USING eligible c
      WHERE e.class_id = c.id AND e.student_id = ${studentId}
      RETURNING e.class_id
    )
    SELECT
      EXISTS (SELECT 1 FROM class_state) AS class_exists,
      COALESCE((
        SELECT has_enrollment OR has_attendance FROM class_state
      ), false) AS is_enrolled,
      COALESCE((
        SELECT scheduled_at > now() + interval '1 hour' FROM class_state
      ), false) AS can_cancel,
      EXISTS (SELECT 1 FROM deleted_enrollment)
        OR EXISTS (SELECT 1 FROM deleted_attendance) AS cancelled
  `;

  if (!result.class_exists) {
    return NextResponse.json({ error: "No se encontró la clase." }, { status: 404 });
  }
  if (!result.is_enrolled) {
    return NextResponse.json({ error: "No estás inscrito en esta clase." }, { status: 409 });
  }
  if (!result.can_cancel) {
    return NextResponse.json(
      { error: "Solo puedes cancelar tu inscripción con al menos una hora de anticipación." },
      { status: 409 },
    );
  }

  return NextResponse.json({ enrolled: false, cancelled: result.cancelled });
}
