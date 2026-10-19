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
