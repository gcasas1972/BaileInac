import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

export const sessionCookieName = "baileinac_session";
const sessionDurationSeconds = 60 * 60 * 8;

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("AUTH_SECRET debe configurarse con al menos 32 caracteres.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(email: string): Promise<string> {
  return new SignJWT({ role: "admin", email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${sessionDurationSeconds}s`)
    .sign(getAuthSecret());
}

export async function getAdminEmail(): Promise<string | null> {
  const token = (await cookies()).get(sessionCookieName)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    if (payload.role !== "admin" || typeof payload.email !== "string") return null;
    return payload.email;
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<NextResponse | null> {
  if (await getAdminEmail()) return null;
  return NextResponse.json({ error: "Debes iniciar sesión para continuar." }, { status: 401 });
}

export { sessionDurationSeconds };
