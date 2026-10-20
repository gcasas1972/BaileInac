import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSql } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "El identificador del enlace no es válido." }, { status: 400 });
  }

  const sql = getSql();
  const [link] = await sql`
    DELETE FROM student_links
    WHERE id = ${id}
    RETURNING id
  `;
  if (!link) {
    return NextResponse.json({ error: "No se encontró el enlace." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
