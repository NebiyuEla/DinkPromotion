# Dink Promotion

Production-oriented Telegram Mini App for Dink Promotion. The customer-facing app is mobile-first and uses the supplied Dink Promotion logo/green brand. PRM4U is an upstream fulfillment provider; customers never see provider credentials or provider pricing.

## What is implemented

- Telegram Mini App authentication with server-side `initData` validation.
- HttpOnly signed sessions and admin access controlled by Telegram IDs.
- PRM4U API v2 integration: service sync, order placement, status sync, refill, cancel and provider balance.
- Curated-service workflow: the full PRM4U catalog remains available to admins while the customer catalog automatically exposes a concise Ethiopia-focused selection.
- Customer flows: Home, Services, service details, order creation, direct Telebirr/CBE Birr payment, Dink Wallet payment, My Orders, order tracking, refill/cancel where supported, Wallet, Profile and Support.
- Chapa Telebirr and CBE Birr direct-charge requests, signed webhook verification, and mandatory server-side transaction verification before fulfillment. Older hosted-checkout links remain available for existing pending payments.
- Idempotent wallet top-ups and wallet debits/refunds.
- Provider duplicate-risk protection: ambiguous PRM4U network failures become `PROVIDER_REVIEW` and are not automatically retried. Definitive provider errors become `PROVIDER_ERROR` and can be retried by an admin.
- Responsive admin dashboard for catalog sync, pricing, publish controls, provider balance and order operations.
- PostgreSQL/Prisma backend and health endpoint.
- CI workflow for Prisma generation, typecheck, lint and production build.

## Stack

- Next.js App Router + TypeScript
- PostgreSQL + Prisma
- Telegram Mini Apps
- PRM4U API v2
- Chapa payments

## Required environment variables

Copy `.env.example` to `.env.local` for development. Production must provide:

- `DATABASE_URL`
- `APP_URL`
- `TELEGRAM_BOT_TOKEN`
- `SESSION_SECRET` (32+ random characters)
- `ADMIN_TELEGRAM_IDS` (comma-separated Telegram numeric IDs)
- `PRM4U_API_KEY`
- `CHAPA_SECRET_KEY`
- `CHAPA_WEBHOOK_SECRET`
- `CHAPA_MODE` (`test` or `live`)
- `CRON_SECRET`

Optional:

- `NEXT_PUBLIC_SUPPORT_URL`
- `PRICING_USD_ETB_RATE`
- `DEFAULT_MARKUP_PERCENT`

If the pricing variables are supplied, newly imported PRM4U services receive a suggested Dink price. Customer publication is still controlled by the catalog curation rules and a valid customer price.

## Database

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

The initial migration is committed under `prisma/migrations`.

## Run locally

```bash
npm run dev
```

The Mini App can be browsed outside Telegram, but ordering, wallet and account functionality intentionally require verified Telegram `initData`.

## Telegram setup

Configure your Telegram bot's Mini App URL to your deployed `APP_URL`. Production authentication rejects missing, invalid or expired Telegram init data.

## Chapa setup

The customer checkout asks for a Telebirr or CBE Birr registered Ethiopian mobile number and sends a direct USSD charge request. Enable Direct Charge for both methods on the Chapa merchant account before offering paid services. A successful initiation is pending until the customer approves it and Chapa's transaction verification confirms the amount and reference. Failed or uncertain requests remain attached to their order for review; the app does not send a second request automatically.

In the Chapa dashboard, set the webhook URL to:

```text
https://YOUR_DOMAIN/api/payments/chapa/webhook
```

Set the same webhook secret in `CHAPA_WEBHOOK_SECRET`. Dink verifies the webhook signature and then re-queries Chapa's transaction verification endpoint before crediting a wallet or sending an order to PRM4U.

## PRM4U service sync

Open `/admin` from an admin Telegram account and choose **Sync PRM4U services**. Only PRM4U service types compatible with the simple link + quantity order form can be customer-orderable. Unsupported or filtered services remain available to admins for review.

The customer catalog groups services by platform and action and exposes at most a few differentiated choices instead of raw panel duplicates. Customer-facing tiers are **Cheap / Bot**, **Cheap**, **Standard**, **Fast**, **Stable**, and **Refill** where available. Cheap, bot, or fake-style engagement is intentionally retained when PRM4U supplies it and is labeled transparently rather than being presented as organic traffic.

The curation removes categories that do not fit Dink Promotion's current Ethiopia-focused retail catalog, including adult/NSFW, gambling/casino, crypto promotion, review manipulation, app installs, SEO/backlinks, monetization/watch-time shortcuts, account-verification services, password/login-required services, custom comment lists, and irrelevant country-specific targeting. Wholesale-only services with impractical customer minimums are also hidden from the public catalog while remaining visible to admins.

## Background order status sync

Call the protected endpoint every few minutes from your deployment scheduler:

```text
GET /api/provider/status-sync
Authorization: Bearer <CRON_SECRET>
```

An authenticated admin can also run the same sync manually from the dashboard.

## Production checks before accepting money

1. Database migration applied.
2. Telegram bot Mini App URL points to production.
3. `SESSION_SECRET`, bot token and admin IDs are production values.
4. PRM4U API key works and provider balance is sufficient.
5. Curated services have valid Dink prices and only intended services are published.
6. Chapa live/test mode matches the configured key.
7. Chapa webhook secret and endpoint are configured.
8. Run a real end-to-end test: Telegram auth → order → Chapa payment → webhook verification → PRM4U provider order → provider status sync → completion.

Do not consider the platform production-ready until that real flow has been verified with your actual credentials.
