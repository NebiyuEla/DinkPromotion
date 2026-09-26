import { prisma } from "./db";
import { detectCategory, detectPlatform, getPrmServices, isSupportedPrmType } from "./prm4u";
import { providerRateToEtbMinor } from "./pricing";

export type ServiceSyncResult = {
  received: number;
  created: number;
  updated: number;
  unpublished: number;
};

const CUSTOMER_PLATFORMS = new Set(["Instagram", "TikTok", "YouTube", "Telegram", "Facebook", "X / Twitter"]);
let activeSync: Promise<ServiceSyncResult> | null = null;

function cleanName(name: string) {
  return name.replace(/\s+/g, " ").replace(/^[-|•\s]+|[-|•\s]+$/g, "").trim().slice(0, 120) || "Social media service";
}

async function runSync(actorId?: string | null): Promise<ServiceSyncResult> {
  const services = await getPrmServices();
  const now = new Date();
  const providerIds: number[] = [];
  let created = 0;
  let updated = 0;

  for (let i = 0; i < services.length; i += 100) {
    const batch = services.slice(i, i + 100).filter((item) => Number.isSafeInteger(Number(item.service)));
    const operations = batch.map((item) => {
      const providerServiceId = Number(item.service);
      providerIds.push(providerServiceId);
      const minQuantity = Number(item.min);
      const maxQuantity = Number(item.max);
      const compatible = isSupportedPrmType(item.type);
      const platform = detectPlatform(item.name, item.category);
      const category = detectCategory(item.name);
      const pricePerThousandMinor = providerRateToEtbMinor(item.rate);
      const autoPublish = compatible && pricePerThousandMinor > 0 && CUSTOMER_PLATFORMS.has(platform);

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
          pricePerThousandMinor,
          active: autoPublish,
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

    if (!operations.length) continue;
    const results = await prisma.$transaction(operations);
    for (const result of results) {
      if (Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000) created += 1;
      else updated += 1;
    }
  }

  const incompatible = await prisma.service.updateMany({
    where: { provider: "PRM4U", compatible: false, active: true },
    data: { active: false },
  });
  const removed = providerIds.length
    ? await prisma.service.updateMany({
        where: { provider: "PRM4U", providerServiceId: { notIn: providerIds }, active: true },
        data: { active: false },
      })
    : { count: 0 };

  const unpublished = incompatible.count + removed.count;
  if (actorId) {
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "provider.services.sync",
        entity: "Provider",
        entityId: "PRM4U",
        metadata: { received: services.length, created, updated, unpublished },
      },
    });
  }

  return { received: services.length, created, updated, unpublished };
}

export function syncPrmServices(actorId?: string | null) {
  if (activeSync) return activeSync;
  activeSync = runSync(actorId).finally(() => {
    activeSync = null;
  });
  return activeSync;
}

export async function isPrmCatalogStale(maxAgeMs = 10 * 60 * 1000) {
  const latest = await prisma.service.findFirst({
    where: { provider: "PRM4U" },
    orderBy: { lastProviderSyncAt: "desc" },
    select: { lastProviderSyncAt: true },
  });
  if (!latest) return true;
  return Date.now() - latest.lastProviderSyncAt.getTime() > maxAgeMs;
}
