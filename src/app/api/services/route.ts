import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { discountedServicePrice, getDiscountMap } from "@/lib/discounts";
import { detectCategory, detectPlatform } from "@/lib/prm4u";
import { serializeService } from "@/lib/serializers";
import { isPrmCatalogStale, syncPrmServices } from "@/lib/service-sync";

export const dynamic = "force-dynamic";

function customerMinimumLimit(category: string) {
  if (["Followers", "Members", "Subscribers"].includes(category)) return 500;
  if (["Comments", "Poll Votes", "Retweets"].includes(category)) return 100;
  if (["Likes", "Reactions", "Shares", "Saves"].includes(category)) return 500;
  return 1000;
}

function hasProviderPlatformConflict(service: { platform: string; providerCategory: string }) {
  const providerPlatform = detectPlatform("", service.providerCategory || "");
  return providerPlatform !== "Other" && providerPlatform !== service.platform;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform")?.trim();
  const category = searchParams.get("category")?.trim();
  const search = searchParams.get("search")?.trim();
  const featured = searchParams.get("featured") === "true";
  const requestedTake = Math.min(Math.max(Number(searchParams.get("take") || 100), 1), 300);
  // The current Mini App filters its catalog client-side. Return the full current
  // orderable catalog on the initial unfiltered request so a valid service is not
  // silently missing simply because it sorts after the first 300 rows.
  const take = platform || category || search || featured ? requestedTake : 1200;

  const [services, discounts] = await Promise.all([
    prisma.service.findMany({
      where: {
        active: true,
        compatible: true,
        ...(platform && platform !== "All" ? { platform } : {}),
        ...(category && category !== "All" ? { category } : {}),
        ...(featured ? { featured: true } : {}),
        ...(search
          ? {
              OR: [
                { displayName: { contains: search, mode: "insensitive" } },
                { platform: { contains: search, mode: "insensitive" } },
                { category: { contains: search, mode: "insensitive" } },
                { providerCategory: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { pricePerThousandMinor: "asc" }],
      take,
    }),
    getDiscountMap(),
  ]);

  // Provider panels sometimes expose wholesale-only minimums or inconsistent
  // metadata. Keep those rows visible to admins, but never show a YouTube-tagged
  // provider category as TikTok/Instagram (or another conflicting platform) to a customer.
  const visibleServices = services.filter(
    (service) => service.minQuantity <= customerMinimumLimit(detectCategory(service.providerName, service.providerCategory))
      && !hasProviderPlatformConflict(service)
      && !/\b(?:page\s*)?reviews?\b/i.test(`${service.providerName} ${service.providerCategory}`),
  );

  const customerServices = visibleServices.map((service) => {
    const serialized = serializeService(service);
    const discounted = discountedServicePrice(service.pricePerThousandMinor, service.platform, discounts);
    return {
      ...serialized,
      pricePerThousandMinor: discounted.priceMinor,
      originalPricePerThousandMinor: service.pricePerThousandMinor,
      discountPercent: discounted.percent,
    };
  });

  // Keep the customer request fast. When the cached provider catalog is older than
  // ten minutes, refresh it after the response. The sync keeps the full provider
  // catalog in admin and automatically publishes only the curated customer set.
  after(async () => {
    try {
      if (await isPrmCatalogStale()) await syncPrmServices();
    } catch (error) {
      console.error("Automatic PRM4U catalog sync failed", error);
    }
  });

  return NextResponse.json({ services: customerServices });
}
