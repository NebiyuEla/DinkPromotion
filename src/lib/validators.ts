import { z } from "zod";

export const createOrderSchema = z.object({
  serviceId: z.string().min(1),
  link: z.string().url().max(2048),
  quantity: z.number().int().positive().max(10_000_000),
});

export const payOrderSchema = z.object({
  method: z.enum(["telebirr", "cbebirr", "wallet"]),
  mobile: z.string().trim().max(32).optional(),
});

export const walletTopUpSchema = z.object({
  amountMinor: z.number().int().min(1000).max(5_000_000),
  method: z.enum(["telebirr", "cbebirr"]),
  mobile: z.string().trim().max(32),
  requestId: z.string().uuid(),
});

export const updateServiceSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(240).nullable().optional(),
  platform: z.string().trim().min(2).max(40).optional(),
  category: z.string().trim().min(2).max(60).optional(),
  pricePerThousandMinor: z.number().int().min(0).max(100_000_000).optional(),
  active: z.boolean().optional(),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1_000_000).optional(),
});
