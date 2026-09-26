import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { detectCategory, detectPlatform, getPrmServices, isSupportedPrmType } from "@/lib/prm4u";
import { providerRateToEtbMinor } from "@/lib/pricing";

function cleanName(name: string) {
  return name.replace(/\s+/g, " ").replace(/^[-|•\s]+|[-|•\s]+$/g, "").trim().slice(0, 120) || "Social media service";
}

export async function POST() {
  try {
    const admin = await requireAdmin();
    const services = await getPrmServices();
    let created = 0;
    let updated = 0;
    const now = new Date();

    for (let i = 0; i < services.length; i += 100) {
      const batch = services.slice(i, i + 100);
      const operations = batch.map((item) => {
        const providerServiceId = Number(item.service);
        const minQuantity = Number(item.min);
        const maxQuantity = Number(item.max);
        const compatible = isSupportedPrmType(item.type);
        const platform = detectPlatform(item.name, item.category);
        const category = detectCategory(item.name);
        return prisma.service.upsert({
          where: { provider_providerServiceId: { provider: "PRM4U", providerServiceId } },
          create: {
            provider: "PRM4U",
            providerServiceId,
            providerName: item.name,
            providerType: item.type,
            providerCategory: item.category,
            providerRateUsd: item.rate,
            displayName: cleanName(item.name),
            platform,
            category,
            minQuantity: Number.isFinite(minQuantity) ? minQuantity : 1,
            maxQuantity: Number.isFinite(maxQuantity) ? maxQuantity : 1,
            refill: Boolean(item.refill),
            cancel: Boolean(item.cancel),
            compatible,
            pricePerThousandMinor: providerRateToEtbMinor(item.rate),
            active: false,
            lastProviderSyncAt: now,
          },
          update: {
            providerName: item.name,
            providerType: item.type,
            providerCategory: item.category,
            providerRateUsd: item.rate,
            minQuantity: Number.isFinite(minQuantity) ? minQuantity : 1,
            maxQuantity: Number.isFinite(maxQuantity) ? maxQuantity : 1,
            refill: Boolean(item.refill),
            cancel: Boolean(item.cancel),
            compatible,
            lastProviderSyncAt: now,
          },
          select: { createdAt: true, updatedAt: true },
        });
      });
      const results = await prisma.$transaction(operations);
      for (const result of results) {
        if (Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000) created += 1;
        else updated += 1;
      }
    }

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "provider.services.sync",
        entity: "Provider",
        entityId: "PRM4U",
        metadata: { received: services.length, created, updated },
      },
    });
    return NextResponse.json({ received: services.length, created, updated });
  } catch (error) {
    return jsonError(error);
  }
}
