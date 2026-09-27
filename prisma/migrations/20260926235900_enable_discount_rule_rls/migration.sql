-- Discount rules are managed only through authenticated server-side Prisma routes.
-- Keep the table unavailable through Supabase's public Data API.
ALTER TABLE public."DiscountRule" ENABLE ROW LEVEL SECURITY;
