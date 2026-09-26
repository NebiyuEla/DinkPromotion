import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { serializeUser } from "@/lib/serializers";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ user: serializeUser(user) });
  } catch (error) {
    return jsonError(error);
  }
}
