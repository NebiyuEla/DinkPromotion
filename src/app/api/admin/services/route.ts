import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { updateServiceSchema } from "@/lib/validators";
import { z } from "zod";

const patchSchema = z.object({ id: z.string().min(1), patch: updateServiceSchema });

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const take = 50;
    const where = search
      ? {
          OR: [
            { displayName: { contains: search, mode: "insensitive" as const } },
            { providerName: { contains: search, mode: "insensitive" as const } },
            { platform: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      prisma.service.findMany({ where, orderBy: [{ active: "desc" }, { platform: "asc" }, { sortOrder: "asc" }], skip: (page - 1) * take, take }),
      prisma.service.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pages: Math.max(1, Math.ceil(total / take)) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { id, patch } = patchSchema.parse(await request.json());
    const current = await prisma.service.findUnique({ where: { id } });
    if (!current) throw new AppError("Service not found", 404, "SERVICE_NOT_FOUND");
    if (patch.active === true && !current.compatible) {
      throw new AppError("This PRM4U service type is not supported by the current order form", 409, "SERVICE_TYPE_UNSUPPORTED");
    }
    const resultingPrice = patch.pricePerThousandMinor ?? current.pricePerThousandMinor;
    if (patch.active === true && resultingPrice <= 0) {
      throw new AppError("Set a customer price before activating this service", 409, "SERVICE_PRICE_REQUIRED");
    }
    const service = await prisma.service.update({ where: { id }, data: patch });
    await prisma.auditLog.create({
      data: { actorId: admin.id, action: "service.update", entity: "Service", entityId: id, metadata: JSON.parse(JSON.stringify(patch)) },
    });
    return NextResponse.json({ service });
  } catch (error) {
    return jsonError(error);
  }
}
