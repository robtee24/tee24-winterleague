# Supabase Setup

This guide covers setting up both the database and storage for Supabase.

## Step 1: Set Up Supabase Storage (Required for Image Uploads)

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the sidebar
3. Click **Create a new bucket**
4. Name it: `scorecards` (exactly this name)
5. Make it **Public** (so images can be viewed by anyone)
6. Click **Create bucket**

## Step 2: Get Your Supabase Connection String

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project (or create a new one)
3. Go to **Settings** → **Database**
4. Find the **Connection string** section
5. Copy the **URI** connection string (it should look like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```

## Step 3: Get Your Supabase API Credentials

1. Go to **Settings** → **API** in your Supabase project
2. Copy these values:
   - **Project URL** (this is your `NEXT_PUBLIC_SUPABASE_URL`)
   - **anon/public key** (this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **service_role key** (this is your `SUPABASE_SERVICE_ROLE_KEY` - scroll down to find it)

## Step 4: Create .env File

Create a `.env` file in the root of your project with:

```env
# Database
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Supabase Client (for storage)
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

**Important:** 
- Replace `[YOUR-PASSWORD]` with your actual database password
- Replace `[YOUR-PROJECT-REF]` with your project reference
- Get the anon key from Settings → API

## Step 5: Generate Prisma Client and Push Schema

Run these commands:

```bash
npx prisma generate
npx prisma db push
```

This will:
- Generate the Prisma client for PostgreSQL
- Create all the tables in your Supabase database

## Step 6: Seed Initial Data (Optional)

Run the seed script to create the initial leagues:

```bash
npm run seed
```

This will create "Louisville" and "Clarksville" leagues in your database.

## Step 7: Start the App

```bash
npm run dev
```

Your app is now connected to Supabase!

## Troubleshooting

### Connection Issues
- Make sure your `.env` file is in the root directory
- Verify your Supabase password is correct
- Check that your IP is allowed in Supabase (if you have IP restrictions enabled)
- Make sure you're using the correct connection string format

### Schema Issues
- If you get errors about existing tables, you may need to reset: `npx prisma db push --force-reset` (⚠️ This will delete all data!)
- Make sure you've run `npx prisma generate` after updating the schema

