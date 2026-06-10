# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ThemeForest Sales Tracker built with Next.js 15, TypeScript, TailwindCSS 4, and Recharts. Uses the Envato API to track cumulative sales data across configurable items, stores snapshots in a PostgreSQL database via Prisma, and provides multi-level analytics dashboards (daily/weekly/monthly) with heatmap visualizations and item detail charts.

**Primary use case**: Competitor analysis — compare your ThemeForest item's sales against competitors over time.

## Technology Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 15.5.x (App Router) |
| Frontend | React 19, TailwindCSS 4, Recharts 3 |
| Backend | Next.js API Routes |
| Database | PostgreSQL (Prisma ORM) |
| Language | TypeScript 5 |
| Node Runtime TZ | `TZ=Australia/Melbourne` (enforced in all npm scripts) |
| Display TZ | Asia/Bangkok (GMT+7) used in analytics calculations |

## Architecture

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/
│   │   ├── scan/route.ts           # POST — trigger manual scan
│   │   ├── scan/status/route.ts    # GET  — scan history & health stats
│   │   ├── items/route.ts          # GET  — all items with latest stats
│   │   └── analytics/
│   │       ├── daily/route.ts      # GET ?daysAgo=N
│   │       ├── weekly/route.ts     # GET ?weeksAgo=N
│   │       ├── monthly/route.ts    # GET ?monthsAgo=N
│   │       └── data-range/route.ts # GET ?type=oldest|newest
│   ├── page.tsx                    # Overview (auto-scan if stale >6h)
│   ├── daily/page.tsx
│   ├── weekly/page.tsx
│   ├── monthly/page.tsx
│   ├── scan-history/page.tsx       # Cron job monitoring
│   └── items/[envatoId]/page.tsx   # Per-item detail with 3 charts
├── components/
│   ├── DashboardLayout.tsx         # Header + nav + footer wrapper
│   ├── DashboardNavigation.tsx     # Tab nav (Overview/Daily/Weekly/Monthly)
│   ├── ItemTable.tsx               # Overview table with reference comparison
│   ├── ItemCard.tsx                # Card grid view
│   ├── DailyDashboard.tsx          # 24-hour heatmap
│   ├── WeeklyDashboard.tsx         # 7-day heatmap (Mon–Sun)
│   ├── MonthlyDashboard.tsx        # 31-day heatmap
│   ├── ItemDetailPage.tsx          # Per-item analytics with bar charts
│   ├── CronJobMonitor.tsx          # Scan history & statistics panel
│   ├── ScanButton.tsx              # Manual scan trigger
│   └── ViewToggle.tsx              # Table/Cards view toggle
├── hooks/
│   ├── useCachedAPI.ts             # Client-side cache (1-hour expiry, dedup)
│   └── useOldestDate.ts            # Navigation boundary from oldest data point
├── lib/
│   ├── envato-api.ts               # Envato API v3 client
│   ├── scanner.ts                  # Batch scan orchestration
│   ├── database.ts                 # Prisma CRUD + sales delta calculations
│   ├── analytics.ts                # Hourly/daily/weekly/monthly aggregations
│   ├── timezone.ts                 # Timezone utility functions
│   └── cache.ts                    # Cache tags and revalidation config
└── config/
    └── items.ts                    # Tracked items list (Envato IDs)
```

## Development Commands

```bash
npm run dev        # Start dev server with Turbopack (TZ=Australia/Melbourne)
npm run build      # prisma generate + next build
npm start          # Production server
npm run lint       # ESLint
npm run db:push    # Apply schema changes to DB (no migration history)
npm run db:migrate # Create and apply a Prisma migration
npm run db:generate # Regenerate Prisma client
```

`TZ=Australia/Melbourne` is prepended to every script — never remove it as all date boundary calculations depend on the server clock being in Melbourne time.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ENVATO_API_TOKEN` | No | Bearer token for higher Envato API rate limits |

## Database Schema

### `Item`
- `id` — CUID primary key
- `name`, `url` (unique), `envatoId` (unique), `author`, `category`
- `createdAt`, `updatedAt`
- Relation: `salesRecords[]`

### `SalesRecord`
- `id` — CUID primary key
- `itemId` — FK → Item (cascade delete)
- `salesCount` (Int) — **cumulative** total at scan time
- `price` (Float, optional)
- `scannedAt` — indexed with `itemId` and independently

### `ScanHistory`
- `id`, `startedAt`, `completedAt`, `status` (RUNNING|COMPLETED|FAILED)
- `itemsScanned`, `error`

Sales are stored as **cumulative snapshots**, not deltas. All analytics derive per-period sales by computing `record[n].salesCount - record[n-1].salesCount`.

