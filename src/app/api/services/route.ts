import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeService } from "@/lib/serializers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform")?.trim();
  const category = searchParams.get("category")?.trim();
  const search = searchParams.get("search")?.trim();
  const featured = searchParams.get("featured") === "true";
  const take = Math.min(Math.max(Number(searchParams.get("take") || 100), 1), 100);

  const services = await prisma.service.findMany({
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
            ],
          }
        : {}),
    },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { pricePerThousandMinor: "asc" }],
    take,
  });
  return NextResponse.json({ services: services.map(serializeService) });
}
