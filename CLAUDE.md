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
- **Caching**: Client-side cache system with hourly invalidation and request deduplication
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

### Custom Hooks
- `useCachedAPI.ts`: Client-side cache hook with hourly invalidation and request deduplication
- `useOldestDate.ts`: Hook for managing date range navigation validation

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
- `GET /api/analytics/daily?daysAgo=0`: Daily sales analytics (0=today, 1=yesterday, etc.)
- `GET /api/analytics/weekly?weeksAgo=0`: Weekly performance trends (0=current week, etc.)
- `GET /api/analytics/monthly?monthsAgo=0`: Monthly insights (0=current month, etc.)
- `GET /api/analytics/data-range?type=oldest`: Get oldest available data date for navigation

## Deployment Considerations

- **Vercel**: Preferred platform, but cron jobs may need external scheduling
- **Heroku**: Alternative with better support for background processes
- **Environment**: Requires `DATABASE_URL`, optional `ENVATO_API_TOKEN` for higher API limits
- **Build**: Includes `prisma generate` in build process via `postinstall`

## Client-Side Caching System

### Overview
The application uses a sophisticated client-side caching system to minimize API calls and provide instant navigation between dashboards:

- **Cache Duration**: Data is cached until the next hour at minute 00 (aligned with hourly data updates)
- **Global Cache Store**: Shared across all dashboard components for efficient memory usage
- **Request Deduplication**: Prevents duplicate API calls during React Strict Mode or concurrent component mounting
- **Automatic Invalidation**: Background monitoring checks for cache expiration every minute
- **Error Resilience**: Falls back to cached data on network errors

### Cache Implementation
- **Hook**: `useCachedAPI<T>(url, dependencies, enabled)` in `/src/hooks/useCachedAPI.ts`
- **Cache Key**: `${url}:${JSON.stringify(dependencies)}` for precise cache management
- **Expiration Logic**: `Date.now() < entry.expiresAt` where `expiresAt` is next hour at :00 minute
- **Deduplication**: Global `fetchPromises` store prevents concurrent requests to same endpoint

### Benefits
- **Instant Navigation**: Switching between cached dashboards is instantaneous
- **Reduced Server Load**: API calls only when data is stale or unavailable
- **Better UX**: No loading screens when returning to previously visited dashboards
- **Development Friendly**: Handles React Strict Mode double-mounting gracefully

## Performance Optimizations

### Duplicate API Call Prevention
- **Global Request Deduplication**: Concurrent requests to same endpoint share results
- **React Strict Mode Safe**: Handles development double-mounting without duplicate calls
- **Loading State Management**: Proper loading/data state handling prevents render issues

### Dashboard Components
- **Null Safety**: All dashboard components check `if (loading || !items)` before rendering
- **Error Boundaries**: Graceful error handling with fallback to cached data
- **Lazy Navigation**: Date range validation only loads when needed

## Important Files

- `/src/config/items.ts`: Hardcoded list of items to track with Envato IDs
- `/prisma/schema.prisma`: Database schema definition
- `/src/lib/envato-api.ts`: Envato API client for fetching item data
- `/src/hooks/useCachedAPI.ts`: Client-side caching system with request deduplication
- `vercel.json`: Deployment configuration with function timeouts