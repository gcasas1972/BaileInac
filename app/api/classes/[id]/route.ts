import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSql } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readClassInput(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: "La solicitud no contiene JSON válido." };
  }
  if (!body || typeof body !== "object") {
    return { error: "Ingresa los datos de la clase." };
  }

  const { title, scheduledAt, notes } = body as Record<string, unknown>;
  if (typeof title !== "string" || typeof scheduledAt !== "string" || typeof notes !== "string") {
    return { error: "El nombre, la fecha, la hora y las notas de la clase no son válidos." };
  }

  const normalizedTitle = title.trim();
  const scheduledDate = new Date(scheduledAt);
  const normalizedNotes = notes.trim();
  if (normalizedTitle.length < 2 || normalizedTitle.length > 120) {
    return { error: "El nombre debe tener entre 2 y 120 caracteres." };
  }
  if (!Number.isFinite(scheduledDate.getTime())) {
    return { error: "La fecha y hora no son válidas." };
  }
  if (normalizedNotes.length > 500) {
    return { error: "Las notas no pueden superar los 500 caracteres." };
  }
  return { title: normalizedTitle, scheduledAt: scheduledDate.toISOString(), notes: normalizedNotes };
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "El identificador de clase no es válido." }, { status: 400 });
  }

  const input = await readClassInput(request);
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  const sql = getSql();
  const [updatedClass] = await sql`
    UPDATE classes
    SET title = ${input.title}, scheduled_at = ${input.scheduledAt}, notes = ${input.notes}
    WHERE id = ${id}
    RETURNING id, title, scheduled_at, notes, created_at
  `;
  if (!updatedClass) {
    return NextResponse.json({ error: "No se encontró la clase." }, { status: 404 });
  }
  return NextResponse.json({ class: updatedClass });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "El identificador de clase no es válido." }, { status: 400 });
  }

  const sql = getSql();
  const [deletedClass] = await sql`
    DELETE FROM classes
    WHERE id = ${id}
    RETURNING id
  `;
  if (!deletedClass) {
    return NextResponse.json({ error: "No se encontró la clase." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
