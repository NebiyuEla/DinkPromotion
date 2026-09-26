import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { calculateOrderAmountMinor } from "@/lib/pricing";
import { createOrderSchema } from "@/lib/validators";
import { newPublicOrderId } from "@/lib/orders";
import { serializeOrder } from "@/lib/serializers";

export async function GET() {
  try {
    const user = await requireUser();
    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: { service: true, payment: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ orders: orders.map(serializeOrder) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (!process.env.PRM4U_API_KEY) throw new AppError("Ordering is temporarily unavailable", 503, "PROVIDER_NOT_CONFIGURED");
    const input = createOrderSchema.parse(await request.json());
    const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
    if (!service || !service.active || !service.compatible) {
      throw new AppError("Service is not available", 404, "SERVICE_NOT_AVAILABLE");
    }
    if (input.quantity < service.minQuantity || input.quantity > service.maxQuantity) {
      throw new AppError(
        `Quantity must be between ${service.minQuantity.toLocaleString()} and ${service.maxQuantity.toLocaleString()}`,
        400,
        "QUANTITY_OUT_OF_RANGE",
      );
    }
    const amountMinor = calculateOrderAmountMinor(service.pricePerThousandMinor, input.quantity);
    const order = await prisma.order.create({
      data: {
        publicId: newPublicOrderId(),
        userId: user.id,
        serviceId: service.id,
        provider: service.provider,
        providerServiceIdSnapshot: service.providerServiceId,
        link: input.link,
        quantity: input.quantity,
        amountMinor,
      },
      include: { service: true, payment: true },
    });
    return NextResponse.json({ order: serializeOrder(order) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
