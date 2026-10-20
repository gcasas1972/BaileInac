import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSql } from "@/lib/db";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const sql = getSql();
  const links = await sql`
    SELECT id, title, url, description, created_at
    FROM student_links
    ORDER BY created_at DESC
  `;
  return NextResponse.json({ links });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La solicitud no contiene JSON válido." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ingresa los datos del enlace." }, { status: 400 });
  }

  const { title, url, description } = body as Record<string, unknown>;
  if (typeof title !== "string" || typeof url !== "string" || typeof description !== "string") {
    return NextResponse.json({ error: "El título, el enlace y la descripción son obligatorios." }, { status: 400 });
  }

  const normalizedTitle = title.trim();
  const normalizedUrl = url.trim();
  const normalizedDescription = description.trim();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    return NextResponse.json({ error: "Ingresa una URL válida que comience con https:// o http://." }, { status: 400 });
  }

  if (normalizedTitle.length < 2 || normalizedTitle.length > 120) {
    return NextResponse.json({ error: "El título debe tener entre 2 y 120 caracteres." }, { status: 400 });
  }
  if (
    normalizedUrl.length > 2048 ||
    (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:")
  ) {
    return NextResponse.json({ error: "El enlace debe ser una dirección http:// o https:// válida." }, { status: 400 });
  }
  if (normalizedDescription.length > 500) {
    return NextResponse.json({ error: "La descripción no puede superar los 500 caracteres." }, { status: 400 });
  }

  const sql = getSql();
  const [link] = await sql`
    INSERT INTO student_links (title, url, description)
    VALUES (${normalizedTitle}, ${parsedUrl.toString()}, ${normalizedDescription})
    RETURNING id, title, url, description, created_at
  `;
  return NextResponse.json({ link }, { status: 201 });
}
