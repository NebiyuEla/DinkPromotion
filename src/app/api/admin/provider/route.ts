import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getPrmBalance } from "@/lib/prm4u";

export async function GET() {
  try {
    await requireAdmin();
    const balance = await getPrmBalance();
    return NextResponse.json(balance);
  } catch (error) {
    return jsonError(error);
  }
}
