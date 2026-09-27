import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { paymentFeePercent } from "@/lib/payment-fee";
import { getPricingConfig, setPricingConfig } from "@/lib/pricing-config";

const pricingSchema = z.object({
  usdCostRate: z.number().positive().max(10000).nullable(),
  sellRate: z.number().positive().max(10000),
});

export async function GET() {
  try {
    await requireAdmin();
    const pricing = await getPricingConfig();
    return NextResponse.json({ ...pricing, paymentFeePercent: paymentFeePercent() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const input = pricingSchema.parse(await request.json());
    const pricing = await setPricingConfig(input);
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "pricing.update",
        entity: "PricingConfig",
        entityId: "1",
        metadata: {
          usdCostRate: pricing.usdCostRate,
          sellRate: pricing.sellRate,
          profitPerUsd: pricing.profitPerUsd,
          marginPercent: pricing.marginPercent,
        },
      },
    });
    return NextResponse.json({ ...pricing, paymentFeePercent: paymentFeePercent() });
  } catch (error) {
    return jsonError(error);
  }
}
