import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, service: "dink-promotion" });
  } catch {
    return NextResponse.json({ ok: false, service: "dink-promotion", database: "unavailable" }, { status: 503 });
  }
}
