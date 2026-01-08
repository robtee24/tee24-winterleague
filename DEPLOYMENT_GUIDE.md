# 🚀 Deployment Guide: Tee24 League to Vercel

This guide will walk you through deploying your Tee24 League application to Vercel at `league.tee24.golf`.

## Prerequisites

- ✅ GitHub account
- ✅ Vercel account (sign up at https://vercel.com if needed)
- ✅ Supabase account (for database and storage)
- ✅ Domain access to `tee24.golf` (for DNS configuration)

---

## Step 1: Prepare Your Code for GitHub

### 1.1 Initialize Git Repository (if not already done)

```bash
cd /Users/robertgilliam/Tee24-League
git init
git add .
git commit -m "Initial commit - Ready for deployment"
```

### 1.2 Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `tee24-league` (or your preferred name)
3. Set it to **Private** (recommended) or **Public**
4. **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click **Create repository**

### 1.3 Push Code to GitHub

GitHub will show you commands. Run these in your terminal:

```bash
git remote add origin https://github.com/YOUR_USERNAME/tee24-league.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 2: Set Up Supabase (Database & Storage)

### 2.1 Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Fill in:
   - **Name**: Tee24 League (or your choice)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to your users
4. Click **Create new project**
5. Wait 2-3 minutes for project to initialize

### 2.2 Create Storage Bucket

1. In your Supabase project, click **Storage** in the left sidebar
2. Click **Create a new bucket**
3. Name: `scorecards` (exactly this name)
4. **Make it Public** (toggle ON) - this is important!
5. Click **Create bucket**

### 2.3 Get Your Supabase Credentials

**For Database:**
1. Go to **Settings** → **Database**
2. Scroll to **Connection string** section
3. Click **URI** tab
4. Copy the connection string (looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`)
5. Replace `[YOUR-PASSWORD]` with your actual database password

**For API Keys:**
1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** → This is `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → This is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Scroll down to find **service_role** key → This is `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

---

## Step 3: Deploy to Vercel

### 3.1 Import Project to Vercel

1. Go to https://vercel.com/dashboard
2. Click **Add New...** → **Project**
3. Click **Import Git Repository**
4. Find and select your `tee24-league` repository
5. Click **Import**

### 3.2 Configure Project Settings

**Framework Preset:** Next.js (should auto-detect)

**Root Directory:** `./` (leave as default)

**Build Command:** `prisma generate && next build` (should auto-fill)

**Output Directory:** `.next` (should auto-fill)

**Install Command:** `npm install` (should auto-fill)

### 3.3 Add Environment Variables

Click **Environment Variables** and add these:

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `DATABASE_URL` | `postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres` | Replace YOUR_PASSWORD with actual password |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` | Your anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | Your service role key (keep secret!) |

**Important:** 
- Make sure all variables are added for **Production**, **Preview**, and **Development** environments
- Click **Save** after adding each variable

### 3.4 Deploy

1. Click **Deploy**
2. Wait 2-5 minutes for the build to complete
3. You'll get a URL like: `https://tee24-league-xxx.vercel.app`

---

## Step 4: Set Up Custom Domain (league.tee24.golf)

### 4.1 Add Domain in Vercel

1. In your Vercel project, go to **Settings** → **Domains**
2. Enter: `league.tee24.golf`
3. Click **Add**
4. Vercel will show you DNS records to add

### 4.2 Configure DNS

You need to add a DNS record in your domain provider (where `tee24.golf` is managed):

**Type:** `CNAME`  
**Name:** `league`  
**Value:** `cname.vercel-dns.com` (or the value Vercel provides)

**OR if your DNS provider doesn't support CNAME for root domains:**

**Type:** `A`  
**Name:** `league`  
**Value:** Vercel's IP address (Vercel will show this)

### 4.3 Wait for DNS Propagation

- DNS changes can take 5 minutes to 48 hours
- Vercel will show "Valid Configuration" when it's ready
- You can check status in Vercel dashboard

---

## Step 5: Initialize Database

### 5.1 Run Database Migrations

After deployment, you need to set up your database schema:

**Option A: Via Vercel CLI (Recommended)**

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link to your project
vercel link

# Set environment variables locally (optional, for local testing)
vercel env pull .env.local

# Run migrations
npx prisma db push
```

**Option B: Via Supabase SQL Editor**

1. Go to Supabase → **SQL Editor**
2. Run the Prisma schema manually (or use `prisma migrate`)

**Option C: Via Vercel Build (Automatic)**

The build process should run `prisma generate`, but you may need to manually push the schema the first time.

### 5.2 Seed Initial Data

Run the seed script to create initial leagues:

```bash
# Set your production DATABASE_URL
export DATABASE_URL="your-production-database-url"

# Run seed
npm run seed
```

Or do it manually through the admin portal after deployment.

---

## Step 6: Verify Deployment

### 6.1 Test the Application

1. Visit `https://league.tee24.golf`
2. Test these features:
   - ✅ Home page loads
   - ✅ League selection works
   - ✅ Score submission flow
   - ✅ Image upload (check Supabase Storage)
   - ✅ Admin portal (`/league-manager`)
   - ✅ Leaderboard
   - ✅ All pages load correctly

### 6.2 Check Logs

1. In Vercel dashboard, go to **Deployments**
2. Click on your deployment
3. Check **Logs** for any errors
4. Check **Functions** tab for API route logs

---

## Step 7: Post-Deployment Setup

### 7.1 Add Initial Data

1. Go to `https://league.tee24.golf/league-manager`
2. Enter password: `CABenson123$`
3. Select a league
4. Add players
5. Add courses for each week

### 7.2 Configure Leagues

Make sure both leagues (Clarksville and Louisville) exist:
- If not, they'll be created when you first access the admin portal
- Or run the seed script: `npm run seed`

---

## Troubleshooting

### Build Fails

**Error: "Prisma Client not generated"**
- Solution: The build command should include `prisma generate`
- Check `vercel.json` has: `"buildCommand": "prisma generate && next build"`

**Error: "Database connection failed"**
- Check `DATABASE_URL` is correct in Vercel environment variables
- Verify Supabase database is running
- Check if password has special characters (may need URL encoding)

### Images Not Uploading

**Error: "Supabase not configured"**
- Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set (for server-side uploads)

**Error: "Bucket not found"**
- Make sure bucket name is exactly `scorecards`
- Verify bucket is set to **Public**

### Domain Not Working

**DNS not resolving:**
- Wait 24-48 hours for DNS propagation
- Check DNS records are correct
- Use `dig league.tee24.golf` or `nslookup league.tee24.golf` to verify

**SSL Certificate issues:**
- Vercel automatically provisions SSL certificates
- Wait 5-10 minutes after DNS is configured

---

## Environment Variables Summary

Make sure these are set in Vercel:

```env
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

---

## Quick Reference

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard
- **GitHub Repository**: https://github.com/YOUR_USERNAME/tee24-league
- **Live Site**: https://league.tee24.golf

---

## Next Steps

1. ✅ Code is pushed to GitHub
2. ✅ Project deployed to Vercel
3. ✅ Custom domain configured
4. ✅ Database initialized
5. ✅ Initial data seeded
6. 🎉 **You're live!**

Start adding players and courses through the admin portal!


