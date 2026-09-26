import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DISCOUNT_PLATFORMS, GLOBAL_DISCOUNT_SCOPE, platformDiscountScope } from "@/lib/discounts";
import { jsonError } from "@/lib/http";

const allowedScopes = new Set<string>([
  GLOBAL_DISCOUNT_SCOPE,
  ...DISCOUNT_PLATFORMS.map(platformDiscountScope),
]);

const updateSchema = z.object({
  scope: z.string().trim().min(1).max(80),
  percent: z.number().int().min(0).max(90),
});

export async function GET() {
  try {
    await requireAdmin();
    const rules = await prisma.discountRule.findMany({ orderBy: { scope: "asc" } });
    return NextResponse.json({
      rules,
      platforms: DISCOUNT_PLATFORMS,
      globalScope: GLOBAL_DISCOUNT_SCOPE,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const input = updateSchema.parse(await request.json());
    if (!allowedScopes.has(input.scope)) {
      return NextResponse.json({ error: "Unsupported discount scope" }, { status: 400 });
    }

    const rule = await prisma.discountRule.upsert({
      where: { scope: input.scope },
      create: {
        scope: input.scope,
        percent: input.percent,
        active: input.percent > 0,
      },
      update: {
        percent: input.percent,
        active: input.percent > 0,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "discount.update",
        entity: "DiscountRule",
        entityId: rule.scope,
        metadata: { scope: rule.scope, percent: rule.percent, active: rule.active },
      },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    return jsonError(error);
  }
}
