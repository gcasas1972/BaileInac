import { NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/auth";

export async function GET() {
  const email = await getAdminEmail();
  return NextResponse.json({ authenticated: Boolean(email), email });
}
