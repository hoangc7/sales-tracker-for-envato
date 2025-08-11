# ThemeForest Sales Tracker

A Next.js web application that automatically tracks and monitors sales data from ThemeForest items. The app scans item pages daily and provides comprehensive dashboards to view sales patterns and trends.

## Features

- **Multi-Dashboard Analytics**: Overview, Daily, Weekly, and Monthly sales dashboards with detailed breakdowns
- **Hourly Pattern Analysis**: See which hours items sell the most (0-24h breakdown)
- **Weekly Pattern Analysis**: Discover which days of the week perform best (Mon-Sun breakdown)
- **Monthly Pattern Analysis**: Track seasonal trends and peak months (Jan-Dec breakdown)
- **Automated Hourly Scanning**: Runs every hour in GMT+7 timezone to collect granular sales data
- **Advanced Analytics**: Growth trends, peak period analysis, and performance metrics
- **Interactive UI**: Clean, responsive interface with visual pattern displays
- **Real-time Data**: Live sales tracking using official Envato API
- **Historical Insights**: Track sales patterns across different time periods
- **GMT+7 Timezone**: Perfect for Asian market analysis and sales timing optimization
- **Manual Scanning**: Trigger scans manually via the web interface
- **Database Storage**: SQLite database for storing comprehensive historical data

## Tech Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS
- **Backend**: Next.js API routes
- **Database**: SQLite with Prisma ORM
- **API Integration**: Envato API for fast and reliable data fetching
- **Scheduling**: node-cron for automated scanning

## Getting Started

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   ```bash
   npm run db:push
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Adding Items to Track

Edit `/src/config/items.ts` to add your ThemeForest items:

```typescript
export const TRACKED_ITEMS = [
  {
    name: "Your Item Name",
    envatoId: "1234567", // Extract from the ThemeForest URL
    url: "https://themeforest.net/item/your-item/1234567",
  },
  // Add more items...
];
```

**Note**: The `envatoId` is the number at the end of the ThemeForest URL.

## Deployment

### Vercel (Recommended)

1. Push your code to a Git repository
2. Connect your repository to [Vercel](https://vercel.com)
3. Set environment variables in Vercel dashboard:
   - `DATABASE_URL`: Your database connection string
4. Deploy!

**Note**: The automated hourly cron job may not work on Vercel's free tier due to serverless function limitations. Consider using Vercel Cron Jobs or external cron services.

### Heroku

1. Create a new Heroku app
2. Add the Heroku Postgres add-on (or use SQLite)
3. Set environment variables:
   ```bash
   heroku config:set DATABASE_URL="your_database_url"
   ```
4. Deploy via Git:
   ```bash
   git push heroku main
   ```

## Environment Variables

- `DATABASE_URL`: Database connection string (required)
- `ENVATO_API_TOKEN`: Optional Envato API token for higher rate limits (get one from [Envato API](https://build.envato.com/api/))

## API Endpoints

### Core Endpoints
- `GET /api/items` - Fetch all tracked items with current sales data
- `POST /api/scan` - Trigger a manual scan of all tracked items
- `POST /api/cron/start` - Start the automated hourly cron job

### Analytics Endpoints  
- `GET /api/analytics/daily?days=30` - Daily analytics with hourly breakdown (0-24h)
- `GET /api/analytics/weekly?days=90` - Weekly analytics with daily breakdown (Mon-Sun)
- `GET /api/analytics/monthly?days=365` - Monthly analytics with monthly breakdown (Jan-Dec)

## Database Schema

- **Items**: Stores ThemeForest item information
- **SalesRecords**: Historical sales data with timestamps

## License

MIT
