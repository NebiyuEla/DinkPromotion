import { prisma } from "./db";
import { curatePrmCatalog, detectCategory, detectPlatform, getPrmServices, isSupportedPrmType } from "./prm4u";
import { providerRateToEtbMinor } from "./pricing";

export type ServiceSyncResult = {
  received: number;
  created: number;
  updated: number;
  unpublished: number;
};

let activeSync: Promise<ServiceSyncResult> | null = null;
const POSTGRES_INT_MAX = 2_147_483_647;

function cleanName(name: string) {
  return name.replace(/\s+/g, " ").replace(/^[-|•\s]+|[-|•\s]+$/g, "").trim().slice(0, 120) || "Social media service";
}

function quantity(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(POSTGRES_INT_MAX, Math.max(1, Math.trunc(parsed)));
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
    const minQuantity = quantity(item.min);
    const maxQuantity = Math.max(minQuantity, quantity(item.max));
    const metadata: ProviderMetadata = {
      providerServiceId,
      providerName: item.name,
      providerType: item.type,
      providerCategory: item.category,
      providerRateUsd: item.rate,
      minQuantity,
      maxQuantity,
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
        category: detectCategory(item.name, item.category),
        pricePerThousandMinor,
        // Publication is decided after the entire provider catalog is ranked.
        active: false,
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

  // Keep the full PRM4U catalog in admin, but publish only a concise customer
  // selection: at most three differentiated options per platform/service type.
  // Explicit cheap/bot/fake services remain eligible and are labeled honestly.
  const curated = curatePrmCatalog(services);
  const selectedIds = curated.map((item) => item.providerServiceId);

  const selectedRows = selectedIds.length
    ? await prisma.service.findMany({
        where: { provider: "PRM4U", providerServiceId: { in: selectedIds } },
        select: { providerServiceId: true, pricePerThousandMinor: true, active: true },
      })
    : [];
  const selectedById = new Map(selectedRows.map((item) => [item.providerServiceId, item]));

  const pruned = selectedIds.length
    ? await prisma.service.updateMany({
        where: { provider: "PRM4U", active: true, providerServiceId: { notIn: selectedIds } },
        data: { active: false },
      })
    : await prisma.service.updateMany({
        where: { provider: "PRM4U", active: true },
        data: { active: false },
      });

  let selectedDisabledForPrice = 0;
  if (curated.length) {
    const catalogPayload = JSON.stringify(
      curated.map((item) => {
        const current = selectedById.get(item.providerServiceId);
        const active = Boolean(current && current.pricePerThousandMinor > 0);
        if (current?.active && !active) selectedDisabledForPrice += 1;
        return { ...item, active };
      }),
    );

    await prisma.$executeRaw`
      UPDATE public."Service" AS s
      SET
        "displayName" = x."displayName",
        platform = x.platform,
        category = x.category,
        "sortOrder" = x."sortOrder",
        active = x.active,
        "updatedAt" = NOW()
      FROM jsonb_to_recordset(${catalogPayload}::jsonb) AS x(
        "providerServiceId" integer,
        platform text,
        category text,
        tier text,
        "displayName" text,
        "sortOrder" integer,
        active boolean
      )
      WHERE s.provider = 'PRM4U'
        AND s."providerServiceId" = x."providerServiceId"
    `;
  }

  // This all-row write is the completion marker. Any sync that dies before here
  // leaves at least one older row behind and is considered stale on the next run.
  await prisma.service.updateMany({
    where: { provider: "PRM4U" },
    data: { lastProviderSyncAt: now },
  });

  const unpublished = pruned.count + selectedDisabledForPrice;
  const updated = changedRows.length;
  if (actorId) {
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "provider.services.sync",
        entity: "Provider",
        entityId: "PRM4U",
        metadata: { received: services.length, created, updated, unpublished, selected: curated.length },
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
  const freshness = await prisma.service.aggregate({
    where: { provider: "PRM4U" },
    _min: { lastProviderSyncAt: true },
    _count: { _all: true },
  });
  if (freshness._count._all === 0 || !freshness._min.lastProviderSyncAt) return true;
  return Date.now() - freshness._min.lastProviderSyncAt.getTime() > maxAgeMs;
}
