# Dink Promotion

Production-oriented Telegram Mini App for Dink Promotion. The customer-facing app is mobile-first and uses the supplied Dink Promotion logo/green brand. PRM4U is an upstream fulfillment provider; customers never see provider credentials or provider pricing.

## What is implemented

- Telegram Mini App authentication with server-side `initData` validation.
- HttpOnly signed sessions and admin access controlled by Telegram IDs.
- PRM4U API v2 integration: service sync, order placement, status sync, refill, cancel and provider balance.
- Curated-service workflow: synced services are **not** published automatically. Admin sets Dink pricing and enables selected services.
- Customer flows: Home, Services, service details, order creation, Chapa checkout, Dink Wallet payment, My Orders, order tracking, refill/cancel where supported, Wallet, Profile and Support.
- Chapa initialization + callback + signed webhook verification + mandatory server-side transaction re-verification before fulfillment.
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

If the pricing variables are supplied, newly imported PRM4U services receive a suggested Dink price but still remain unpublished. Without them, imported services start at `0` and cannot be enabled until an admin sets a customer price.

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

In the Chapa dashboard, set the webhook URL to:

```text
https://YOUR_DOMAIN/api/payments/chapa/webhook
```

Set the same webhook secret in `CHAPA_WEBHOOK_SECRET`. Dink verifies the webhook signature and then re-queries Chapa's transaction verification endpoint before crediting a wallet or sending an order to PRM4U.

## PRM4U service sync

Open `/admin` from an admin Telegram account and choose **Sync PRM4U services**. Only PRM4U service types compatible with the simple link + quantity order form can be published. Unsupported service types remain visible to admins but cannot be enabled.

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
