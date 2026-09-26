import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";

const schema = z.object({
  title: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(2500),
  code: z.string().trim().max(50).optional().default(""),
  buttonText: z.string().trim().max(40).optional().default(""),
  buttonUrl: z.string().trim().max(500).optional().default(""),
});

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const input = schema.parse(await request.json());
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("Telegram bot is not configured");

    const fallbackUrl = process.env.APP_URL || "";
    const buttonUrl = input.buttonUrl || fallbackUrl;
    if (input.buttonText && !/^https:\/\//i.test(buttonUrl)) {
      return NextResponse.json({ error: "Button URL must be a valid HTTPS URL" }, { status: 400 });
    }

    const users = await prisma.user.findMany({ select: { telegramId: true } });
    const text = [
      `<b>${escapeHtml(input.title)}</b>`,
      "",
      escapeHtml(input.message),
      input.code ? `\nCode: <code>${escapeHtml(input.code)}</code>` : "",
    ].join("\n").trim();

    const replyMarkup = input.buttonText
      ? { inline_keyboard: [[{ text: input.buttonText, url: buttonUrl }]] }
      : undefined;

    let sent = 0;
    let unavailable = 0;
    let failed = 0;

    for (let index = 0; index < users.length; index += 20) {
      const batch = users.slice(index, index + 20);
      const results = await Promise.allSettled(batch.map(async ({ telegramId }) => {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          }),
          signal: AbortSignal.timeout(12_000),
        });
        const body = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
        if (response.ok && body?.ok) return "sent" as const;
        const description = body?.description || `HTTP ${response.status}`;
        if (response.status === 403 || /blocked|chat not found|user is deactivated/i.test(description)) return "unavailable" as const;
        throw new Error(description);
      }));

      for (const result of results) {
        if (result.status === "fulfilled" && result.value === "sent") sent += 1;
        else if (result.status === "fulfilled" && result.value === "unavailable") unavailable += 1;
        else failed += 1;
      }

      if (index + 20 < users.length) await sleep(900);
    }

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "telegram.broadcast.send",
        entity: "Broadcast",
        metadata: {
          title: input.title,
          code: input.code || null,
          buttonText: input.buttonText || null,
          buttonUrl: input.buttonText ? buttonUrl : null,
          recipients: users.length,
          sent,
          unavailable,
          failed,
        },
      },
    });

    return NextResponse.json({ recipients: users.length, sent, unavailable, failed });
  } catch (error) {
    return jsonError(error);
  }
}
