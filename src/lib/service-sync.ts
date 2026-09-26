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

function quantity(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : 1;
}

type ProviderMetadata = {
  providerServiceId: number;
  providerName: string;
  providerType: string;
  providerCategory: string;
  providerRateUsd: string;
  minQuantity: number;
  maxQuantity: number;
  refill: boolean;
  cancel: boolean;
  compatible: boolean;
};

async function runSync(actorId?: string | null): Promise<ServiceSyncResult> {
  const services = await getPrmServices();
  const now = new Date();
  const existing = await prisma.service.findMany({
    where: { provider: "PRM4U" },
    select: {
      providerServiceId: true,
      providerName: true,
      providerType: true,
      providerCategory: true,
      providerRateUsd: true,
      minQuantity: true,
      maxQuantity: true,
      refill: true,
      cancel: true,
      compatible: true,
    },
  });
  const existingByProviderId = new Map(existing.map((item) => [item.providerServiceId, item]));
  const providerIds: number[] = [];
  const newRows: Array<{
    provider: string;
    providerServiceId: number;
    providerName: string;
    providerType: string;
    providerCategory: string;
    providerRateUsd: string;
    displayName: string;
    platform: string;
    category: string;
    minQuantity: number;
    maxQuantity: number;
    refill: boolean;
    cancel: boolean;
    compatible: boolean;
    pricePerThousandMinor: number;
    active: boolean;
    lastProviderSyncAt: Date;
  }> = [];
  const changedRows: ProviderMetadata[] = [];

  for (const item of services) {
    const providerServiceId = Number(item.service);
    if (!Number.isSafeInteger(providerServiceId)) continue;
    providerIds.push(providerServiceId);

    const compatible = isSupportedPrmType(item.type);
    const platform = detectPlatform(item.name, item.category);
    const metadata: ProviderMetadata = {
      providerServiceId,
      providerName: item.name,
      providerType: item.type,
      providerCategory: item.category,
      providerRateUsd: item.rate,
      minQuantity: quantity(item.min),
      maxQuantity: quantity(item.max),
      refill: Boolean(item.refill),
      cancel: Boolean(item.cancel),
      compatible,
    };
    const current = existingByProviderId.get(providerServiceId);

    if (!current) {
      const pricePerThousandMinor = providerRateToEtbMinor(item.rate);
      newRows.push({
        provider: "PRM4U",
        ...metadata,
        displayName: cleanName(item.name),
        platform,
        category: detectCategory(item.name),
        pricePerThousandMinor,
        active: compatible && pricePerThousandMinor > 0 && CUSTOMER_PLATFORMS.has(platform),
        lastProviderSyncAt: now,
      });
      continue;
    }

    if (
      current.providerName !== metadata.providerName ||
      current.providerType !== metadata.providerType ||
      current.providerCategory !== metadata.providerCategory ||
      current.providerRateUsd !== metadata.providerRateUsd ||
      current.minQuantity !== metadata.minQuantity ||
      current.maxQuantity !== metadata.maxQuantity ||
      current.refill !== metadata.refill ||
      current.cancel !== metadata.cancel ||
      current.compatible !== metadata.compatible
    ) {
      changedRows.push(metadata);
    }
  }

  let created = 0;
  for (let i = 0; i < newRows.length; i += 500) {
    const result = await prisma.service.createMany({ data: newRows.slice(i, i + 500), skipDuplicates: true });
    created += result.count;
  }

  // Updating every provider row one-by-one can exceed a serverless function's
  // lifetime. Apply only changed provider metadata in one set-based SQL update.
  if (changedRows.length) {
    const payload = JSON.stringify(changedRows);
    await prisma.$executeRaw`
      UPDATE public."Service" AS s
      SET
        "providerName" = x."providerName",
        "providerType" = x."providerType",
        "providerCategory" = x."providerCategory",
        "providerRateUsd" = x."providerRateUsd",
        "minQuantity" = x."minQuantity",
        "maxQuantity" = x."maxQuantity",
        refill = x.refill,
        cancel = x.cancel,
        compatible = x.compatible,
        "updatedAt" = NOW()
      FROM jsonb_to_recordset(${payload}::jsonb) AS x(
        "providerServiceId" integer,
        "providerName" text,
        "providerType" text,
        "providerCategory" text,
        "providerRateUsd" text,
        "minQuantity" integer,
        "maxQuantity" integer,
        refill boolean,
        cancel boolean,
        compatible boolean
      )
      WHERE s.provider = 'PRM4U'
        AND s."providerServiceId" = x."providerServiceId"
    `;
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

  // This write is the completion marker. A terminated/partial sync never advances
  // catalog freshness, so a later request safely retries instead of accepting a
  // half-refreshed provider catalog as current.
  await prisma.service.updateMany({
    where: { provider: "PRM4U" },
    data: { lastProviderSyncAt: now },
  });

  const unpublished = incompatible.count + removed.count;
  const updated = changedRows.length;
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
