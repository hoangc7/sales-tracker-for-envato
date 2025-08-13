# ThemeForest Sales Tracker

A Next.js web application that automatically tracks and monitors sales data from ThemeForest items. The app scans item pages daily and provides comprehensive dashboards to view sales patterns and trends.

## Features

### 📊 **Multi-Dashboard Analytics**
- **Overview Dashboard**: General comparison and current status with table/card views
- **Daily Dashboard**: Hourly sales breakdown (0-24h) with peak hour analysis
- **Weekly Dashboard**: Daily breakdown (Mon-Sun) with weekly performance trends  
- **Monthly Dashboard**: Monthly insights with day-of-month breakdown

### ⚡ **Performance & Caching**
- **Smart Client-Side Caching**: Data cached until next hour (:00 minute) aligned with updates
- **Instant Navigation**: Switch between dashboards with zero loading time after first visit
- **Request Deduplication**: Prevents duplicate API calls during development and navigation
- **Optimized Loading**: Graceful loading states and error handling with cached fallbacks

### 🔄 **Data Collection & Analysis**
- **Automated Hourly Scanning**: Runs every hour in GMT+7 timezone for granular data
- **Historical Date Navigation**: Browse previous days, weeks, and months with validation
- **Advanced Analytics**: Growth trends, peak period analysis, and performance metrics
- **Real-time Data**: Live sales tracking using official Envato API

### 🎨 **User Experience**
- **Interactive UI**: Clean, responsive interface with visual pattern displays
- **Manual Scanning**: Trigger scans manually via web interface (development mode)
- **GMT+7 Timezone**: Perfect for Asian market analysis and sales timing optimization
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

## Tech Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS
- **Backend**: Next.js API routes with comprehensive analytics endpoints
- **Database**: SQLite with Prisma ORM for efficient data storage
- **Caching**: Custom client-side cache with hourly invalidation and request deduplication
- **API Integration**: Envato API for fast and reliable data fetching
- **Scheduling**: GitHub Actions for automated hourly scanning
- **Performance**: Optimized for React Strict Mode and development workflows

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

**Note**: Automated hourly scanning is handled by GitHub Actions, which triggers the `/api/scan` endpoint every hour. This works reliably with Vercel deployments.

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

### Analytics Endpoints  
- `GET /api/analytics/daily?daysAgo=0` - Daily analytics with hourly breakdown (0=today, 1=yesterday, etc.)
- `GET /api/analytics/weekly?weeksAgo=0` - Weekly analytics with daily breakdown (0=current week, etc.)
- `GET /api/analytics/monthly?monthsAgo=0` - Monthly analytics with day breakdown (0=current month, etc.)
- `GET /api/analytics/data-range?type=oldest` - Get oldest available data date for navigation limits

### Caching Behavior
- **Client-Side Cache**: All analytics endpoints are automatically cached until the next hour (:00 minute)
- **Cache Sharing**: Multiple dashboard components share cached data for instant navigation
- **Auto-Refresh**: Cache automatically expires and refreshes when new hourly data is available
- **Development Safe**: Handles React Strict Mode and duplicate component mounting gracefully

## Database Schema

- **Items**: Stores ThemeForest item information (name, url, envatoId, author, category)
- **SalesRecords**: Historical sales data with timestamps for comprehensive trend analysis

## Performance Features

### Smart Caching System
- **Hourly Cache Expiration**: Data cached until next hour at minute 00, perfectly aligned with data updates
- **Global Cache Store**: Single cache shared across all dashboard components for memory efficiency  
- **Request Deduplication**: Prevents duplicate API calls when multiple components mount simultaneously
- **Instant Navigation**: Previously visited dashboards load instantly with cached data
- **Background Invalidation**: Automatic cache expiry detection every minute

### Development Optimizations
- **React Strict Mode Safe**: Handles development double-mounting without duplicate API calls
- **Error Resilience**: Falls back to cached data when network requests fail
- **Loading State Management**: Proper handling of loading/data states prevents rendering issues
- **TypeScript Safety**: Full type safety with null checks for robust component rendering

## License

MIT
