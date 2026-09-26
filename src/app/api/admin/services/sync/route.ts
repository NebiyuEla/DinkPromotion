import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { syncPrmServices } from "@/lib/service-sync";

export async function POST() {
  try {
    const admin = await requireAdmin();
    const result = await syncPrmServices(admin.id);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
