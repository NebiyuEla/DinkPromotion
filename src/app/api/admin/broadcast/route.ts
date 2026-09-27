import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 2_500_000;
const IMAGE_DATA_URL_LIMIT = 3_600_000;

const schema = z.object({
  title: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(2500),
  code: z.string().trim().max(50).optional().default(""),
  buttonText: z.string().trim().max(40).optional().default(""),
  buttonUrl: z.string().trim().max(500).optional().default(""),
  imageDataUrl: z.string().max(IMAGE_DATA_URL_LIMIT).optional().default(""),
});

type TelegramBody = {
  ok?: boolean;
  description?: string;
  result?: {
    photo?: Array<{ file_id: string }>;
  };
};

type ImageUpload = {
  bytes: ArrayBuffer;
  mime: "image/jpeg" | "image/png" | "image/webp";
  filename: string;
};

type DeliveryResult = "sent" | "unavailable";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeImage(dataUrl: string): ImageUpload | null {
  if (!dataUrl) return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Image must be a JPG, PNG or WebP file.");

  const mime = match[1] as ImageUpload["mime"];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) throw new Error("The selected image is empty.");
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Image must be 2.5 MB or smaller.");

  const extension = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  const bytes = Uint8Array.from(buffer).buffer as ArrayBuffer;
  return { bytes, mime, filename: `dink-promotion-broadcast.${extension}` };
}

function classifyTelegramFailure(status: number, description: string): DeliveryResult | null {
  if (status === 403 || /blocked|chat not found|user is deactivated/i.test(description)) return "unavailable";
  return null;
}

async function sendTextMessage(input: {
  token: string;
  telegramId: string;
  text: string;
  replyMarkup?: object;
}): Promise<DeliveryResult> {
  const response = await fetch(`https://api.telegram.org/bot${input.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: input.telegramId,
      text: input.text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
    }),
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.json().catch(() => null) as TelegramBody | null;
  if (response.ok && body?.ok) return "sent";
  const description = body?.description || `HTTP ${response.status}`;
  const classified = classifyTelegramFailure(response.status, description);
  if (classified) return classified;
  throw new Error(description);
}

async function uploadPhoto(input: {
  token: string;
  telegramId: string;
  image: ImageUpload;
  caption?: string;
  replyMarkup?: object;
}): Promise<{ result: DeliveryResult; fileId?: string }> {
  const form = new FormData();
  form.append("chat_id", input.telegramId);
  form.append("photo", new Blob([input.image.bytes], { type: input.image.mime }), input.image.filename);
  if (input.caption) {
    form.append("caption", input.caption);
    form.append("parse_mode", "HTML");
  }
  if (input.replyMarkup) form.append("reply_markup", JSON.stringify(input.replyMarkup));

  const response = await fetch(`https://api.telegram.org/bot${input.token}/sendPhoto`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => null) as TelegramBody | null;
  if (response.ok && body?.ok) {
    const photos = body.result?.photo || [];
    return { result: "sent", fileId: photos.at(-1)?.file_id };
  }

  const description = body?.description || `HTTP ${response.status}`;
  const classified = classifyTelegramFailure(response.status, description);
  if (classified) return { result: classified };
  throw new Error(description);
}

async function sendPhotoByFileId(input: {
  token: string;
  telegramId: string;
  fileId: string;
  caption?: string;
  replyMarkup?: object;
}): Promise<DeliveryResult> {
  const response = await fetch(`https://api.telegram.org/bot${input.token}/sendPhoto`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: input.telegramId,
      photo: input.fileId,
      ...(input.caption ? { caption: input.caption, parse_mode: "HTML" } : {}),
      ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
    }),
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.json().catch(() => null) as TelegramBody | null;
  if (response.ok && body?.ok) return "sent";
  const description = body?.description || `HTTP ${response.status}`;
  const classified = classifyTelegramFailure(response.status, description);
  if (classified) return classified;
  throw new Error(description);
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const input = schema.parse(await request.json());
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) throw new Error("Telegram bot is not configured");

    let image: ImageUpload | null = null;
    try {
      image = decodeImage(input.imageDataUrl);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid image" }, { status: 400 });
    }

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

    const useFullCaption = image && text.length <= 900;
    const photoCaption = image ? (useFullCaption ? text : `<b>${escapeHtml(input.title)}</b>`) : undefined;
    const photoMarkup = useFullCaption ? replyMarkup : undefined;

    let sent = 0;
    let unavailable = 0;
    let failed = 0;
    let reusablePhotoId: string | null = null;
    let nextUserIndex = 0;

    if (image) {
      for (; nextUserIndex < users.length; nextUserIndex += 1) {
        const { telegramId } = users[nextUserIndex];
        try {
          const uploaded = await uploadPhoto({ token, telegramId, image, caption: photoCaption, replyMarkup: photoMarkup });
          if (uploaded.result === "unavailable") {
            unavailable += 1;
            continue;
          }
          if (!uploaded.fileId) throw new Error("Telegram did not return a reusable photo file ID");
          reusablePhotoId = uploaded.fileId;

          if (!useFullCaption) {
            const followup = await sendTextMessage({ token, telegramId, text, replyMarkup });
            if (followup === "unavailable") unavailable += 1;
            else sent += 1;
          } else {
            sent += 1;
          }
          nextUserIndex += 1;
          break;
        } catch {
          failed += 1;
        }
      }
    }

    for (let index = nextUserIndex; index < users.length; index += 20) {
      const batch = users.slice(index, index + 20);
      const results = await Promise.allSettled(batch.map(async ({ telegramId }) => {
        if (!image || !reusablePhotoId) {
          return sendTextMessage({ token, telegramId, text, replyMarkup });
        }

        const photoResult = await sendPhotoByFileId({
          token,
          telegramId,
          fileId: reusablePhotoId,
          caption: photoCaption,
          replyMarkup: photoMarkup,
        });
        if (photoResult === "unavailable") return photoResult;
        if (!useFullCaption) return sendTextMessage({ token, telegramId, text, replyMarkup });
        return "sent" as const;
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
          hasImage: Boolean(image),
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
