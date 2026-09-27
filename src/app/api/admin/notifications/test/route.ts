import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { sendTelegramTestNotification } from "@/lib/telegram-notify";

export async function POST() {
  try {
    const admin = await requireAdmin();
    const user = await prisma.user.findUnique({
      where: { id: admin.id },
      select: { telegramId: true },
    });

    if (!user?.telegramId) {
      return NextResponse.json({ error: "Your admin account is not linked to Telegram." }, { status: 400 });
    }

    await sendTelegramTestNotification(user.telegramId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
