import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSql } from "@/lib/db";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const sql = getSql();
  const classes = await sql`
    SELECT
      c.id,
      c.title,
      c.scheduled_at,
      c.notes,
      c.created_at,
      COUNT(a.id)::int AS marked_count,
      COUNT(*) FILTER (WHERE a.status = 'present')::int AS present_count
    FROM classes c
    LEFT JOIN attendance a ON a.class_id = c.id
    GROUP BY c.id
    ORDER BY c.scheduled_at DESC
  `;
  return NextResponse.json({ classes });
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
    return NextResponse.json({ error: "Ingresa los datos de la clase." }, { status: 400 });
  }

  const { title, scheduledAt, notes } = body as Record<string, unknown>;
  if (typeof title !== "string" || typeof scheduledAt !== "string") {
    return NextResponse.json(
      { error: "El nombre de la clase y su fecha y hora son obligatorios." },
      { status: 400 },
    );
  }

  const normalizedTitle = title.trim();
  const scheduledDate = new Date(scheduledAt);
  const normalizedNotes = typeof notes === "string" ? notes.trim() : "";
  if (normalizedTitle.length < 2 || normalizedTitle.length > 120) {
    return NextResponse.json({ error: "El nombre debe tener entre 2 y 120 caracteres." }, { status: 400 });
  }
  if (!Number.isFinite(scheduledDate.getTime())) {
    return NextResponse.json({ error: "La fecha y hora no son válidas." }, { status: 400 });
  }
  if (scheduledDate.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Programa la clase para una fecha futura." }, { status: 400 });
  }
  if (normalizedNotes.length > 500) {
    return NextResponse.json({ error: "Las notas no pueden superar los 500 caracteres." }, { status: 400 });
  }

  const [newClass] = await sql`
    INSERT INTO classes (title, scheduled_at, notes)
    VALUES (${normalizedTitle}, ${scheduledDate.toISOString()}, ${normalizedNotes})
    RETURNING id, title, scheduled_at, notes, created_at
  `;
  return NextResponse.json({ class: newClass }, { status: 201 });
}
