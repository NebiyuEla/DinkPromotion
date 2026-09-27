CREATE TABLE public."PricingConfig" (
  id INTEGER NOT NULL DEFAULT 1,
  "usdCostRate" DECIMAL(12,4),
  "sellRate" DECIMAL(12,4) NOT NULL DEFAULT 194,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PricingConfig_pkey" PRIMARY KEY (id),
  CONSTRAINT "PricingConfig_singleton" CHECK (id = 1),
  CONSTRAINT "PricingConfig_sell_rate_positive" CHECK ("sellRate" > 0),
  CONSTRAINT "PricingConfig_cost_rate_positive" CHECK ("usdCostRate" IS NULL OR "usdCostRate" > 0)
);

INSERT INTO public."PricingConfig" (id, "sellRate")
VALUES (1, 194)
ON CONFLICT (id) DO NOTHING;

-- The existing PRM4U catalog was uniformly auto-priced at 280 ETB/USD.
-- Move those auto prices to the requested 194 ETB/USD sell rate. Chapa's
-- processing fee remains separate and is added only when direct payment starts.
UPDATE public."Service"
SET "pricePerThousandMinor" = CEIL(("providerRateUsd"::numeric) * 194 * 100)::integer,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE provider = 'PRM4U'
  AND "providerRateUsd" ~ '^[0-9]+(\.[0-9]+)?$';

CREATE OR REPLACE FUNCTION public.set_prm4u_insert_price()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  configured_sell_rate numeric;
BEGIN
  IF NEW.provider = 'PRM4U' AND NEW."providerRateUsd" ~ '^[0-9]+(\.[0-9]+)?$' THEN
    SELECT "sellRate" INTO configured_sell_rate
    FROM public."PricingConfig"
    WHERE id = 1;

    NEW."pricePerThousandMinor" := CEIL(
      NEW."providerRateUsd"::numeric * COALESCE(configured_sell_rate, 194) * 100
    )::integer;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Service_prm4u_insert_price" ON public."Service";
CREATE TRIGGER "Service_prm4u_insert_price"
BEFORE INSERT ON public."Service"
FOR EACH ROW
EXECUTE FUNCTION public.set_prm4u_insert_price();
