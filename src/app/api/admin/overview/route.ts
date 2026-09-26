import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { serializeOrder } from "@/lib/serializers";

export async function GET() {
  try {
    await requireAdmin();
    const [customers, services, activeServices, orders, revenue, latest] = await Promise.all([
      prisma.user.count(),
      prisma.service.count(),
      prisma.service.count({ where: { active: true } }),
      prisma.order.count(),
      prisma.order.aggregate({ where: { status: { not: "AWAITING_PAYMENT" } }, _sum: { amountMinor: true } }),
      prisma.order.findMany({ include: { service: true, payment: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    return NextResponse.json({
      customers,
      services,
      activeServices,
      orders,
      grossPaidMinor: revenue._sum.amountMinor || 0,
      latestOrders: latest.map(serializeOrder),
    });
  } catch (error) {
    return jsonError(error);
  }
}
