import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { isUniqueViolation } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };
const validStatuses = new Set(["pending", "present", "absent", "late"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const sql = getSql();
  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "El identificador de clase no es válido." }, { status: 400 });
  }
  const [classInfo] = await sql`
    SELECT id, title, scheduled_at, notes
    FROM classes
    WHERE id = ${id}
  `;
  if (!classInfo) {
    return NextResponse.json({ error: "No se encontró la clase." }, { status: 404 });
  }

  const students = await sql`
    SELECT s.id, s.name, s.email, s.document, a.status
    FROM students s
    LEFT JOIN attendance a ON a.student_id = s.id AND a.class_id = ${id}
    WHERE EXISTS (
      SELECT 1
      FROM class_enrollments e
      WHERE e.class_id = ${id} AND e.student_id = s.id
    ) OR a.id IS NOT NULL
    ORDER BY s.name ASC
  `;
  return NextResponse.json({ class: classInfo, students });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const sql = getSql();
  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "El identificador de clase no es válido." }, { status: 400 });
  }
  const [classInfo] = await sql`SELECT id FROM classes WHERE id = ${id}`;
  if (!classInfo) {
    return NextResponse.json({ error: "No se encontró la clase." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La solicitud no contiene JSON válido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("records" in body) || !Array.isArray(body.records)) {
    return NextResponse.json({ error: "La lista de asistencia no es válida." }, { status: 400 });
  }

  const records: { student_id: string; status: string }[] = [];
  const studentIds = new Set<string>();
  for (const record of body.records) {
    if (
      !record ||
      typeof record !== "object" ||
      !("studentId" in record) ||
      !("status" in record) ||
      typeof record.studentId !== "string" ||
      typeof record.status !== "string" ||
      !uuidPattern.test(record.studentId) ||
      !validStatuses.has(record.status) ||
      studentIds.has(record.studentId)
    ) {
      return NextResponse.json(
        { error: "Hay registros duplicados o datos de asistencia no válidos." },
        { status: 400 },
      );
    }
    studentIds.add(record.studentId);
    records.push({ student_id: record.studentId, status: record.status });
  }

  try {
    await sql`
      WITH input AS (
        SELECT student_id, status
        FROM jsonb_to_recordset(${JSON.stringify(records)}::jsonb) AS entry(student_id uuid, status text)
      ),
      removed AS (
        DELETE FROM attendance a
        USING input i
        WHERE a.class_id = ${id}
          AND a.student_id = i.student_id
          AND i.status = 'pending'
      )
      INSERT INTO attendance (class_id, student_id, status, marked_at)
      SELECT ${id}, i.student_id, i.status, now()
      FROM input i
      WHERE i.status IN ('present', 'absent', 'late')
      ON CONFLICT (class_id, student_id)
      DO UPDATE SET status = EXCLUDED.status, marked_at = now()
    `;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "No se pudo guardar la asistencia. Verifica los alumnos seleccionados." },
        { status: 409 },
      );
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23503"
    ) {
      return NextResponse.json(
        { error: "Uno o más alumnos ya no existen. Actualiza la lista e inténtalo de nuevo." },
        { status: 400 },
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
