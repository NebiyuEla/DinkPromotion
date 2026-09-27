import { NextRequest, NextResponse } from "next/server";
import { requireBotRequest } from "@/lib/bot-api";
import { jsonError } from "@/lib/http";
import { syncOpenProviderOrders } from "@/lib/orders";
import { isPrmCatalogStale, syncPrmServices } from "@/lib/service-sync";

export async function POST(request: NextRequest) {
  try {
    requireBotRequest(request);

    let catalog: Awaited<ReturnType<typeof syncPrmServices>> | null = null;
    if (await isPrmCatalogStale()) catalog = await syncPrmServices();

    const orders = await syncOpenProviderOrders();
    return NextResponse.json({ catalog, orders });
  } catch (error) {
    return jsonError(error);
  }
}
