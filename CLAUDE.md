# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a ThemeForest Sales Tracker built with Next.js, TypeScript, and TailwindCSS. It uses the official Envato API to track sales data hourly with GMT+7 timezone support for competitor analysis and provides comprehensive multi-dashboard analytics.

## Architecture

- **Frontend**: React components in `/src/components/` using TailwindCSS for styling
- **Backend**: Next.js API routes in `/src/app/api/` for data operations and scanning
- **Database**: SQLite with Prisma ORM, schema in `/prisma/schema.prisma`
- **API Integration**: Envato API client in `/src/lib/envato-api.ts`
- **Scheduling**: Node-cron for automated hourly scans in GMT+7 timezone
- **Analytics**: Advanced analytics service with hourly/daily/weekly/monthly calculations
- **Configuration**: Tracked items with Envato IDs in `/src/config/items.ts`

## Key Components

### Dashboard Components
- `Dashboard.tsx`: Main UI with navigation between different views
- `HourlyDashboard.tsx`: Real-time competitor tracking with GMT+7 timezone
- `DailyDashboard.tsx`: Daily sales analytics with hourly breakdowns
- `WeeklyDashboard.tsx`: Weekly performance trends
- `MonthlyDashboard.tsx`: Long-term monthly insights
- `DashboardNavigation.tsx`: Navigation between dashboard views

### Core Components  
- `ItemTable.tsx`: Table view with sticky reference comparison
- `ItemCard.tsx`: Card view for individual items
- `ScanButton.tsx`: Manual scan trigger component

### Services
- `EnvatoApiClient`: API client for fetching item data from Envato
- `AnalyticsService`: Advanced analytics with hourly/daily/weekly/monthly calculations
- `DatabaseService`: Database operations and sales calculations
- `ScannerService`: Orchestrates API calls and data storage

## Development Commands

- `npm run dev`: Start development server with Turbopack
- `npm run build`: Build production version (includes Prisma generation)
- `npm run db:push`: Apply database schema changes
- `npm run db:generate`: Generate Prisma client
- `npm run lint`: Run ESLint
- `npm start`: Start production server

## Database Schema

- **Items**: Stores ThemeForest item info (name, url, envatoId, author, category)
- **SalesRecords**: Historical sales data with timestamps for trend analysis

## API Endpoints

### Core Endpoints
- `GET /api/items`: Returns all tracked items with calculated sales statistics
- `POST /api/scan`: Triggers manual scan of all tracked items
- `POST /api/cron/start`: Starts the automated hourly cron job (GMT+7)

### Analytics Endpoints
- `GET /api/analytics/hourly?hours=24`: Hourly competitor tracking data
- `GET /api/analytics/daily?days=30`: Daily sales analytics
- `GET /api/analytics/weekly?days=90`: Weekly performance trends
- `GET /api/analytics/monthly?days=365`: Monthly insights

## Deployment Considerations

- **Vercel**: Preferred platform, but cron jobs may need external scheduling
- **Heroku**: Alternative with better support for background processes
- **Environment**: Requires `DATABASE_URL`, optional `ENVATO_API_TOKEN` for higher API limits
- **Build**: Includes `prisma generate` in build process via `postinstall`

## Important Files

- `/src/config/items.ts`: Hardcoded list of items to track with Envato IDs
- `/prisma/schema.prisma`: Database schema definition
- `/src/lib/envato-api.ts`: Envato API client for fetching item data
- `vercel.json`: Deployment configuration with function timeouts