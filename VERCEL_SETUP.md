# Vercel Deployment Setup

This guide will help you deploy the Tee24 League app to Vercel.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. A Supabase project with:
   - Database configured
   - Storage bucket created (see below)

## Step 1: Set Up Supabase Storage

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the sidebar
3. Click **Create a new bucket**
4. Name it: `scorecards`
5. Make it **Public** (so images can be viewed)
6. Click **Create bucket**

## Step 2: Get Your Supabase Credentials

1. Go to **Settings** → **API** in your Supabase project
2. Copy these values:
   - **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
   - **anon/public key** (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - **Database URL** (DATABASE_URL) - from Settings → Database

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to https://vercel.com/new
3. Import your repository
4. Add environment variables:
   - `DATABASE_URL` - Your Supabase database connection string
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
5. Click **Deploy**

### Option B: Deploy via CLI

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow the prompts and add environment variables when asked

## Step 4: Run Database Migrations

After deployment, you need to run Prisma migrations:

1. Go to your Vercel project settings
2. Navigate to **Settings** → **Environment Variables**
3. Make sure all variables are set
4. Go to **Deployments** tab
5. Click on the latest deployment
6. Open the **Functions** tab
7. Or, run migrations locally with production DATABASE_URL:
   ```bash
   DATABASE_URL="your-production-url" npx prisma db push
   ```

Alternatively, you can add a build script that runs migrations:

```json
"scripts": {
  "postinstall": "prisma generate",
  "vercel-build": "prisma generate && prisma db push && next build"
}
```

## Step 5: Verify Deployment

1. Visit your Vercel deployment URL
2. Test the scorecard upload functionality
3. Check that images are being stored in Supabase Storage

## Environment Variables Summary

Add these to Vercel:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Supabase PostgreSQL connection string | `postgresql://postgres:...@db.xxx.supabase.co:5432/postgres` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

## Troubleshooting

### Images not loading
- Make sure the Supabase Storage bucket is **Public**
- Check that `NEXT_PUBLIC_SUPABASE_URL` is set correctly
- Verify the bucket name is exactly `scorecards`

### Database connection errors
- Verify `DATABASE_URL` is correct
- Check that your Supabase database allows connections from Vercel IPs
- Make sure you're using the connection pooling URL if available

### Build errors
- Make sure `prisma generate` runs during build
- Check that all environment variables are set
- Review build logs in Vercel dashboard

## Post-Deployment

1. Run the seed script to create initial leagues:
   ```bash
   DATABASE_URL="your-production-url" npm run seed
   ```
2. Add your first course through the admin portal or API
3. Start adding players and scores!



