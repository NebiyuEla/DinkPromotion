import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { serializeOrder } from "@/lib/serializers";

export async function GET() {
  try {
    await requireAdmin();

    // Keep admin reads sequential so a single dashboard request does not fan out
    // into several database sessions on a small Supabase pool.
    const customers = await prisma.user.count();
    const services = await prisma.service.count();
    const activeServices = await prisma.service.count({ where: { active: true, compatible: true } });
    const orders = await prisma.order.count();
    const revenue = await prisma.order.aggregate({
      where: { status: { not: "AWAITING_PAYMENT" } },
      _sum: { amountMinor: true },
    });
    const latest = await prisma.order.findMany({
      include: { service: true, payment: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

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