## API Reference

### `POST /api/scan`
Triggers a scan of all tracked items. Rate-limited:
- Returns **409** if a scan is already running
- Returns **429** if last scan was <45 minutes ago
- Processes items in batches of 3 with 200ms delay between batches
- 10-minute overall timeout

### `GET /api/scan/status`
Returns scan health metrics: current status, last successful scan, total/success/failed counts, and last 10 scan records.

### `GET /api/items`
All tracked items with `latestSales`, `latestPrice`, `lastScanned`, `weeklySales` (current Mon–Sun calendar week), and `dailySales` (7-day array).

### `GET /api/analytics/daily?daysAgo=N`
24-hour breakdown. `daysAgo=0` is today (Melbourne time). Returns per-item `hourlyBreakdown[24]`, `totalDailySales`, `peakHour`, `peakHourSales`, `growth`, `dayStart`, `dayEnd`.

### `GET /api/analytics/weekly?weeksAgo=N`
7-day breakdown (Mon–Sun). Returns per-item `dailyBreakdown[7]`, `totalWeeklySales`, `peakDay`, `growth`, `weekStart`, `weekEnd`.

### `GET /api/analytics/monthly?monthsAgo=N`
Daily breakdown for the full month. Returns per-item `dailyBreakdown[1..31]`, `totalMonthlySales`, `peakDay`, `growth`, `monthStart`, `monthEnd`.

### `GET /api/analytics/data-range?type=oldest|newest`
Returns the oldest/newest scan timestamps; used to disable "previous" navigation buttons. Cached 24 hours on the client.

## Key Conventions

### Timezone Handling
- **Server clock**: `TZ=Australia/Melbourne` — all `new Date()` calls reflect Melbourne time
- **Display timezone**: Asia/Bangkok (GMT+7) — `lib/timezone.ts` functions convert UTC dates for analytics grouping
- When adding date logic, always use `timezone.ts` helpers; never rely on `getHours()` directly

### Sales Delta Calculation
Raw data is cumulative. The pattern everywhere is:
```ts
const delta = records[i].salesCount - records[i - 1].salesCount;
```
Negative deltas are clamped to 0 (can occur after item removal/re-listing).

### Adding a New Tracked Item
Edit `/src/config/items.ts` and add to the array:
```ts
{ name: "Item Name", url: "https://themeforest.net/item/...", envatoId: "12345678" }
```
The scanner will create the DB row automatically on next scan via `initializeDatabase()`.

### Client-Side Caching (`useCachedAPI`)
- Cache key: `${url}:${JSON.stringify(dependencies)}`
- Expiry: aligned to the next `:00` minute of the current hour
- Global `fetchPromises` map deduplicates concurrent requests (React Strict Mode safe)
- Always pass `enabled` flag to prevent fetching before required params are known

### Component Patterns
- All dashboard components guard with `if (loading || !items) return <Skeleton />`
- Reference item for comparison = `items[0]` (first in the config list)
- Heatmap intensity = `salesCount / maxSalesInColumn` — darker = more sales
- Navigation "previous" buttons are disabled via `useOldestDate` bounds checking

## Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `ItemTable` / `ItemCard` | Overview; auto-scans if data >6h stale |
| `/daily` | `DailyDashboard` | 24-hour heatmap with navigation |
| `/weekly` | `WeeklyDashboard` | 7-day heatmap with navigation |
| `/monthly` | `MonthlyDashboard` | Monthly heatmap with navigation |
| `/items/[envatoId]` | `ItemDetailPage` | Per-item bar charts (daily/weekly/monthly) |
| `/scan-history` | `CronJobMonitor` | Scan log, health stats, manual trigger |

## Deployment

- **Platform**: Vercel (preferred)
- **`vercel.json`**: Sets `maxDuration: 300` (5 min) for all API routes — required for long scans
- **Cron jobs**: Must be scheduled externally (Vercel Cron, GitHub Actions, etc.) — there is no in-process scheduler
- **Build**: `postinstall` runs `prisma generate` automatically after `npm install`

## Important Files

| File | Purpose |
|------|---------|
| `/src/config/items.ts` | Add/remove tracked ThemeForest items |
| `/prisma/schema.prisma` | Database schema |
| `/src/lib/envato-api.ts` | Envato API v3 client |
| `/src/lib/analytics.ts` | All sales aggregation logic |
| `/src/lib/timezone.ts` | Timezone helpers (use these, not raw Date methods) |
| `/src/hooks/useCachedAPI.ts` | Client caching — modify carefully to avoid stale data bugs |
| `vercel.json` | Deployment config |
