# ThemeForest Sales Tracker - Deployment Guide

This guide covers deploying the ThemeForest Sales Tracker to Vercel with automated hourly scanning using GitHub Actions.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Vercel Deployment](#vercel-deployment)
- [GitHub Actions Setup](#github-actions-setup)
- [Environment Variables](#environment-variables)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- GitHub repository with your code
- Vercel account (free plan is sufficient)
- Node.js 18+ locally for testing

## Vercel Deployment

### 1. Connect Repository to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"New Project"**
3. Import your GitHub repository
4. Select **"Next.js"** as the framework preset
5. Click **"Deploy"**

### 2. Configure Build Settings

Vercel will automatically detect:
- **Framework**: Next.js
- **Build Command**: `npm run build` (includes `prisma generate`)
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### 3. Set Environment Variables

In Vercel Dashboard → Project → Settings → Environment Variables:

#### Required Variables:
```bash
DATABASE_URL=file:./dev.db
ENVATO_API_TOKEN=your_envato_token_here
```

**Note**: For production, consider using a cloud database (PlanetScale, Railway, etc.) instead of SQLite.

### 4. Deploy

1. Vercel will automatically deploy on every push to main branch
2. Your app will be available at: `https://your-app-name.vercel.app`
3. Initial deployment may take 2-3 minutes

## GitHub Actions Setup

### 1. Create Workflow File

The workflow file is already created at `.github/workflows/cron.yml`:

```yaml
name: Hourly Sales Scan

on:
  schedule:
    # Run every hour at minute 0 (UTC)
    - cron: '0 * * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sales Scan
        run: |
          curl -X POST "${{ secrets.VERCEL_URL }}/api/scan" \
            -H "Content-Type: application/json" \
            --max-time 300 \
            --retry 2
```

### 2. Configure GitHub Secrets

In GitHub Repository → Settings → Secrets and variables → Actions:

1. Click **"New repository secret"**
2. Add the following secret:

```bash
Name: VERCEL_URL
Value: https://your-app-name.vercel.app
```

**Important**: Replace `your-app-name` with your actual Vercel app URL.

### 3. Enable Actions

1. Go to your GitHub repository
2. Click **"Actions"** tab
3. If prompted, click **"I understand my workflows, go ahead and enable them"**
4. The workflow will automatically start running every hour

### 4. Manual Testing

To test immediately:
1. Go to Actions tab in GitHub
2. Click on **"Hourly Sales Scan"** workflow
3. Click **"Run workflow"** button
4. Check the logs to ensure it completes successfully

## Environment Variables

### Vercel Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | Database connection string | `file:./dev.db` |
| `ENVATO_API_TOKEN` | No | Envato API token for higher limits | `your_token_here` |

### GitHub Secrets

| Secret | Required | Description | Example |
|--------|----------|-------------|---------|
| `VERCEL_URL` | Yes | Your Vercel app URL | `https://sales-tracker.vercel.app` |

## Database Considerations

### SQLite (Default)
- ✅ Easy setup, no external dependencies
- ✅ Perfect for small to medium data
- ❌ Limited concurrent connections
- ❌ No automatic backups

### Cloud Database (Recommended for Production)
Consider upgrading to:
- **PlanetScale** (MySQL)
- **Railway PostgreSQL**
- **Supabase PostgreSQL**

Update `DATABASE_URL` accordingly:
```bash
# PostgreSQL example
DATABASE_URL="postgresql://user:password@host:5432/database"

# MySQL example
DATABASE_URL="mysql://user:password@host:3306/database"
```

## Verification

### 1. Check Deployment
- Visit your Vercel URL
- Verify the app loads correctly
- Check that auto-scan works (should scan if no data exists)

### 2. Test Manual Scan
```bash
curl -X POST https://your-app-name.vercel.app/api/scan
```

Expected response:
```json
{"success": true, "message": "Scan completed successfully"}
```

### 3. Verify GitHub Actions
1. Go to GitHub → Actions tab
2. Look for green checkmarks on "Hourly Sales Scan" runs
3. Check execution logs for any errors

### 4. Monitor Data Collection
- Check your app after 1-2 hours
- Verify new sales records appear in the database
- Look for updated "Last Scanned" timestamps

## Troubleshooting

### Common Issues

#### 1. GitHub Actions Not Running
**Symptoms**: No hourly scans happening
**Solutions**:
- Check if `VERCEL_URL` secret is set correctly
- Verify workflow file is in `.github/workflows/cron.yml`
- Ensure Actions are enabled in repository settings

#### 2. API Scan Timeout
**Symptoms**: GitHub Actions fail with timeout
**Solutions**:
- Increase `--max-time` in cron.yml (default: 300s)
- Check Vercel function logs for errors
- Verify Envato API is accessible

#### 3. Database Connection Issues
**Symptoms**: "Database connection failed" errors
**Solutions**:
- Verify `DATABASE_URL` in Vercel environment variables
- For cloud databases, check connection string format
- Ensure database allows connections from Vercel IPs

#### 4. Missing Sales Data
**Symptoms**: App loads but shows no sales data
**Solutions**:
- Manually trigger scan: `/api/scan`
- Check if items are configured in `src/config/items.ts`
- Verify Envato API responses in Vercel function logs

#### 5. Build Failures
**Symptoms**: Deployment fails during build
**Solutions**:
- Check Vercel build logs
- Ensure `prisma generate` runs during build (included in `package.json` postinstall)
- Verify all dependencies are in `package.json`

### Monitoring

#### Vercel Function Logs
1. Vercel Dashboard → Project → Functions tab
2. Click on any function to see recent invocations
3. Look for `/api/scan` executions every hour

#### GitHub Actions Logs
1. GitHub Repository → Actions tab
2. Click on any "Hourly Sales Scan" run
3. Expand "Trigger Sales Scan" step to see curl output

#### Application Monitoring
- Check "Last Scanned" times in the UI
- Monitor sales data updates hourly
- Watch for any error messages in the dashboard

## Scaling Considerations

### For Heavy Usage:
1. **Database**: Migrate to cloud database (PostgreSQL/MySQL)
2. **Caching**: Add Redis cache for frequently accessed data
3. **Rate Limiting**: Implement API rate limiting
4. **Monitoring**: Add error tracking (Sentry, LogRocket)
5. **Backup**: Implement database backup strategy

### For Multiple Competitors:
1. Update `src/config/items.ts` with additional Envato IDs
2. Consider batch processing for large item lists
3. Monitor Envato API rate limits
4. Add progress indicators for long scans

## Support

For issues:
1. Check Vercel function logs
2. Check GitHub Actions execution logs
3. Verify environment variables are set correctly
4. Test API endpoints manually with curl

The system is designed to be resilient - if occasional scans fail, the next hourly scan will catch up automatically.
