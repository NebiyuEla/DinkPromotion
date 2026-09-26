import { OrderStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { discountedServicePrice, getDiscountMap } from "@/lib/discounts";
import { AppError, jsonError } from "@/lib/http";
import { calculateOrderAmountMinor } from "@/lib/pricing";
import { createOrderSchema } from "@/lib/validators";
import { newPublicOrderId, syncOpenProviderOrders } from "@/lib/orders";
import { serializeOrder } from "@/lib/serializers";

const ABANDONED_DRAFT_AGE_MS = 30 * 60 * 1000;

export async function GET() {
  try {
    const user = await requireUser();
    try {
      await syncOpenProviderOrders(user.id);
    } catch (error) {
      // A provider outage must not hide the customer's existing order history.
      console.error("Customer provider status refresh failed", error);
    }

    // Orders are only real purchases once a payment flow exists. Remove old
    // checkout drafts that were abandoned before payment was started.
    await prisma.order.deleteMany({
      where: {
        userId: user.id,
        status: OrderStatus.AWAITING_PAYMENT,
        payment: { is: null },
        createdAt: { lt: new Date(Date.now() - ABANDONED_DRAFT_AGE_MS) },
      },
    });

    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
        OR: [
          { status: { not: OrderStatus.AWAITING_PAYMENT } },
          { payment: { isNot: null } },
        ],
      },
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

    const discounts = await getDiscountMap();
    const discounted = discountedServicePrice(service.pricePerThousandMinor, service.platform, discounts);
    const amountMinor = calculateOrderAmountMinor(discounted.priceMinor, input.quantity);

    // The Mini App has one checkout at a time. Replace any earlier no-payment
    // draft so closing/reopening the app never creates a pile of fake orders.
    await prisma.order.deleteMany({
      where: {
        userId: user.id,
        status: OrderStatus.AWAITING_PAYMENT,
        payment: { is: null },
      },
    });

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
