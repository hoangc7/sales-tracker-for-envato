# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a ThemeForest Sales Tracker built with Next.js, TypeScript, and TailwindCSS. It uses the official Envato API to track sales data for ThemeForest items and provides a dashboard to view analytics.

## Architecture

- **Frontend**: React components in `/src/components/` using TailwindCSS for styling
- **Backend**: Next.js API routes in `/src/app/api/` for data operations and scanning
- **Database**: SQLite with Prisma ORM, schema in `/prisma/schema.prisma`
- **API Integration**: Envato API client in `/src/lib/envato-api.ts`
- **Scheduling**: Node-cron for automated daily scans at midnight UTC
- **Configuration**: Tracked items with Envato IDs in `/src/config/items.ts`

## Key Components

- `Dashboard.tsx`: Main UI component displaying all tracked items
- `ItemCard.tsx`: Individual item display with sales statistics
- `ScanButton.tsx`: Manual scan trigger component
- `EnvatoApiClient`: API client for fetching item data from Envato
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

- `GET /api/items`: Returns all tracked items with calculated sales statistics
- `POST /api/scan`: Triggers manual scan of all tracked items
- `POST /api/cron/start`: Starts the automated daily cron job

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