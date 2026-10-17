import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSession, sessionCookieName, sessionDurationSeconds } from "@/lib/auth";

function passwordsMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

type AdminCredential = { email: string; password: string };

function getAdminCredentials(): AdminCredential[] | null {
  const slots = new Set<number>();
  for (const key of Object.keys(process.env)) {
    const match = /^ADMIN_(?:EMAIL|PASSWORD)(?:_(\d+))?$/.exec(key);
    if (match) slots.add(match[1] ? Number(match[1]) : 1);
  }

  const sortedSlots = [...slots].sort((a, b) => a - b);
  if (sortedSlots.some((slot, index) => slot !== index + 1)) return null;

  const credentials: AdminCredential[] = [];
  for (const slot of sortedSlots) {
    const suffix = slot === 1 ? "" : `_${slot}`;
    const email = process.env[`ADMIN_EMAIL${suffix}`]?.trim().toLowerCase();
    const password = process.env[`ADMIN_PASSWORD${suffix}`];
    if (!email || !password || credentials.some((admin) => admin.email === email)) {
      return null;
    }
    credentials.push({ email, password });
  }

  return credentials;
}

export async function POST(request: NextRequest) {
  const adminCredentials = getAdminCredentials();

  if (!adminCredentials?.length) {
    return NextResponse.json(
      { error: "El acceso del administrador aún no está configurado." },
      { status: 503 },
    );
  }

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
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const admin = adminCredentials.find(
    (credential) =>
      credential.email === normalizedEmail && passwordsMatch(password, credential.password),
  );
  if (!admin) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  }

  const token = await createSession(admin.email);
  const response = NextResponse.json({ email: admin.email });
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: sessionDurationSeconds,
  });
  return response;
}
